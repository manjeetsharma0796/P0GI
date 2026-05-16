"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSelectedAgent } from "@/providers/selected-agent-provider"
import { toast } from "sonner"

const SKILLS = [
  {
    id: "tag",
    name: "Tight Aggressive",
    emoji: "\u{1F988}",
    color: "#3b82f6",
    tag: "Most Profitable",
    description: "The shark. Plays only top 8% of hands but bets hard when in. Discipline is the edge. Folds weak hands instantly, raises premium hands aggressively.",
    traits: ["Selective hand range", "Strong post-flop aggression", "Rare bluffs (but believable)", "Maximizes big pots"],
  },
  {
    id: "lag",
    name: "Loose Aggressive",
    emoji: "\u{1F525}",
    color: "#ef4444",
    tag: "High Variance",
    description: "The fire-starter. Plays 30%+ of hands, raises relentlessly, puts everyone on tilt. Continuation bets 75% of the time. Double barrels the turn.",
    traits: ["Wide opening range", "Constant pressure", "Semi-bluffs with draws", "Overbets the pot"],
  },
  {
    id: "rock",
    name: "The Rock",
    emoji: "\u{1FAA8}",
    color: "#6b7280",
    tag: "Ultra Safe",
    description: "The fortress. Only plays monsters (top 5%). Never raises first — just smooth calls. Waits for the perfect moment to spring the trap.",
    traits: ["Top 5% hands only", "Never raises pre-flop", "Traps with slow-plays", "Zero bluffs"],
  },
  {
    id: "gto",
    name: "GTO Grinder",
    emoji: "\u{1F9EE}",
    color: "#8b5cf6",
    tag: "Unexploitable",
    description: "The mathematician. Plays game-theory optimal. Balanced ranges, mixed strategies, pot odds calculations. Impossible to read.",
    traits: ["Position-based ranges", "2:1 value-to-bluff ratio", "Mixed bet sizing", "Pot odds driven"],
  },
  {
    id: "maniac",
    name: "The Maniac",
    emoji: "\u{1F0CF}",
    color: "#f59e0b",
    tag: "Chaos Mode",
    description: "Pure chaos. Raises EVERY hand. 72 offsuit? Raise. 23 offsuit? Raise bigger. 4-bets 60% of the time. Fear is the currency.",
    traits: ["Raises every hand", "Overbets 100-200% pot", "4-bets with air", "Tilts the entire table"],
  },
]

export default function SkillsPage() {
  const { selectedAgent } = useSelectedAgent()

  useEffect(() => {
    if (!selectedAgent) {
      toast.info("Pick your agent first", {
        action: { label: "Go to Agents", onClick: () => window.location.href = "/agents" },
        style: { background: "#0c1018", border: "1px solid #1a2236", color: "#fff" },
      })
    }
  }, [selectedAgent])

  const [selectedSkill, setSelectedSkill] = useState<string>("tag")
  const [customPrompt, setCustomPrompt] = useState("")
  const [showCustom, setShowCustom] = useState(false)

  const selected = SKILLS.find((s) => s.id === selectedSkill)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {selectedAgent ? `Choose Strategy for ${selectedAgent.name}` : "Poker Skills"}
        </h1>
        <p className="text-sm text-[#888] mt-1">
          Each skill injects a deep strategy prompt into the agent's LLM system message, shaping every decision.
        </p>
      </div>

      {/* Skill cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SKILLS.map((skill) => (
          <button
            key={skill.id}
            onClick={() => { setSelectedSkill(skill.id); setShowCustom(false) }}
            className={`text-left rounded-2xl p-5 border transition-all duration-200 ${
              selectedSkill === skill.id && !showCustom
                ? "bg-[#0d1117] border-[#3d5a80] shadow-lg shadow-[#3d5a80]/10"
                : "bg-[#0d1117] border-[#1e2a3a] hover:border-[#2d3f56]"
            }`}
          >
            {/* Top */}
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl">{skill.emoji}</span>
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${skill.color}18`, color: skill.color }}
              >
                {skill.tag}
              </span>
            </div>

            {/* Name */}
            <h3 className="text-base font-bold text-white mb-1">{skill.name}</h3>
            <p className="text-xs text-[#777] leading-relaxed mb-3">{skill.description}</p>

            {/* Traits */}
            <div className="flex flex-wrap gap-1.5">
              {skill.traits.map((t) => (
                <span key={t} className="text-[10px] text-[#666] bg-[#010409] rounded-md px-2 py-0.5">
                  {t}
                </span>
              ))}
            </div>

            {/* Selected indicator */}
            {selectedSkill === skill.id && !showCustom && (
              <div className="mt-3 pt-3 border-t border-[#1e2a3a] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: skill.color }} />
                <span className="text-xs font-medium" style={{ color: skill.color }}>
                  Selected
                </span>
              </div>
            )}
          </button>
        ))}

        {/* Custom skill */}
        <button
          onClick={() => setShowCustom(true)}
          className={`text-left rounded-2xl p-5 border transition-all duration-200 ${
            showCustom
              ? "bg-[#0d1117] border-[#3d5a80] shadow-lg"
              : "bg-[#0d1117] border-[#1e2a3a] hover:border-[#2d3f56] border-dashed"
          }`}
        >
          <span className="text-3xl">+</span>
          <h3 className="text-base font-bold text-white mt-3 mb-1">Custom Skill</h3>
          <p className="text-xs text-[#777]">Write your own strategy prompt. Full control over the agent's behavior.</p>
        </button>
      </div>

      {/* Custom prompt area */}
      {showCustom && (
        <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-2xl p-5">
          <label className="text-xs text-[#666] uppercase tracking-wider font-medium mb-2 block">
            Custom Strategy Prompt
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="You are a poker player who only raises with suited connectors and always bluffs on the river..."
            rows={6}
            className="w-full bg-[#010409] border border-[#1e2a3a] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#444] resize-none outline-none focus:border-[#2d3f56] transition-colors"
          />
        </div>
      )}

      {/* Apply to game button */}
      <div className="flex items-center justify-between pt-4">
        <div className="text-sm text-[#666]">
          {selected && !showCustom && (
            <span>
              Selected: <span className="text-white font-medium">{selected.emoji} {selected.name}</span>
            </span>
          )}
          {showCustom && <span>Using: <span className="text-white font-medium">Custom Prompt</span></span>}
        </div>
        <Link
          href="/lobby"
          className="px-6 py-2.5 bg-[#76b900] hover:bg-[#8dd100] text-black text-sm font-bold rounded-xl transition-colors"
        >
          Continue to Lobby
        </Link>
      </div>
    </div>
  )
}
