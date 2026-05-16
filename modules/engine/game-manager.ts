// modules/engine/game-manager.ts
// Texas Hold'em — proper rules, real on-chain settlements.
// Network: Initia agentbet-1 rollup (Move VM). All settlements are bank
// MsgSends between agent wallets on our appchain.

import { createPokerEngine, AGENT_NAMES, STARTING_STACK, INITIAL_BET } from "./poker"
import type { PokerState, PokerEngine } from "./poker"
import type { AgentName, GameEvent, ActionType, GameState } from "../shared/types"

import { getAgentAction, AGENTS } from "../agent/nvidia"
import {
  setupAllWallets,
  getBalance,
  getPotAddress,
  settleBet,
  distributeWinnings,
  getUsdcBalanceCents,
  recordHandOnChain,
} from "../chain/settlement"
import { log, logTx, clearLogs, printLogPaths } from "./logger"

// ─── Config ──────────────────────────────────────────────────────────────────

const TURN_DELAY_MS    = 5000   // 5 seconds AFTER each action
const FIXED_BET_CENTS  = 20    // $0.20 fixed bet per round
const MAX_RAISES_PER_ROUND = 4 // cap re-raises to prevent infinite loops

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type EventHandler = (event: GameEvent) => void

export interface GameManager {
  startGame:    (buyInCents?: number, userAgent?: string) => Promise<void>
  stopGame:     () => void
  dealNextHand: () => void
  getState:     () => PokerState | null
  isRunning:    () => boolean
  onEvent:      (handler: EventHandler) => void
  rebuy:        (amountCents: number) => void
  setForceFold: () => void
}

// ─── Manager ─────────────────────────────────────────────────────────────────

export function createGameManager(): GameManager {
  let engine:         PokerEngine | null = null
  let running         = false
  let handlers:       EventHandler[]    = []
  let handNumber      = 0
  let wallets:        Record<AgentName, { address: string }> = {} as any
  let potWalletAddr   = "0xPOT"
  let waitingForUser  = false
  let continueResolve: (() => void) | null = null
  let handStartStacks: Record<string, number> = {}
  let userAgentName:  string | null = null
  let forceFolding    = false

  function emit(event: GameEvent) {
    log("EMIT", `${event.type} ${event.agentName ?? ""} ${event.message ?? ""}`.trim())
    handlers.forEach((h) => h(event))
  }

  function onEvent(handler: EventHandler) { handlers.push(handler) }
  function getState(): PokerState | null { return engine?.getState() ?? null }
  function isRunning(): boolean { return running }

  function rebuy(amountCents: number) {
    if (!engine || !userAgentName) return
    const s = engine.getState()
    const pIdx = s.players.findIndex(p => p.name === userAgentName)
    if (pIdx >= 0) {
      // Engine doesn't have a direct rebuy — we add to stack via a new hand
      // For now, update the player's stack directly through engine internal state
      log("REBUY", `${userAgentName} re-buys ${usd(amountCents)}`)
      forceFolding = false
    }
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

  // ── Get action from an agent ──────────────────────────────────────────────

  async function getAction(playerIndex: number): Promise<{ action: ActionType; amount: number; message: string }> {
    if (!engine) return { action: "fold", amount: 0, message: "" }

    const s = engine.getState()
    const player = s.players[playerIndex]
    const agent = AGENTS.find((a) => a.name === player.name)!

    // Force-fold if agent has no stack or user timed out on rebuy
    if (player.stack <= 0 || (forceFolding && player.name === userAgentName)) {
      log("GUARD", `${player.name} force-folding (${player.stack <= 0 ? "zero balance" : "rebuy timeout"})`)
      return { action: "fold", amount: 0, message: "Out of chips..." }
    }

    // Real call amount: match the highest bet at the table this round.
    const maxBet = Math.max(...s.players.map(p => p.currentBet))
    const callAmount = Math.max(0, maxBet - player.currentBet)
    // If no one has bet yet this round, the minimum raise is the big blind;
    // otherwise it's at least the current call amount.
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

    log("LLM", `Calling NVIDIA for ${player.name} (${agent.model.split("/")[1]}) | stack: ${usd(player.stack)} pot: ${usd(s.pot)} call: ${usd(callAmount)}`)
    const decision = await getAgentAction(agent, gameState, { minRaise, bigBlind: FIXED_BET_CENTS })
    log("LLM", `${player.name}: ${decision.action} ${decision.amount} — "${decision.message}"`)

    // Bound the raise amount to something legal:
    //   - at least the minimum raise (call amount or big blind)
    //   - at most the player's remaining stack (treat overshoot as all-in)
    if (decision.action === "raise") {
      if (decision.amount < minRaise) {
        decision.amount = minRaise
      }
      if (decision.amount > player.stack) {
        decision.amount = player.stack   // all-in
        decision.message = decision.message?.startsWith("ALL-IN") ? decision.message : `ALL-IN · ${decision.message ?? ""}`.trim()
      }
    }

    // If agent can't afford to call, force fold
    if (decision.action === "call" && player.stack <= 0) {
      decision.action = "fold"
      decision.amount = 0
      decision.message = "No funds remaining."
      log("GUARD", `${player.name} forced fold — zero balance`)
    }

    return decision
  }

  // ── Play one betting round (proper Texas Hold'em rules) ────────────────────
  //
  // A round ends when:
  //   1. Every active player has acted at least once
  //   2. All active players have put in the same amount (or folded)
  //   3. OR only one player remains
  //   4. Re-raises capped at MAX_RAISES_PER_ROUND
  //
  // After a raise, all OTHER players must respond again.

  async function playBettingRound(): Promise<void> {
    if (!engine || !running) return

    let raisesThisRound = 0
    let lastRaiserIndex = -1

    // Each player must act once. After a raise, loop again for responses.
    // Use a "needs to act" set.
    const activePlayers = engine.getState().players
      .map((p, i) => ({ i, name: p.name }))
      .filter(({ i }) => {
        const p = engine!.getState().players[i]
        return !p.folded && p.active
      })

    const needsToAct = new Set(activePlayers.map(p => p.i))
    let actionCount = 0
    const MAX_ACTIONS = 16 // absolute safety limit

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

        // Get LLM decision
        const decision = await getAction(i)
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

        // If raise: everyone ELSE needs to respond again (BUG 1 fix)
        if (finalAction === "raise") {
          raisesThisRound++
          lastRaiserIndex = i
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
      log("GAME", "Betting round ended → next street")
    }
  }

  // ── Main game ──────────────────────────────────────────────────────────────

  async function startGame(buyInCents?: number, userAgent?: string): Promise<void> {
    running = true
    handNumber = 0
    forceFolding = false
    userAgentName = userAgent ?? null

    clearLogs()
    printLogPaths()
    log("INIT", "=== GAME START — Initia agentbet-1 rollup ===")

    wallets = await setupAllWallets(AGENT_NAMES, STARTING_STACK / 100)
    potWalletAddr = getPotAddress()

    // Fetch real CHIP balances from the rollup and use as starting stacks.
    // Opponents are normalized to a ±30% band around the user's buy-in so
    // the table is competitive (otherwise opponents sitting on 10K would
    // dwarf a 1300-buy-in user). If the user didn't set a buy-in, fall
    // back to the engine's STARTING_STACK.
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

      if (name === userAgentName) {
        realStacks[name] = Math.min(tableBuyIn, balanceCents)
        log("CHAIN", `${name} (YOU): ${addr} | balance ${usd(balanceCents)} | buy-in ${usd(realStacks[name])}`)
      } else {
        // Random seat stack inside the buy-in envelope, capped to the agent's on-chain balance.
        const target = opponentMin + Math.floor(Math.random() * (opponentMax - opponentMin + 1))
        realStacks[name] = Math.min(target, balanceCents)
        log("CHAIN", `${name}: ${addr} | balance ${usd(balanceCents)} | seat stack ${usd(realStacks[name])} (target ${usd(target)})`)
      }
    }

    engine = createPokerEngine(realStacks)

    const activePlayers = AGENT_NAMES.filter(n => realStacks[n] > 0)
    if (activePlayers.length < 2) {
      log("INIT", `⚠ Only ${activePlayers.length} agent(s) have CHIP — need at least 2 to play`)
      emit({ type: "game_over", handNumber: 0, message: "Not enough agents with CHIP balance. Fund wallets first!" })
      running = false
      return
    }
    log("INIT", `${activePlayers.length} agents have funds: ${activePlayers.join(", ")}`)

    // ── Hand loop ────────────────────────────────────────────────────────────
    while (running) {
      handNumber++
      engine.newHand()

      const preState = engine.getState()
      handStartStacks = {}
      for (const p of preState.players) handStartStacks[p.name] = p.stack

      log("HAND", `══ Hand #${handNumber} ══`)
      log("HAND", `Stacks: ${preState.players.map(p => `${p.name}:${usd(p.stack)}`).join(" | ")}`)
      log("HAND", `Hole cards: ${preState.players.map(p => `${p.name}:[${p.holeCards.join(",")}]`).join(" | ")}`)

      // Emit hand start
      emit({
        type: "deal", handNumber,
        stacks: Object.fromEntries(preState.players.map(p => [p.name, p.stack])) as Record<AgentName, number>,
        communityCards: [],
        message: `Hand #${handNumber} started`,
      })

      // ── 4 betting rounds: Pre-Flop → Flop → Turn → River ──────────────

      const STREET_NAMES = ["Pre-Flop", "Flop", "Turn", "River"]

      for (let street = 0; street < 4; street++) {
        if (engine.isHandOver() || !running) break

        const state = engine.getState()

        // Emit community cards for this street (flop=3, turn=4, river=5)
        if (street > 0 && state.communityCards.length > 0) {
          log("DEAL", `${STREET_NAMES[street]}: [${state.communityCards.join(", ")}] | Pot: ${usd(state.pot)}`)
          emit({
            type: "deal", handNumber,
            communityCards: state.communityCards,
            stacks: Object.fromEntries(state.players.map(p => [p.name, p.stack])) as Record<AgentName, number>,
            message: `${STREET_NAMES[street]}: ${state.communityCards.join(" ")}`,
          })

          // 3 second pause to let user see the cards
          await sleep(3000)
        }

        log("GAME", `── ${STREET_NAMES[street]} betting round ──`)
        await playBettingRound()
      }

      // ── Showdown ──────────────────────────────────────────────────────────

      const winner = engine.getWinner()
      let finalState = engine.getState()

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

        // ── x402 settlement ──────────────────────────────────────────────────

        const txHashes: string[] = []
        try {
          if (potAmount > 0) {
            // Settle based on actual losses — includes folded players who invested
            const losers = finalState.players
              .filter(p => p.name !== winner.name)
              .map(p => ({
                ...p,
                loss: (handStartStacks[p.name] ?? 0) - p.stack,
              }))
              .filter(p => p.loss > 0)

            log("CHAIN", `Settling on agentbet-1: pot=${usd(potAmount)} winner=${winner.name} losers=${losers.map(l => `${l.name}:${usd(l.loss)}`).join(",")}`)

            emit({
              type: "action", handNumber,
              message: "settlement_started",
              action: { action: "call", amount: 0, message: "Signing & broadcasting CHIP transfers on agentbet-1..." },
            })

            for (const loser of losers) {
              const amount = loser.loss
              const fromAddr = wallets[loser.name as AgentName]?.address
              const toAddr = wallets[winner.name]?.address
              if (!fromAddr || !toAddr) {
                log("CHAIN", `⚠ Missing address: ${loser.name}(${fromAddr}) → ${winner.name}(${toAddr})`)
                continue
              }

              // Check real CHIP balance before attempting transfer
              const balanceCents = await getUsdcBalanceCents(fromAddr)
              if (balanceCents < amount) {
                log("CHAIN", `⚠ ${loser.name} has ${usd(balanceCents)} CHIP, needs ${usd(amount)} — skipping settlement`)
                emit({
                  type: "action", handNumber, agentName: loser.name as AgentName,
                  message: "settlement_failed",
                  action: { action: "call", amount, message: `${loser.name} insufficient CHIP (${usd(balanceCents)} < ${usd(amount)})` },
                })
                continue
              }

              const mode = "on-chain" as const
              logTx({ hand: handNumber, from: fromAddr, fromAgent: loser.name, to: toAddr, toAgent: winner.name, amount, status: "initiated", mode })

              try {
                const txHash = await settleBet(fromAddr, toAddr, amount)
                txHashes.push(txHash)
                logTx({ hand: handNumber, from: fromAddr, fromAgent: loser.name, to: toAddr, toAgent: winner.name, amount, txHash, status: "success", mode })

                emit({
                  type: "action", handNumber, txHash,
                  agentName: loser.name as AgentName,
                  message: "settlement_complete",
                  action: { action: "call", amount, message: `${loser.name} → ${winner.name}: ${usd(amount)} CHIP` },
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
          log("CHAIN", `❌ Settlement crashed: ${e.message?.slice(0, 100)}`)
        }

        if (txHashes.length > 0) {
          emit({
            type: "payout", handNumber,
            winnerName: winner.name, winnerHand: winner.handName, potAmount,
            txHash: txHashes[txHashes.length - 1],
            stacks: Object.fromEntries(finalState.players.map(p => [p.name, p.stack])) as Record<AgentName, number>,
            message: `${txHashes.length} settlement(s) complete`,
          })

          // ── Emit on-chain audit record via agentbet::game::record_hand ───
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
              action: { action: "call", amount: 0, message: `on-chain audit: ${auditTx.slice(0, 10)}…` },
            })
          }
        }

        log("SETTLE", `${txHashes.length} tx settled`)
      }

      // ── Check if any agent ran out — eliminate them ─────────────────────

      const endState = engine.getState()
      const activePlayers = (endState?.players ?? []).filter(p => p.stack > 0)

      // User's agent out of buy-in → force exit the game
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

      // ── Wait for user ──────────────────────────────────────────────────────

      emit({
        type: "action", handNumber,
        message: "waiting_for_user",
        action: { action: "call", amount: 0, message: "Click 'Deal Next Hand'" },
      })

      log("CTRL", "⏸ Waiting for Deal Next Hand...")
      await waitForUser()
      if (!running) break
    }
  }

  return { startGame, stopGame, dealNextHand, getState, isRunning, onEvent, rebuy, setForceFold }
}
