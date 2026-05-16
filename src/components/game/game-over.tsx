"use client"

import Link from "next/link"
import { explorerTxUrl, formatChip, NETWORK_LABEL, truncateHash } from "@/lib/format"

interface AgentResult {
  name: string
  letter: string
  color: string
  stack: number
}

interface PayoutInfo {
  hash: string
  amount: number
  from: string
  to: string
}

interface GameOverProps {
  winner: { name: string; letter: string; color: string }
  agents: AgentResult[]
  payouts: PayoutInfo[]
}

export function GameOver({ winner, agents, payouts }: GameOverProps) {
  const sorted = [...agents].sort((a, b) => b.stack - a.stack)

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-lg flex items-center justify-center p-4">
      <div className="w-full max-w-[480px] bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-6">
        <h2 className="text-[28px] font-bold text-white">Game Over</h2>

        {/* Winner */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-2xl">{"\u{1F451}"}</span>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white border-[3px] border-accent"
            style={{
              backgroundColor: winner.color,
              boxShadow: "0 0 20px rgba(34,197,94,0.3)",
            }}
          >
            {winner.letter}
          </div>
          <span className="text-xl font-semibold text-white">{winner.name}</span>
          <span className="text-[13px] text-accent uppercase tracking-wide">Winner</span>
        </div>

        {/* Final stacks */}
        <div className="w-full bg-[#0a0a0a] rounded-lg border border-border">
          {sorted.map((agent, i) => (
            <div
              key={agent.name}
              className={`flex items-center justify-between px-3 py-2.5 ${
                i < sorted.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: agent.color }}
                >
                  {agent.letter}
                </div>
                <span className={`text-sm ${agent.name === winner.name ? "text-accent" : "text-muted"}`}>
                  {agent.name}
                </span>
              </div>
              <span className={`text-sm font-mono ${agent.name === winner.name ? "text-accent" : "text-muted"}`}>
                {formatChip(agent.stack)}
              </span>
            </div>
          ))}
        </div>

        {/* Payouts — every row links to the on-chain MsgSend on our rollup indexer */}
        {payouts.length > 0 && (
          <div className="w-full">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-medium text-muted uppercase tracking-wide">
                On-chain Payouts
              </h3>
              <span className="text-[10px] font-mono text-muted">{NETWORK_LABEL}</span>
            </div>
            <div className="flex flex-col gap-1">
              {payouts.map(p => (
                <div key={p.hash} className="flex items-center justify-between">
                  <a
                    href={explorerTxUrl(p.hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[13px] font-mono text-muted hover:text-accent hover:underline transition-colors"
                    title="View transaction on p0gi-1 indexer"
                  >
                    {truncateHash(p.hash)} ↗
                  </a>
                  <span className="text-[13px] font-mono text-white">{formatChip(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          href="/lobby"
          className="w-full bg-accent text-black text-base font-semibold rounded-lg h-11 flex items-center justify-center hover:bg-accent-hover transition-colors"
        >
          Back to Lobby
        </Link>
      </div>
    </div>
  )
}
