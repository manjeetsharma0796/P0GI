"use client"

import { useState, useEffect } from "react"

const SUIT_MAP: Record<string, { symbol: string; color: string }> = {
  h: { symbol: "\u2665", color: "#ef4444" },
  d: { symbol: "\u2666", color: "#ef4444" },
  c: { symbol: "\u2663", color: "#111827" },
  s: { symbol: "\u2660", color: "#111827" },
}

export function CardFace({ card, className = "" }: { card: string; className?: string }) {
  const suit = card[card.length - 1]
  const value = card.slice(0, -1)
  const s = SUIT_MAP[suit] ?? { symbol: "?", color: "#fff" }
  return (
    <div className={`w-10 h-14 bg-white rounded-md flex flex-col items-center justify-center shadow-lg border border-gray-200 select-none ${className}`}>
      <span className="text-xs font-black text-gray-900 leading-none">{value}</span>
      <span className="text-sm leading-none" style={{ color: s.color }}>{s.symbol}</span>
    </div>
  )
}

export function CardBack({ className = "" }: { className?: string }) {
  return (
    <div className={`w-10 h-14 rounded-md bg-gradient-to-br from-[#1a2236] to-[#0c1018] border border-[#2a3a56] flex items-center justify-center ${className}`}>
      <div
        className="w-6 h-8 rounded-sm border border-[#2a3a56] bg-[#0c1018]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent, transparent 2px, #1a223644 2px, #1a223644 4px)",
        }}
      />
    </div>
  )
}

export type GlowType = "none" | "winner" | "strong" | "bluff"

function glowClasses(glow: GlowType): string {
  switch (glow) {
    case "winner":
      return "ring-2 ring-yellow-400/80 shadow-[0_0_18px_4px_rgba(250,204,21,0.45)] animate-[winner-sparkle_1.5s_ease-in-out_infinite]"
    case "strong":
      return "ring-2 ring-emerald-400/60 shadow-[0_0_12px_2px_rgba(52,211,153,0.35)]"
    case "bluff":
      return "ring-2 ring-red-500/50 animate-[bluff-pulse_1.2s_ease-in-out_infinite]"
    default:
      return ""
  }
}

export function FlippableCard({
  card,
  revealed,
  glow = "none",
  delay = 0,
}: {
  card: string
  revealed: boolean
  glow?: GlowType
  delay?: number
}) {
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    if (revealed) {
      const t = setTimeout(() => setFlipped(true), delay)
      return () => clearTimeout(t)
    } else {
      setFlipped(false)
    }
  }, [revealed, delay])

  return (
    <div
      className={`relative w-10 h-14 rounded-md ${glowClasses(glow)}`}
      style={{ perspective: "600px" }}
    >
      <div
        className="absolute inset-0 transition-transform duration-500"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        <div className="absolute inset-0" style={{ backfaceVisibility: "hidden" }}>
          <CardBack />
        </div>
        <div
          className="absolute inset-0"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <CardFace card={card} />
        </div>
      </div>
    </div>
  )
}
