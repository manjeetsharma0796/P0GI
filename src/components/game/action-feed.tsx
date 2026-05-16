"use client"

import { useRef, useEffect } from "react"

interface ActionFeedEvent {
  type: "action" | "deal" | "showdown" | "payout" | "game_over"
  handNumber: number
  agentName?: string
  actionType?: "fold" | "call" | "raise" | "check"
  amount?: number
  message?: string
  timestamp: number
}

interface ActionFeedProps {
  events: ActionFeedEvent[]
}

const AGENT_COLORS: Record<string, { bg: string; letter: string }> = {
  Claude: { bg: "#d97706", letter: "C" },
  Gemini: { bg: "#3b82f6", letter: "G" },
  ChatGPT: { bg: "#10b981", letter: "O" },
}

function getAgentStyle(name?: string) {
  if (!name) return { bg: "#737373", letter: "?" }
  return AGENT_COLORS[name] ?? { bg: "#737373", letter: name.charAt(0).toUpperCase() }
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function formatAmount(amount?: number): string {
  if (amount == null) return ""
  return `${amount.toFixed(2)} CHIP`
}

function getActionText(event: ActionFeedEvent): { text: string; className: string } {
  if (event.type === "deal") {
    return {
      text: event.message ?? "Cards dealt",
      className: "text-[#737373] italic",
    }
  }

  if (event.type === "showdown") {
    return {
      text: event.message ?? `${event.agentName ?? "Unknown"} shows hand`,
      className: "text-white",
    }
  }

  if (event.type === "payout") {
    return {
      text: event.message ?? `${event.agentName ?? "Unknown"} wins ${formatAmount(event.amount)}`,
      className: "text-white",
    }
  }

  if (event.type === "game_over") {
    return {
      text: event.message ?? "Game over",
      className: "text-white font-bold",
    }
  }

  // action type
  const name = event.agentName ?? "Unknown"
  const colorMap: Record<string, string> = {
    fold: "text-[#ef4444]",
    call: "text-[#3b82f6]",
    raise: "text-[#22c55e]",
    check: "text-[#737373]",
  }
  const color = colorMap[event.actionType ?? "check"] ?? "text-[#737373]"

  const verbMap: Record<string, string> = {
    fold: "folded",
    call: "called",
    raise: "raised",
    check: "checked",
  }
  const verb = verbMap[event.actionType ?? "check"] ?? event.actionType

  const amountStr = event.amount != null ? ` ${formatAmount(event.amount)}` : ""

  return {
    text: `${name} ${verb}${amountStr}`,
    className: color,
  }
}

function CardIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2" y="1" width="9" height="12" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
      <rect x="5" y="3" width="9" height="12" rx="1.5" stroke="white" strokeWidth="1.5" fill="none" />
    </svg>
  )
}

// --- Mock data ---
const now = Date.now()
const MOCK_EVENTS: ActionFeedEvent[] = [
  { type: "deal", handNumber: 1, message: "Dealing hand #1 -- Blinds posted", timestamp: now - 60000 },
  { type: "action", handNumber: 1, agentName: "Claude", actionType: "raise", amount: 2.0, timestamp: now - 55000 },
  { type: "action", handNumber: 1, agentName: "Gemini", actionType: "call", amount: 2.0, timestamp: now - 50000 },
  { type: "action", handNumber: 1, agentName: "ChatGPT", actionType: "raise", amount: 6.0, timestamp: now - 45000 },
  { type: "action", handNumber: 1, agentName: "Claude", actionType: "call", amount: 6.0, timestamp: now - 40000 },
  { type: "action", handNumber: 1, agentName: "Gemini", actionType: "fold", timestamp: now - 35000 },
  { type: "deal", handNumber: 1, message: "Flop: A\u2660 K\u2665 7\u2663", timestamp: now - 30000 },
  { type: "action", handNumber: 1, agentName: "Claude", actionType: "check", timestamp: now - 25000 },
  { type: "action", handNumber: 1, agentName: "ChatGPT", actionType: "raise", amount: 8.0, timestamp: now - 20000 },
  { type: "action", handNumber: 1, agentName: "Claude", actionType: "call", amount: 8.0, timestamp: now - 15000 },
  { type: "showdown", handNumber: 1, agentName: "Claude", message: "Claude wins with two pair", timestamp: now - 10000 },
  { type: "payout", handNumber: 1, agentName: "Claude", amount: 32.0, message: "Claude wins $32.00", timestamp: now - 8000 },
  { type: "deal", handNumber: 2, message: "Dealing hand #2 -- Blinds posted", timestamp: now - 5000 },
  { type: "action", handNumber: 2, agentName: "Gemini", actionType: "raise", amount: 3.0, timestamp: now - 3000 },
  { type: "action", handNumber: 2, agentName: "ChatGPT", actionType: "call", amount: 3.0, timestamp: now - 1000 },
]

export function ActionFeed({ events = MOCK_EVENTS }: Partial<ActionFeedProps>) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [events.length])

  return (
    <div className="flex h-full flex-col bg-[#141414] p-4">
      {/* Header */}
      <div className="pb-4 border-b border-[#262626]">
        <h2 className="text-[13px] font-medium text-[#737373] uppercase tracking-wide">
          Action Feed
        </h2>
      </div>

      {/* Scrollable list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto mt-2">
        {events.map((event, i) => {
          const prevHand = i > 0 ? events[i - 1].handNumber : event.handNumber
          const showSeparator = i > 0 && event.handNumber !== prevHand

          const isSystemEvent = event.type === "deal" || event.type === "game_over"
          const agentStyle = isSystemEvent ? null : getAgentStyle(event.agentName)
          const action = getActionText(event)

          return (
            <div key={`${event.timestamp}-${i}`}>
              {/* Hand separator */}
              {showSeparator && (
                <div className="relative my-3">
                  <div className="border-t border-[#262626]" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <span className="bg-[#0a0a0a] px-3 py-0.5 text-[11px] font-mono text-[#737373] rounded-full">
                      Hand #{event.handNumber}
                    </span>
                  </div>
                </div>
              )}

              {/* Event row */}
              <div className="flex items-start gap-2 py-2.5">
                {/* Avatar */}
                {isSystemEvent ? (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#737373]">
                    <CardIcon />
                  </div>
                ) : (
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: agentStyle?.bg }}
                  >
                    <span className="text-[10px] font-bold text-white leading-none">
                      {agentStyle?.letter}
                    </span>
                  </div>
                )}

                {/* Timestamp */}
                <span className="shrink-0 text-[11px] font-mono text-[#737373] leading-5">
                  {formatTime(event.timestamp)}
                </span>

                {/* Action text */}
                <span className={`text-sm font-medium leading-5 ${action.className}`}>
                  {action.text}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
