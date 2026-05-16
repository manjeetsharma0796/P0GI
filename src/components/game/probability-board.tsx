"use client"

import { useMemo } from "react"

// ── Types ───────────────────────────────────────────────────────
interface Agent {
  name: string
  letter: string
  color: string
  lastAction?: { type: "fold" | "call" | "raise" | "check"; amount?: number }
  isActive: boolean
  stack: number
}

interface ProbabilityBoardProps {
  agents: Agent[]
  communityCards: string[]
  pot: number
}

// ── Basic hand-strength estimation ──────────────────────────────
// Since we can't see hole cards, we estimate win probability based on:
//   1. Whether the agent is still in (not folded)
//   2. Betting behavior (raisers get a boost)
//   3. Community card texture (more cards = less uncertainty)
//   4. Stack commitment (ratio of bet to stack)

function estimateProbabilities(agents: Agent[], communityCards: string[]): Map<string, number> {
  const active = agents.filter((a) => a.lastAction?.type !== "fold")
  const probs = new Map<string, number>()

  if (active.length === 0) {
    // Everyone folded somehow — equal probabilities
    agents.forEach((a) => probs.set(a.name, 100 / agents.length))
    return probs
  }

  // Folded agents get 0%
  agents.forEach((a) => {
    if (a.lastAction?.type === "fold") {
      probs.set(a.name, 0)
    }
  })

  // Base share for active agents
  const baseShare = 100 / active.length

  // Behavioral weight: raisers get a multiplier based on street
  // More community cards = raise is a stronger signal
  const streetMultiplier = 1 + communityCards.length * 0.1 // 1.0 to 1.5

  const weights = new Map<string, number>()
  let totalWeight = 0

  active.forEach((a) => {
    let w = 1.0

    if (a.lastAction?.type === "raise") {
      // Raisers signal strength
      const raiseAmt = a.lastAction.amount ?? 0
      const stackRatio = a.stack > 0 ? raiseAmt / a.stack : 0
      w += 0.4 * streetMultiplier + stackRatio * 0.3
    } else if (a.lastAction?.type === "call") {
      // Callers are middling
      w += 0.1
    } else if (a.lastAction?.type === "check") {
      // Checkers might be weak or trapping
      w -= 0.05
    }

    // Clamp minimum
    w = Math.max(w, 0.2)

    weights.set(a.name, w)
    totalWeight += w
  })

  // Normalize to 100%
  active.forEach((a) => {
    const w = weights.get(a.name) ?? 1
    probs.set(a.name, Math.round((w / totalWeight) * 100))
  })

  // Fix rounding so total = 100
  const totalActive = active.reduce((sum, a) => sum + (probs.get(a.name) ?? 0), 0)
  if (totalActive !== 100 && active.length > 0) {
    const diff = 100 - totalActive
    const first = active[0]
    probs.set(first.name, (probs.get(first.name) ?? 0) + diff)
  }

  return probs
}

// ── Component ───────────────────────────────────────────────────
export function ProbabilityBoard({ agents, communityCards, pot }: ProbabilityBoardProps) {
  const probabilities = useMemo(
    () => estimateProbabilities(agents, communityCards),
    [agents, communityCards]
  )

  // Street label
  const streetLabel =
    communityCards.length === 0
      ? "Pre-flop"
      : communityCards.length === 3
        ? "Flop"
        : communityCards.length === 4
          ? "Turn"
          : "River"

  return (
    <div className="bg-[#0c1018]/90 backdrop-blur border border-[#1a2236] rounded-xl p-3 w-56">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#555]">
          Win Probability
        </span>
        <span className="text-[9px] font-mono text-[#444] bg-[#1a2236] rounded px-1.5 py-0.5">
          {streetLabel}
        </span>
      </div>

      {/* Agent bars */}
      <div className="space-y-2">
        {agents.map((agent) => {
          const pct = probabilities.get(agent.name) ?? 0
          const folded = agent.lastAction?.type === "fold"

          return (
            <div key={agent.name} className={`${folded ? "opacity-40" : ""}`}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: agent.color }}
                  />
                  <span className="text-[11px] font-semibold text-white">{agent.name}</span>
                </div>
                <span className="text-[11px] font-mono font-bold" style={{ color: agent.color }}>
                  {pct}%
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-[#1a2236] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: agent.color,
                    opacity: folded ? 0.3 : 0.85,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Pot info */}
      {pot > 0 && (
        <div className="mt-3 pt-2 border-t border-[#1a2236]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#555]">Pot</span>
            <span className="text-[11px] font-mono font-bold text-[#76b900]">
              {(pot / 100).toFixed(2)} CHIP
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
