"use client"

import Image from "next/image"
import { AgentSeat } from "./agent-seat"

interface AgentData {
  name: string
  letter: string
  color: string
  stack: number
  holeCards: [string, string] | null
  lastAction?: { type: "fold" | "call" | "raise" | "check"; amount?: number }
  isActive: boolean
  isThinking: boolean
}

interface PokerTableProps {
  agents: AgentData[]
  communityCards: string[]
  potCents: number
  handNumber: number
}

function CommunityCardSlot({ card }: { card?: string }) {
  const isRed = card ? card.includes("h") || card.includes("d") : false
  const rank = card ? card.slice(0, -1) : ""
  const suitChar = card ? card.slice(-1) : ""
  const suitMap: Record<string, string> = { s: "\u2660", h: "\u2665", d: "\u2666", c: "\u2663" }
  const suit = suitMap[suitChar] || suitChar

  if (!card) {
    return (
      <div className="w-12 h-[68px] rounded-lg bg-[#0a0a0a]/40 border border-dashed border-muted/30" />
    )
  }

  return (
    <div className="w-12 h-[68px] rounded-lg bg-[#1a1a1a] border border-[#363636] flex flex-col items-center justify-center animate-[card-reveal_200ms_ease-out]">
      <span className={`text-lg font-bold ${isRed ? "text-danger" : "text-white"}`}>{rank}</span>
      <span className={`text-sm ${isRed ? "text-danger" : "text-white"}`}>{suit}</span>
    </div>
  )
}

export function PokerTable({ agents, communityCards, potCents, handNumber }: PokerTableProps) {
  const cardSlots = Array.from({ length: 5 }, (_, i) => communityCards[i])

  return (
    <div className="relative flex items-center justify-center h-full w-full px-4">
      {/* Hand number */}
      <div className="absolute top-4 left-4 text-xs font-mono text-muted/60">
        Hand #{handNumber}
      </div>

      {/* Dealer table */}
      <div className="relative w-full max-w-[700px]">
        {/* Table image */}
        <Image
          src="/dealerTable.png"
          alt="Poker table"
          width={1400}
          height={900}
          className="w-full h-auto select-none pointer-events-none"
          priority
        />

        {/* Pot display — on the table felt, upper area */}
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 z-10">
          <div className="bg-[#0a0a0a]/70 border border-border rounded-lg px-4 py-2 backdrop-blur-sm text-center">
            <span className="text-[11px] font-medium text-muted uppercase tracking-wide block">POT</span>
            <span className="text-xl font-bold text-accent">{(potCents / 100).toFixed(2)} CHIP</span>
          </div>
        </div>

        {/* Community cards — centered on the felt */}
        <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1.5 z-10">
          {cardSlots.map((card, i) => (
            <CommunityCardSlot key={i} card={card} />
          ))}
        </div>

        {/* Agent seats — arranged along the curved bottom edge */}
        {/* Seat A: bottom-left area */}
        {agents[0] && (
          <div className="absolute bottom-[2%] left-[8%] -translate-x-1/2 z-10">
            <AgentSeat {...agents[0]} />
          </div>
        )}

        {/* Seat B: bottom center-left */}
        {agents[1] && (
          <div className="absolute bottom-[-8%] left-[32%] -translate-x-1/2 z-10">
            <AgentSeat {...agents[1]} />
          </div>
        )}

        {/* Seat C: bottom center-right */}
        {agents[2] && (
          <div className="absolute bottom-[-8%] left-[68%] -translate-x-1/2 z-10">
            <AgentSeat {...agents[2]} />
          </div>
        )}

        {/* Seat D: bottom-right area */}
        {agents[3] && (
          <div className="absolute bottom-[2%] right-[8%] translate-x-1/2 z-10">
            <AgentSeat {...agents[3]} />
          </div>
        )}
      </div>
    </div>
  )
}
