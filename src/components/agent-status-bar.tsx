"use client"

import { useState } from "react"
import Link from "next/link"
import { useSelectedAgent } from "@/providers/selected-agent-provider"

const MODEL_NAMES: Record<string, string> = {
  "meta/llama-3.3-70b-instruct": "0G Compute",
  "mistralai/mistral-small-4-119b-2603": "0G Compute",
  "nvidia/llama-3.3-nemotron-super-49b-v1": "0G Compute",
  "meta/llama-3.1-8b-instruct": "0G Compute",
  "claude-sonnet-4-20250514": "Premium Model",
  "gemini-2.5-flash": "Premium Model",
  "gpt-4o": "Premium Model",
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function AgentStatusBar({ buyInCents }: { buyInCents?: number } = {}) {
  const { selectedAgent } = useSelectedAgent()
  const [copied, setCopied] = useState(false)

  // No agent selected — show a muted prompt linking to /agents
  if (!selectedAgent) {
    return (
      <Link
        href="/agents"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#1a2236] bg-[#0c1018] text-[#555] text-xs hover:border-[#2a3a56] hover:text-[#777] transition-colors duration-150"
      >
        <div className="w-2 h-2 rounded-full bg-[#1a2236] border border-[#2a3a56]" />
        <span>No agent selected</span>
      </Link>
    )
  }

  const modelLabel = MODEL_NAMES[selectedAgent.modelId] ?? selectedAgent.modelId

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(selectedAgent!.walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Link
      href="/agents"
      className="flex items-center gap-3 px-3 py-1.5 rounded-lg border border-[#1a2236] bg-[#0c1018] hover:border-[#2a3a56] hover:bg-[#111827] transition-colors duration-150 cursor-pointer"
    >
      {/* Colored dot + agent name */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: selectedAgent.color }}
        />
        <span className="text-sm font-semibold text-white">{selectedAgent.name}</span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-[#1a2236] shrink-0" />

      {/* Model display name */}
      <span className="text-xs text-[#555] font-mono shrink-0">{modelLabel}</span>

      {/* Divider */}
      <div className="w-px h-4 bg-[#1a2236] shrink-0" />

      {/* Wallet address + copy button */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs font-mono text-[#888]">
          {truncateAddress(selectedAgent.walletAddress)}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied!" : "Copy address"}
          className="text-[#555] hover:text-white transition-colors p-0.5 rounded"
        >
          {copied ? (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#76b900"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-[#1a2236] shrink-0" />

      {/* Balances — A0GI on 0G Testnet */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs font-mono text-white/70">
          {selectedAgent.balances
            ? `${parseFloat(selectedAgent.balances.usdc).toFixed(2)} CHIP`
            : "..."}
        </span>
        {buyInCents !== undefined && buyInCents > 0 && (
          <>
            <div className="w-px h-4 bg-[#1a2236] shrink-0" />
            <span className="text-xs font-mono text-[#76b900]">
              Buy-in: {(buyInCents / 100).toFixed(2)} CHIP
            </span>
          </>
        )}
      </div>
    </Link>
  )
}
