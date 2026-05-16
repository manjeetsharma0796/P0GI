"use client"

import Link from "next/link"

interface TableCardProps {
  id: string
  name: string
  agents: { name: string; color: string; letter: string }[]
  seated: number
  max: number
  hand: number
  potCents: number
  status: "waiting" | "in_progress" | "finished"
}

const STATUS_STYLES = {
  waiting: "bg-warning/10 text-warning",
  in_progress: "bg-accent/10 text-accent",
  finished: "bg-muted/10 text-muted",
}

const STATUS_LABELS = {
  waiting: "Waiting",
  in_progress: "In Progress",
  finished: "Finished",
}

export function TableCard({ id, name, agents, seated, max, hand, potCents, status }: TableCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3.5">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">{name}</h3>
        <span className={`rounded-full text-[11px] font-medium px-2.5 py-0.5 flex items-center gap-1.5 ${STATUS_STYLES[status]}`}>
          {status === "in_progress" && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          )}
          {STATUS_LABELS[status]}
        </span>
      </div>

      {/* Agent avatars */}
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {Array.from({ length: max }).map((_, i) => {
            const agent = agents[i]
            if (agent) {
              return (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full border border-background flex items-center justify-center text-[11px] font-bold text-white"
                  style={{ backgroundColor: agent.color }}
                >
                  {agent.letter}
                </div>
              )
            }
            return (
              <div
                key={i}
                className="w-7 h-7 rounded-full border border-dashed border-muted flex items-center justify-center text-[11px] text-muted"
              >
                ?
              </div>
            )
          })}
        </div>
        <span className="text-[13px] text-muted">{seated}/{max}</span>
      </div>

      {/* Info row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          <span className="text-[13px] font-mono text-white">Hand #{hand}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span className="text-[13px] font-mono text-white">Pot {(potCents / 100).toFixed(2)} CHIP</span>
        </div>
      </div>

      {/* Join button */}
      <Link
        href={`/game/${id}`}
        className="w-full border border-accent/30 rounded-lg h-9 text-sm font-medium text-accent flex items-center justify-center hover:border-accent hover:bg-accent/5 transition-colors duration-150"
      >
        Join as Spectator
      </Link>
    </div>
  )
}
