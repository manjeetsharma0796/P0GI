// modules/engine/poker.ts
// Custom Texas Hold'em engine — no external library bugs
// Only dependency: pokersolver for hand evaluation at showdown

import { Hand } from "pokersolver"
import type { AgentName, ActionType } from "../shared/types"

export const AGENT_NAMES: AgentName[] = ["Llama", "Mistral", "Nemotron", "Qwen"]
export const STARTING_STACK = 1000   // cents ($10.00)
export const INITIAL_BET    = 20     // big blind in cents ($0.20)

// ─── Deck ────────────────────────────────────────────────────────────────────

const RANKS = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"]
const SUITS = ["h","d","c","s"]

function createDeck(): string[] {
  const deck: string[] = []
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s)
  return deck
}

function shuffle(deck: string[]): string[] {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Player {
  name:       AgentName
  stack:      number      // chips remaining
  holeCards:  string[]    // 2 cards
  betThisRound: number   // chips put in current round
  totalBetThisHand: number
  folded:     boolean
  active:     boolean     // has chips
  hasActed:   boolean     // acted this round
}

export interface PokerState {
  handNumber:     number
  round:          number       // 0=pre-flop 1=flop 2=turn 3=river
  pot:            number
  communityCards: string[]
  players: {
    name:         AgentName
    stack:        number
    holeCards:    string[]
    folded:       boolean
    active:       boolean
    availableActions: string[]
    currentBet:   number
    hasActed:     boolean
  }[]
  currentPlayerIndex: number
  isHandOver:     boolean
}

export interface PokerEngine {
  getState:     () => PokerState
  applyAction:  (playerIndex: number, action: ActionType, amount?: number) => void
  canEndRound:  () => boolean
  endRound:     () => void
  isHandOver:   () => boolean
  getWinner:    () => { name: AgentName; handName: string } | null
  awardPot:     (winnerName: AgentName) => number
  newHand:      () => void
}

// ─── Engine ──────────────────────────────────────────────────────────────────

export function createPokerEngine(customStacks?: Record<AgentName, number>): PokerEngine {
  let players: Player[] = AGENT_NAMES.map(name => ({
    name, stack: customStacks?.[name] ?? STARTING_STACK, holeCards: [],
    betThisRound: 0, totalBetThisHand: 0,
    folded: false, active: (customStacks?.[name] ?? STARTING_STACK) > 0, hasActed: false,
  }))

  let deck: string[] = []
  let communityCards: string[] = []
  let pot = 0
  let currentBet = 0  // highest bet this round
  let handNum = 0
  let roundNum = 0

  function activePlayers(): Player[] {
    return players.filter(p => p.active && !p.folded)
  }

  function getState(): PokerState {
    return {
      handNumber: handNum,
      round: roundNum,
      pot,
      communityCards: [...communityCards],
      players: players.map(p => ({
        name: p.name,
        stack: p.stack,
        holeCards: [...p.holeCards],
        folded: p.folded,
        active: p.active,
        availableActions: p.folded || !p.active ? [] : ["call", "raise", "fold"],
        currentBet: p.betThisRound,
        hasActed: p.hasActed,
      })),
      currentPlayerIndex: players.findIndex(p => p.active && !p.folded && !p.hasActed),
      isHandOver: isHandOver(),
    }
  }

  function applyAction(playerIndex: number, action: ActionType, amount = 0): void {
    const p = players[playerIndex]
    if (!p || p.folded || !p.active) return

    switch (action) {
      case "fold":
        p.folded = true
        p.hasActed = true
        break

      case "call": {
        const toCall = currentBet - p.betThisRound
        const actualCall = Math.min(toCall, p.stack)
        p.stack -= actualCall
        p.betThisRound += actualCall
        p.totalBetThisHand += actualCall
        pot += actualCall
        p.hasActed = true
        break
      }

      case "raise": {
        // First match the current bet
        const toCall = currentBet - p.betThisRound
        const raiseAmount = amount > 0 ? amount : INITIAL_BET * 2
        const total = toCall + raiseAmount
        const actual = Math.min(total, p.stack)
        p.stack -= actual
        p.betThisRound += actual
        p.totalBetThisHand += actual
        pot += actual
        currentBet = p.betThisRound
        p.hasActed = true

        // After a raise: everyone else must respond again
        for (const other of players) {
          if (other !== p && !other.folded && other.active) {
            other.hasActed = false
          }
        }
        break
      }
    }
  }

  function canEndRound(): boolean {
    const active = activePlayers()
    if (active.length <= 1) return true

    // All active players must have acted AND bet the same amount
    return active.every(p => p.hasActed && p.betThisRound === currentBet)
  }

  function endRound(): void {
    // Reset for next round
    for (const p of players) {
      p.betThisRound = 0
      p.hasActed = false
    }
    currentBet = 0
    roundNum++

    // Deal community cards
    if (roundNum === 1) {
      // Flop: 3 cards
      communityCards.push(deck.pop()!, deck.pop()!, deck.pop()!)
    } else if (roundNum === 2) {
      // Turn: 1 card
      communityCards.push(deck.pop()!)
    } else if (roundNum === 3) {
      // River: 1 card
      communityCards.push(deck.pop()!)
    }
  }

  function isHandOver(): boolean {
    return activePlayers().length <= 1 || roundNum >= 4
  }

  function getWinner(): { name: AgentName; handName: string } | null {
    const active = activePlayers()
    if (active.length === 0) return null

    if (active.length === 1) {
      return { name: active[0].name, handName: "Last standing" }
    }

    // Evaluate with pokersolver
    const hands = active.map(p => {
      const cards = [...p.holeCards, ...communityCards]
      return { name: p.name, hand: Hand.solve(cards) }
    })

    const winners = Hand.winners(hands.map(h => h.hand))
    const winnerHand = winners[0]
    const winnerEntry = hands.find(h => h.hand === winnerHand)

    return winnerEntry
      ? { name: winnerEntry.name, handName: winnerHand.name as string }
      : null
  }

  // Transfer the pot into the winner's stack. Must be called after getWinner()
  // and before newHand(), otherwise chips are lost when pot resets.
  function awardPot(winnerName: AgentName): number {
    const w = players.find(p => p.name === winnerName)
    if (!w) return 0
    const amount = pot
    w.stack += pot
    pot = 0
    return amount
  }

  function newHand(): void {
    // Reset for new hand — carry stacks forward
    deck = shuffle(createDeck())
    communityCards = []
    pot = 0
    currentBet = INITIAL_BET
    roundNum = 0
    handNum++

    for (const p of players) {
      p.folded = false
      p.active = p.stack > 0
      p.hasActed = false
      p.betThisRound = 0
      p.totalBetThisHand = 0
      // Deal 2 hole cards
      p.holeCards = [deck.pop()!, deck.pop()!]
    }
  }

  return { getState, applyAction, canEndRound, endRound, isHandOver, getWinner, awardPot, newHand }
}
