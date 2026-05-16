"use client"

interface AgentSeatProps {
  name: string
  letter: string
  color: string
  stack: number
  holeCards: [string, string] | null
  lastAction?: { type: "fold" | "call" | "raise" | "check"; amount?: number }
  isActive: boolean
  isThinking: boolean
}

const ACTION_STYLES: Record<string, string> = {
  fold: "bg-danger/10 text-danger",
  call: "bg-[#3b82f6]/10 text-[#3b82f6]",
  raise: "bg-accent/10 text-accent",
  check: "bg-muted/10 text-muted",
}

function formatAction(action: { type: string; amount?: number }) {
  if (action.type === "raise" && action.amount) {
    return `Raised ${(action.amount / 100).toFixed(2)} CHIP`
  }
  return action.type.charAt(0).toUpperCase() + action.type.slice(1) + (action.type === "call" ? "ed" : action.type === "fold" ? "ed" : action.type === "check" ? "ed" : "")
}

function CardSlot({ card }: { card: string | null }) {
  const isRed = card ? card.includes("\u2665") || card.includes("\u2666") || card.includes("h") || card.includes("d") : false

  if (!card) {
    return (
      <div className="w-9 h-[50px] rounded-md bg-gradient-to-br from-[#1a1a3a] to-[#141430] border border-border flex items-center justify-center">
        <div className="w-4 h-5 rounded-sm border border-muted/20" />
      </div>
    )
  }

  const rank = card.slice(0, -1)
  const suitChar = card.slice(-1)
  const suitMap: Record<string, string> = { s: "\u2660", h: "\u2665", d: "\u2666", c: "\u2663" }
  const suit = suitMap[suitChar] || suitChar

  return (
    <div className="w-9 h-[50px] rounded-md bg-[#1a1a1a] border border-[#363636] flex flex-col items-center justify-center animate-[card-reveal_200ms_ease-out]">
      <span className={`text-sm font-bold ${isRed ? "text-danger" : "text-white"}`}>
        {rank}
      </span>
      <span className={`text-xs ${isRed ? "text-danger" : "text-white"}`}>
        {suit}
      </span>
    </div>
  )
}

export function AgentSeat({
  name,
  letter,
  color,
  stack,
  holeCards,
  lastAction,
  isActive,
  isThinking,
}: AgentSeatProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Avatar */}
      <div className="relative">
        <div
          className={`w-[52px] h-[52px] rounded-full flex items-center justify-center text-xl font-bold text-white border-2 transition-all duration-300 ${
            isActive
              ? "border-accent shadow-[0_0_12px_rgba(34,197,94,0.3)]"
              : "border-border"
          }`}
          style={{
            backgroundColor: color,
            animation: isActive ? "pulse-glow 2s ease-in-out infinite" : undefined,
          }}
        >
          {letter}
          {isThinking && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" className="animate-[spin_1s_linear_infinite]">
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Name */}
      <span className="text-[13px] font-semibold text-white">{name}</span>

      {/* Stack */}
      <span className="text-xs font-mono text-accent">{(stack / 100).toFixed(2)} CHIP</span>

      {/* Cards */}
      <div className="flex gap-1">
        <CardSlot card={holeCards ? holeCards[0] : null} />
        <CardSlot card={holeCards ? holeCards[1] : null} />
      </div>

      {/* Last action badge */}
      {lastAction && !isThinking && (
        <span className={`rounded-full text-[10px] font-medium px-2 py-0.5 ${ACTION_STYLES[lastAction.type] || "bg-muted/10 text-muted"}`}>
          {formatAction(lastAction)}
        </span>
      )}
      {isThinking && (
        <span className="rounded-full text-[10px] font-medium px-2 py-0.5 bg-muted/10 text-muted italic">
          Thinking...
        </span>
      )}
    </div>
  )
}
