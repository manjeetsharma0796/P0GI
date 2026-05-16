// 0g/engine/0g-game-manager.ts
// Texas Hold'em game manager wired to the full 0G stack:
//   - 0G Compute for AI inference (router API or TEE-sealed)
//   - 0G Chain for on-chain settlements
//   - 0G Storage for immutable game history + KV leaderboard
//
// This mirrors modules/engine/game-manager.ts but replaces Initia/NVIDIA
// imports with their 0G equivalents. The poker engine itself is reused.

import { createPokerEngine, AGENT_NAMES, STARTING_STACK, INITIAL_BET } from "../../modules/engine/poker"
import type { PokerState, PokerEngine } from "../../modules/engine/poker"
import type { AgentName, GameEvent, ActionType, GameState, Agent } from "../../modules/shared/types"

// ── 0G Compute (AI inference) ───────────────────────────────────────────────
import {
  getAgentActionFromProvider,
  getDefaultAgents,
} from "../compute/provider-selector"
import { setZgAgentConfig } from "../compute/0g-compute"

// ── 0G Chain (settlement) ───────────────────────────────────────────────────
// Being written in parallel — same interface as modules/chain/settlement.ts
import {
  setupAllWallets,
  getBalance,
  settleBet,
  recordHandOnChain,
  explorerTxUrl,
  getUsdcBalanceCents,
} from "../chain/0g-settlement"

// ── 0G Storage (game history + leaderboard) ─────────────────────────────────
import {
  recordHandToStorage,
  type GameSessionData,
  type HandResult,
} from "../storage/0g-storage"

// ── 0G Sealed Inference (TEE verification — available for future use) ───────
// The sealed inference module is ready but not active in this build.
// To enable: import and initialize the broker in startGame().

// ── Shared utilities ────────────────────────────────────────────────────────
import { log, logTx, clearLogs, printLogPaths } from "./logger"

// ─── Config ─────────────────────────────────────────────────────────────────

const TURN_DELAY_MS        = 5000   // 5 seconds AFTER each action
const FIXED_BET_CENTS      = 20     // $0.20 fixed bet per round
const MAX_RAISES_PER_ROUND = 4      // cap re-raises to prevent infinite loops

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function usd(cents: number): string {
  const chip = cents / 100
  return chip % 1 === 0 ? `${chip} CHIP` : `${chip.toFixed(2)} CHIP`
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type EventHandler = (event: GameEvent) => void

export interface ZgGameManager {
  startGame:    (buyInCents?: number, userAgent?: string) => Promise<void>
  stopGame:     () => void
  dealNextHand: () => void
  getState:     () => PokerState | null
  isRunning:    () => boolean
  onEvent:      (handler: EventHandler) => void
  rebuy:        (amountCents: number) => void
  setForceFold: () => void
}

// ─── Game ID ────────────────────────────────────────────────────────────────

function generateGameId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `zg-${ts}-${rand}`
}

// ─── Manager ────────────────────────────────────────────────────────────────

export function createGameManager(): ZgGameManager {
  let engine:           PokerEngine | null = null
  let running           = false
  let handlers:         EventHandler[]     = []
  let handNumber        = 0
  let wallets:          Record<AgentName, { address: string }> = {} as any
  let waitingForUser    = false
  let continueResolve:  (() => void) | null = null
  let handStartStacks:  Record<string, number> = {}
  let userAgentName:    string | null = null
  let forceFolding      = false

  // Storage state
  let gameId: string = ""
  let handActions: GameSessionData["actions"] = []

  // ── Event system ──────────────────────────────────────────────────────────

  function emit(event: GameEvent) {
    log("EMIT", `${event.type} ${event.agentName ?? ""} ${event.message ?? ""}`.trim())
    handlers.forEach((h) => h(event))
  }

  function onEvent(handler: EventHandler) { handlers.push(handler) }
  function getState(): PokerState | null { return engine?.getState() ?? null }
  function isRunning(): boolean { return running }

  // ── Rebuy / fold controls ─────────────────────────────────────────────────

  function rebuy(amountCents: number) {
    if (!engine || !userAgentName) return
    log("REBUY", `${userAgentName} re-buys ${usd(amountCents)}`)
    forceFolding = false
  }

  function setForceFold() {
    forceFolding = true
    log("GUARD", `User agent will force-fold all remaining hands`)
  }

  function stopGame() {
    running = false
    waitingForUser = false
    if (continueResolve) { continueResolve(); continueResolve = null }
    emit({ type: "game_over", handNumber, message: "Game stopped" })
  }

  function dealNextHand() {
    log("CTRL", "User clicked Deal Next Hand")
    if (waitingForUser && continueResolve) {
      waitingForUser = false
      continueResolve()
      continueResolve = null
    }
  }

  function waitForUser(): Promise<void> {
    waitingForUser = true
    return new Promise((resolve) => { continueResolve = resolve })
  }

  // ── Resolve agents ─────────────────────────────────────────────────────────

  function getAgents(): Agent[] {
    return getDefaultAgents()
  }

  // ── Get action from an agent ──────────────────────────────────────────────

  async function getAction(playerIndex: number, street: string): Promise<{ action: ActionType; amount: number; message: string }> {
    if (!engine) return { action: "fold", amount: 0, message: "" }

    const s = engine.getState()
    const player = s.players[playerIndex]
    const agents = getAgents()
    const agent = agents.find((a) => a.name === player.name)!

    // Force-fold if agent has no stack or user timed out on rebuy
    if (player.stack <= 0 || (forceFolding && player.name === userAgentName)) {
      log("GUARD", `${player.name} force-folding (${player.stack <= 0 ? "zero balance" : "rebuy timeout"})`)
      return { action: "fold", amount: 0, message: "Out of chips..." }
    }

    // Real call amount
    const maxBet = Math.max(...s.players.map(p => p.currentBet))
    const callAmount = Math.max(0, maxBet - player.currentBet)
    const minRaise = Math.max(FIXED_BET_CENTS, callAmount)

    const gameState: GameState = {
      agentName:      player.name,
      holeCards:      player.holeCards,
      communityCards: s.communityCards,
      pot:            s.pot,
      myStack:        player.stack,
      callAmount,
      otherActions:   s.players
        .filter((p) => p.name !== player.name && p.hasActed && !p.folded)
        .map((p) => `${p.name} ${p.currentBet > 0 ? `bet ${usd(p.currentBet)}` : "checked"}`),
    }

    const ctx = { minRaise, bigBlind: FIXED_BET_CENTS }

    log("COMPUTE", `0G Compute → ${player.name} (${agent.model}) | stack: ${usd(player.stack)} pot: ${usd(s.pot)} call: ${usd(callAmount)}`)
    const decision = await getAgentActionFromProvider(agent, gameState, ctx)
    log("COMPUTE", `${player.name}: ${decision.action} ${decision.amount} — "${decision.message}"`)
    const verificationBadge = ""

    // Track action for 0G Storage
    handActions.push({
      agentName: player.name,
      action: decision.action,
      amount: decision.amount,
      message: decision.message + verificationBadge,
      street,
    })

    // Bound the raise amount
    if (decision.action === "raise") {
      if (decision.amount < minRaise) {
        decision.amount = minRaise
      }
      if (decision.amount > player.stack) {
        decision.amount = player.stack
        decision.message = decision.message?.startsWith("ALL-IN") ? decision.message : `ALL-IN -- ${decision.message ?? ""}`.trim()
      }
    }

    // If agent can't afford to call, force fold
    if (decision.action === "call" && player.stack <= 0) {
      decision.action = "fold"
      decision.amount = 0
      decision.message = "No funds remaining."
      log("GUARD", `${player.name} forced fold — zero balance`)
    }

    // Append verification badge to emitted message when using sealed inference
    if (verificationBadge) {
      decision.message = decision.message + verificationBadge
    }

    return decision
  }

  // ── Play one betting round ────────────────────────────────────────────────

  async function playBettingRound(streetName: string): Promise<void> {
    if (!engine || !running) return

    let raisesThisRound = 0

    const activePlayers = engine.getState().players
      .map((p, i) => ({ i, name: p.name }))
      .filter(({ i }) => {
        const p = engine!.getState().players[i]
        return !p.folded && p.active
      })

    const needsToAct = new Set(activePlayers.map(p => p.i))
    let actionCount = 0
    const MAX_ACTIONS = 16

    while (needsToAct.size > 0 && running && actionCount < MAX_ACTIONS) {
      for (const { i, name } of activePlayers) {
        if (!running || actionCount >= MAX_ACTIONS) return
        if (!needsToAct.has(i)) continue

        const s = engine.getState()
        const player = s.players[i]
        if (player.folded || !player.active) {
          needsToAct.delete(i)
          continue
        }

        // Check if only 1 player left
        const remaining = s.players.filter(p => !p.folded && p.active)
        if (remaining.length <= 1) return

        // Signal thinking
        emit({
          type: "action", handNumber, agentName: player.name,
          action: { action: "fold", amount: 0, message: "thinking..." },
          message: `${player.name} is thinking...`,
        })

        // Get AI decision
        const decision = await getAction(i, streetName)
        let finalAction: ActionType = decision.action

        // If raises capped, force call instead
        if (finalAction === "raise" && raisesThisRound >= MAX_RAISES_PER_ROUND) {
          finalAction = "call"
          decision.action = "call"
          decision.message = "Cap reached, calling."
        }

        // Apply to engine
        try {
          engine.applyAction(i, finalAction, decision.amount)
        } catch (e: any) {
          log("ENGINE", `${finalAction} failed for ${name}: ${e.message?.slice(0, 60)}`)
          finalAction = "call"
          decision.action = "call"
          decision.message = "I'll call."
          try { engine.applyAction(i, "call") } catch { needsToAct.delete(i); continue }
        }

        // Mark this player as acted
        needsToAct.delete(i)
        actionCount++

        // If raise: everyone ELSE needs to respond again
        if (finalAction === "raise") {
          raisesThisRound++
          for (const other of activePlayers) {
            if (other.i !== i) {
              const op = engine.getState().players[other.i]
              if (!op.folded && op.active) {
                needsToAct.add(other.i)
              }
            }
          }
        }

        // Emit action with current pot
        const postActionState = engine.getState()
        emit({
          type: "action", handNumber, agentName: player.name,
          action: { ...decision, action: finalAction },
          potAmount: postActionState.pot,
          stacks: Object.fromEntries(postActionState.players.map(p => [p.name, p.stack])) as Record<AgentName, number>,
          message: `${name} ${finalAction}${finalAction === "raise" ? ` ${usd(decision.amount)}` : finalAction === "call" ? ` ${usd(FIXED_BET_CENTS)}` : ""} — "${decision.message}"`,
        })

        log("GAME", `${name} ${finalAction} | stack: ${engine.getState().players[i].stack} | raises: ${raisesThisRound} | needsToAct: ${needsToAct.size}`)

        // 5 second pause
        await sleep(TURN_DELAY_MS)
      }
    }

    // End the betting round
    if (engine.canEndRound() && !engine.isHandOver()) {
      engine.endRound()
      log("GAME", "Betting round ended -> next street")
    }
  }

  // ── Record hand to 0G Storage (non-fatal) ─────────────────────────────────

  async function recordToStorage(
    winnerName: string,
    winnerHand: string,
    potAmount: number,
    finalState: PokerState,
    settlements: { from: string; to: string; amount: number; txHash: string }[],
  ): Promise<void> {
    try {
      const sessionData: GameSessionData = {
        gameId,
        handNumber,
        players: finalState.players.map(p => ({
          name: p.name,
          stack: p.stack,
          holeCards: p.holeCards,
        })),
        communityCards: finalState.communityCards,
        winner: winnerName,
        winnerHand,
        potAmount,
        actions: [...handActions],
        settlements,
        timestamp: Date.now(),
      }

      const results: Record<string, HandResult> = {}
      for (const p of finalState.players) {
        const earnings = p.stack - (handStartStacks[p.name] ?? STARTING_STACK)
        results[p.name] = {
          winner: p.name === winnerName,
          earnings,
          potSize: potAmount,
        }
      }

      const { rootHash, kvErrors } = await recordHandToStorage(sessionData, results)
      if (rootHash) {
        log("STORAGE", `Hand #${handNumber} archived to 0G Storage — rootHash: ${rootHash.slice(0, 16)}...`)
      }
      if (kvErrors.length > 0) {
        log("STORAGE", `Leaderboard update had ${kvErrors.length} error(s)`)
      }
    } catch (err) {
      log("STORAGE", `recordToStorage failed (non-fatal): ${(err as Error).message?.slice(0, 100)}`)
    }
  }

  // ── Main game ─────────────────────────────────────────────────────────────

  async function startGame(buyInCents?: number, userAgent?: string): Promise<void> {
    running = true
    handNumber = 0
    forceFolding = false
    userAgentName = userAgent ?? null
    gameId = generateGameId()
    handActions = []

    clearLogs()
    printLogPaths()
    log("INIT", `=== GAME START — 0G Compute Network ===`)
    log("INIT", `Game ID: ${gameId}`)

    // ── Setup wallets ───────────────────────────────────────────────────────
    wallets = await setupAllWallets(AGENT_NAMES, STARTING_STACK / 100)

    // ── Fetch real balances and normalize stacks ────────────────────────────
    const tableBuyIn = buyInCents && buyInCents > 0 ? buyInCents : STARTING_STACK
    const opponentMin = Math.max(20, Math.floor(tableBuyIn * 0.7))
    const opponentMax = Math.max(opponentMin, Math.floor(tableBuyIn * 1.3))

    const realStacks: Record<AgentName, number> = {} as any
    for (const name of AGENT_NAMES) {
      const addr = wallets[name]?.address
      if (!addr) {
        realStacks[name] = 0
        log("CHAIN", `${name}: NO WALLET`)
        continue
      }
      const balanceCents = await getUsdcBalanceCents(addr)

      if (name === userAgent) {
        realStacks[name] = Math.min(tableBuyIn, balanceCents)
        log("CHAIN", `${name} (YOU): ${addr} | balance ${usd(balanceCents)} | buy-in ${usd(realStacks[name])}`)
      } else {
        const target = opponentMin + Math.floor(Math.random() * (opponentMax - opponentMin + 1))
        realStacks[name] = Math.min(target, balanceCents)
        log("CHAIN", `${name}: ${addr} | balance ${usd(balanceCents)} | seat stack ${usd(realStacks[name])} (target ${usd(target)})`)
      }
    }

    engine = createPokerEngine(realStacks)

    const activePlayerNames = AGENT_NAMES.filter(n => realStacks[n] > 0)
    if (activePlayerNames.length < 2) {
      log("INIT", `Only ${activePlayerNames.length} agent(s) have balance — need at least 2 to play`)
      emit({ type: "game_over", handNumber: 0, message: "Not enough agents with 0G balance. Fund wallets first!" })
      running = false
      return
    }
    log("INIT", `${activePlayerNames.length} agents have funds: ${activePlayerNames.join(", ")}`)

    // ── Hand loop ───────────────────────────────────────────────────────────
    while (running) {
      handNumber++
      handActions = []
      engine.newHand()

      const preState = engine.getState()
      handStartStacks = {}
      for (const p of preState.players) handStartStacks[p.name] = p.stack

      log("HAND", `== Hand #${handNumber} ==`)
      log("HAND", `Stacks: ${preState.players.map(p => `${p.name}:${usd(p.stack)}`).join(" | ")}`)
      log("HAND", `Hole cards: ${preState.players.map(p => `${p.name}:[${p.holeCards.join(",")}]`).join(" | ")}`)

      // Emit hand start
      emit({
        type: "deal", handNumber,
        stacks: Object.fromEntries(preState.players.map(p => [p.name, p.stack])) as Record<AgentName, number>,
        communityCards: [],
        message: `Hand #${handNumber} started`,
      })

      // ── 4 betting rounds: Pre-Flop -> Flop -> Turn -> River ─────────────

      const STREET_NAMES = ["Pre-Flop", "Flop", "Turn", "River"]

      for (let street = 0; street < 4; street++) {
        if (engine.isHandOver() || !running) break

        const state = engine.getState()

        // Emit community cards for this street
        if (street > 0 && state.communityCards.length > 0) {
          log("DEAL", `${STREET_NAMES[street]}: [${state.communityCards.join(", ")}] | Pot: ${usd(state.pot)}`)
          emit({
            type: "deal", handNumber,
            communityCards: state.communityCards,
            stacks: Object.fromEntries(state.players.map(p => [p.name, p.stack])) as Record<AgentName, number>,
            message: `${STREET_NAMES[street]}: ${state.communityCards.join(" ")}`,
          })

          await sleep(3000)
        }

        log("GAME", `-- ${STREET_NAMES[street]} betting round --`)
        await playBettingRound(STREET_NAMES[street])
      }

      // ── Showdown ────────────────────────────────────────────────────────────

      const winner = engine.getWinner()
      let finalState = engine.getState()
      const settlementRecords: { from: string; to: string; amount: number; txHash: string }[] = []

      if (winner) {
        const potAmount = finalState.pot
        engine.awardPot(winner.name)
        finalState = engine.getState()

        // P&L
        const handPnL: Record<string, number> = {}
        for (const p of finalState.players) {
          handPnL[p.name] = p.stack - (handStartStacks[p.name] ?? STARTING_STACK)
        }

        // Hole cards for reveal
        const allHoleCards: Record<string, string[]> = {}
        for (const p of finalState.players) {
          if (p.holeCards?.length > 0) allHoleCards[p.name] = p.holeCards
        }

        log("WINNER", `${winner.name} — ${winner.handName} | Pot: ${usd(potAmount)}`)
        log("PNL", Object.entries(handPnL).map(([n, v]) => `${n}:${v >= 0 ? "+" : ""}${usd(v)}`).join(" | "))
        log("REVEAL", Object.entries(allHoleCards).map(([n, c]) => `${n}:[${c}]`).join(" | "))

        // Emit payout with hole cards
        emit({
          type: "payout", handNumber,
          winnerName: winner.name,
          winnerHand: winner.handName,
          potAmount,
          stacks: Object.fromEntries(finalState.players.map(p => [p.name, p.stack])) as Record<AgentName, number>,
          holeCards: allHoleCards,
          message: `${winner.name} wins ${usd(potAmount)} with ${winner.handName}`,
        })

        // ── 0G chain settlement ─────────────────────────────────────────────

        const txHashes: string[] = []
        try {
          if (potAmount > 0) {
            const losers = finalState.players
              .filter(p => p.name !== winner.name)
              .map(p => ({
                ...p,
                loss: (handStartStacks[p.name] ?? 0) - p.stack,
              }))
              .filter(p => p.loss > 0)

            log("CHAIN", `Settling on 0G chain: pot=${usd(potAmount)} winner=${winner.name} losers=${losers.map(l => `${l.name}:${usd(l.loss)}`).join(",")}`)

            emit({
              type: "action", handNumber,
              message: "settlement_started",
              action: { action: "call", amount: 0, message: "Signing & broadcasting 0G transfers..." },
            })

            for (const loser of losers) {
              const amount = loser.loss
              const fromAddr = wallets[loser.name as AgentName]?.address
              const toAddr = wallets[winner.name]?.address
              if (!fromAddr || !toAddr) {
                log("CHAIN", `Missing address: ${loser.name}(${fromAddr}) -> ${winner.name}(${toAddr})`)
                continue
              }

              // Check real balance before attempting transfer
              const balanceCents = await getUsdcBalanceCents(fromAddr)
              if (balanceCents < amount) {
                log("CHAIN", `${loser.name} has ${usd(balanceCents)}, needs ${usd(amount)} — skipping settlement`)
                emit({
                  type: "action", handNumber, agentName: loser.name as AgentName,
                  message: "settlement_failed",
                  action: { action: "call", amount, message: `${loser.name} insufficient balance (${usd(balanceCents)} < ${usd(amount)})` },
                })
                continue
              }

              const mode = "on-chain" as const
              logTx({ hand: handNumber, from: fromAddr, fromAgent: loser.name, to: toAddr, toAgent: winner.name, amount, status: "initiated", mode })

              try {
                const txHash = await settleBet(fromAddr, toAddr, amount)
                txHashes.push(txHash)
                settlementRecords.push({ from: fromAddr, to: toAddr, amount, txHash })
                logTx({ hand: handNumber, from: fromAddr, fromAgent: loser.name, to: toAddr, toAgent: winner.name, amount, txHash, status: "success", mode })

                const txUrl = explorerTxUrl(txHash)
                emit({
                  type: "action", handNumber, txHash,
                  agentName: loser.name as AgentName,
                  message: "settlement_complete",
                  action: { action: "call", amount, message: `${loser.name} -> ${winner.name}: ${usd(amount)} CHIP | ${txUrl}` },
                })
              } catch (e: any) {
                logTx({ hand: handNumber, from: fromAddr, fromAgent: loser.name, to: toAddr, toAgent: winner.name, amount, status: "failed", mode, error: e.message?.slice(0, 80) })
                emit({
                  type: "action", handNumber, agentName: loser.name as AgentName,
                  message: "settlement_failed",
                  action: { action: "call", amount, message: `FAILED: ${e.message?.slice(0, 40)}` },
                })
              }
            }
          }
        } catch (e: any) {
          log("CHAIN", `Settlement crashed: ${e.message?.slice(0, 100)}`)
        }

        if (txHashes.length > 0) {
          emit({
            type: "payout", handNumber,
            winnerName: winner.name, winnerHand: winner.handName, potAmount,
            txHash: txHashes[txHashes.length - 1],
            stacks: Object.fromEntries(finalState.players.map(p => [p.name, p.stack])) as Record<AgentName, number>,
            message: `${txHashes.length} settlement(s) complete`,
          })

          // ── On-chain audit record ───────────────────────────────────────
          const auditLosers = finalState.players
            .filter(p => p.name !== winner.name)
            .map(p => ({
              address: wallets[p.name as AgentName]?.address ?? "",
              lossCents: (handStartStacks[p.name] ?? 0) - p.stack,
            }))
            .filter(l => l.address && l.lossCents > 0)

          const auditTx = await recordHandOnChain({
            handId: handNumber,
            tableId: 1,
            winnerAddress: wallets[winner.name]?.address ?? "",
            potCents: potAmount,
            losers: auditLosers,
          })
          if (auditTx) {
            log("CHAIN", `HandSettled event emitted: ${auditTx}`)
            emit({
              type: "action", handNumber, txHash: auditTx,
              message: "hand_recorded_onchain",
              action: { action: "call", amount: 0, message: `on-chain audit: ${auditTx.slice(0, 10)}...` },
            })
          }
        }

        log("SETTLE", `${txHashes.length} tx settled`)

        // ── 0G Storage archival (non-fatal) ─────────────────────────────────
        await recordToStorage(
          winner.name,
          winner.handName,
          potAmount,
          finalState,
          settlementRecords,
        )
      }

      // ── Check if any agent ran out — eliminate them ────────────────────────

      const endState = engine.getState()
      const activePlayers = (endState?.players ?? []).filter(p => p.stack > 0)

      // User's agent out of buy-in -> force exit the game
      if (userAgentName) {
        const userPlayer = (endState?.players ?? []).find(p => p.name === userAgentName)
        if (userPlayer && userPlayer.stack <= 0) {
          const richest = [...(endState?.players ?? [])].sort((a, b) => b.stack - a.stack)[0]
          log("BUYIN", `${userAgentName} eliminated — buy-in depleted. Leader: ${richest?.name}`)
          emit({
            type: "game_over", handNumber,
            winnerName: richest?.name as AgentName,
            message: `${userAgentName} is out of chips! ${richest?.name} leads with ${usd(richest?.stack ?? 0)}.`,
          })
          running = false
          break
        }
      }

      // General game over — fewer than 2 agents with chips
      if (activePlayers.length <= 1) {
        emit({ type: "game_over", handNumber, winnerName: activePlayers[0]?.name, message: `${activePlayers[0]?.name} wins — budgets exhausted!` })
        running = false
        break
      }

      // ── Wait for user ───────────────────────────────────────────────────────

      emit({
        type: "action", handNumber,
        message: "waiting_for_user",
        action: { action: "call", amount: 0, message: "Click 'Deal Next Hand'" },
      })

      log("CTRL", "Waiting for Deal Next Hand...")
      await waitForUser()
      if (!running) break
    }
  }

  return {
    startGame,
    stopGame,
    dealNextHand,
    getState,
    isRunning,
    onEvent,
    rebuy,
    setForceFold,
  }
}
