"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useGame } from "@/hooks/use-game"
import { CardFace, CardBack, FlippableCard, type GlowType } from "@/components/game/playing-card"
import { AgentStatusBar } from "@/components/agent-status-bar"
import { ConnectWalletButton } from "@/components/connect-wallet-button"
import { BuyInModal } from "@/components/game/buyin-modal"
import { RebuyModal } from "@/components/game/rebuy-modal"
import { CardDealAnimation } from "@/components/game/card-animation"
import { ProbabilityBoard } from "@/components/game/probability-board"
import { useSelectedAgent } from "@/providers/selected-agent-provider"
import { explorerTxUrl, formatChip, formatChipBare, TOKEN_SYMBOL } from "@/lib/format"

// Hand-strength helpers for glow classification
function hasPairOrBetter(cards: string[]): boolean {
  if (cards.length < 2) return false
  const ranks = cards.map((c) => c.slice(0, -1))
  const freq = new Map<string, number>()
  for (const r of ranks) freq.set(r, (freq.get(r) ?? 0) + 1)
  for (const count of freq.values()) {
    if (count >= 2) return true
  }
  return false
}

function getAgentGlow(
  agentName: string,
  holeCards: string[] | null,
  communityCards: string[],
  winnerName: string | null,
  lastAction?: { type: string; amount?: number },
): GlowType {
  if (!holeCards || holeCards.length < 2) return "none"
  const allCards = [...holeCards, ...communityCards]
  const isWinner = agentName === winnerName
  const strong = hasPairOrBetter(allCards)
  const raised = lastAction?.type === "raise"
  if (isWinner) return "winner"
  if (strong) return "strong"
  if (!strong && raised) return "bluff"
  return "none"
}

// Seat positions — agents sit along the curved front edge of the table
const SEAT_POSITIONS: { bottom: string; left?: string; right?: string; transform: string }[] = [
  { bottom: "18%", left: "12%", transform: "translateX(-50%)" },   // front-left
  { bottom: "6%", left: "36%", transform: "translateX(-50%)" },    // front center-left (lower)
  { bottom: "6%", left: "64%", transform: "translateX(-50%)" },    // front center-right (lower)
  { bottom: "18%", right: "12%", transform: "translateX(50%)" },   // front-right
]

export default function GamePage() {
  const {
    events, agents, communityCards, pot, handNumber,
    gameOver, winner, running, connected, waitingForDeal, buyinDepleted,
    startGame, stopGame, dealNextHand, rebuy, rebuyTimeout,
  } = useGame()

  const { selectedAgent } = useSelectedAgent()
  const [buyInConfirmed, setBuyInConfirmed] = useState(false)
  const [buyInAmount, setBuyInAmount] = useState(0)
  const [winnerDismissed, setWinnerDismissed] = useState(false)
  const [gameOverDismissed, setGameOverDismissed] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState<{ from: string; text: string; time: number }[]>([])
  const [speechBubbles, setSpeechBubbles] = useState<Record<string, { text: string; key: number }>>({})
  const [dealComplete, setDealComplete] = useState(false)
  const [showdownRevealed, setShowdownRevealed] = useState(false)
  const [investments, setInvestments] = useState<Record<string, number>>({})
  const [flyingChips, setFlyingChips] = useState<{ id: number; agentIdx: number }[]>([])
  const logRef = useRef<HTMLDivElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const prevHandRef = useRef(0)
  const chipIdRef = useRef(0)

  const isShowdown = !!winner && !gameOver
  const shouldRevealCards = !!winner && showdownRevealed

  // Showdown reveal delay
  useEffect(() => {
    if (winner) {
      const t = setTimeout(() => setShowdownRevealed(true), 300)
      return () => clearTimeout(t)
    } else {
      setShowdownRevealed(false)
    }
  }, [winner])

  // Reset deal state on new hand
  useEffect(() => {
    if (handNumber !== prevHandRef.current) {
      setDealComplete(false)
      setInvestments({})
      setWinnerDismissed(false)
      prevHandRef.current = handNumber
    }
  }, [handNumber])

  // Track investments and trigger chip animation on call/raise
  useEffect(() => {
    const latest = events[events.length - 1]
    if (
      latest?.type === "action" &&
      latest.agentName &&
      latest.action &&
      (latest.action.action === "call" || latest.action.action === "raise") &&
      latest.action.message !== "thinking..."
    ) {
      const name = latest.agentName
      // Calls may have amount=0 — use 20 (big blind) as fallback
      const amount = latest.action.amount > 0 ? latest.action.amount : 20
      setInvestments(prev => ({ ...prev, [name]: (prev[name] ?? 0) + amount }))

      // Spawn flying chip
      const agentIdx = agents.findIndex(a => a.name === name)
      if (agentIdx >= 0) {
        const id = ++chipIdRef.current
        setFlyingChips(prev => [...prev, { id, agentIdx }])
        setTimeout(() => {
          setFlyingChips(prev => prev.filter(c => c.id !== id))
        }, 600)
      }
    }
  }, [events, agents])

  // Auto-scroll logs
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" })
  }, [events])

  // Add settlement tx links to chat — link points at our rollup indexer
  useEffect(() => {
    const latest = events[events.length - 1]
    if (latest?.type === "action" && latest.message === "settlement_complete" && latest.txHash) {
      const link = explorerTxUrl(latest.txHash)
      setChatMessages((prev) => [...prev.slice(-50), {
        from: "p0gi-1",
        text: `${latest.action?.message ?? "CHIP transfer"}\n🔗 ${link}`,
        time: Date.now(),
      }])
    }
    if (latest?.type === "action" && latest.message === "hand_recorded_onchain" && latest.txHash) {
      const link = explorerTxUrl(latest.txHash)
      setChatMessages((prev) => [...prev.slice(-50), {
        from: "game::record_hand",
        text: `HandSettled event emitted on-chain\n🔗 ${link}`,
        time: Date.now(),
      }])
    }
    if (latest?.type === "action" && latest.message === "settlement_failed") {
      setChatMessages((prev) => [...prev.slice(-50), {
        from: "p0gi-1",
        text: `❌ ${latest.action?.message ?? "Settlement failed"}`,
        time: Date.now(),
      }])
    }
  }, [events])

  // Add agent messages to chat + show speech bubbles
  useEffect(() => {
    const latest = events[events.length - 1]
    if (latest?.type === "action" && latest.action?.message && latest.action.message !== "thinking..." && latest.agentName && !latest.message?.startsWith("settlement")) {
      setChatMessages((prev) => [...prev.slice(-50), {
        from: latest.agentName ?? "Agent",
        text: latest.action!.message,
        time: Date.now(),
      }])
      // Speech bubble
      const agentName = latest.agentName
      const bubbleKey = Date.now()
      setSpeechBubbles((prev) => ({
        ...prev,
        [agentName]: { text: latest.action!.message, key: bubbleKey },
      }))
      setTimeout(() => {
        setSpeechBubbles((prev) => {
          if (prev[agentName]?.key === bubbleKey) {
            const next = { ...prev }
            delete next[agentName]
            return next
          }
          return prev
        })
      }, 3000)
    }
  }, [events])

  const sendChat = () => {
    if (!chatInput.trim()) return
    setChatMessages((prev) => [...prev, { from: "You", text: chatInput, time: Date.now() }])
    setChatInput("")
  }

  const feedEvents = events.filter(e => !(e.type === "action" && e.action?.message === "thinking..."))

  return (
    <div className="h-screen flex flex-col bg-[#060a10] overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────── */}
      <div className="h-12 bg-[#0c1018] border-b border-[#1a2236] px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/lobby" className="text-xs text-[#555] hover:text-white transition-colors">&larr; Lobby</Link>
          <div className="w-px h-4 bg-[#1a2236]" />
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`} />
          <span className="text-xs text-[#888]">{connected ? "Connected" : "Disconnected"}</span>
          {handNumber > 0 && (
            <>
              <div className="w-px h-4 bg-[#1a2236]" />
              <span className="text-xs font-mono text-[#888]">Hand #{handNumber}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <AgentStatusBar buyInCents={buyInConfirmed ? buyInAmount : undefined} />
          <ConnectWalletButton />
          {!running ? (
            buyInConfirmed ? (
              <button onClick={() => startGame(buyInAmount, selectedAgent?.name)} disabled={!connected} className="px-5 py-1.5 bg-[#76b900] hover:bg-[#8dd100] disabled:opacity-40 text-black text-xs font-bold rounded-lg transition-colors">
                Start Game
              </button>
            ) : null
          ) : (
            <button onClick={stopGame} className="px-5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors">
              Stop
            </button>
          )}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left: Action Log ────────────────────────────────────── */}
        <div className="w-72 border-r border-[#1a2236] flex flex-col shrink-0 hidden lg:flex">
          <div className="h-10 border-b border-[#1a2236] px-4 flex items-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#555]">Action Log</span>
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
            {feedEvents.length === 0 && (
              <p className="text-xs text-[#333] text-center py-8">Start a game to see actions here</p>
            )}
            {feedEvents.map((e, i) => {
              if (e.type === "deal" && e.message?.includes("Hand #")) {
                return (
                  <div key={i} className="text-[10px] text-[#76b900] font-bold uppercase tracking-wider py-2 border-b border-[#1a2236] mb-1">
                    {e.message}
                  </div>
                )
              }
              if (e.type === "deal" && e.communityCards?.length) {
                return (
                  <div key={i} className="text-[10px] text-[#555] py-1">
                    Board: {e.communityCards?.join(" ")}
                  </div>
                )
              }
              if (e.type === "action" && e.message === "settlement_complete") {
                return (
                  <div key={i} className="flex items-start gap-2 py-0.5">
                    <span className="text-[10px] text-[#444] font-mono w-10 shrink-0 text-right">
                      {new Date(e.timestamp).toLocaleTimeString().slice(0, 5)}
                    </span>
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold text-[#76b900]">settle</span>
                      {e.action?.message && (
                        <p className="text-[10px] text-[#555] truncate">{e.action.message}</p>
                      )}
                    </div>
                  </div>
                )
              }
              if (e.type === "action" && (
                e.message === "settlement_started" ||
                e.message === "settlement_failed" ||
                e.message === "hand_recorded_onchain"
              )) {
                const label =
                  e.message === "settlement_started"     ? "signing…" :
                  e.message === "settlement_failed"      ? "settle failed" :
                                                           "audit"
                const color = e.message === "settlement_failed" ? "text-red-400" : "text-[#888]"
                return (
                  <div key={i} className="flex items-start gap-2 py-0.5">
                    <span className="text-[10px] text-[#444] font-mono w-10 shrink-0 text-right">
                      {new Date(e.timestamp).toLocaleTimeString().slice(0, 5)}
                    </span>
                    <div className="min-w-0">
                      <span className={`text-[11px] font-semibold ${color}`}>{label}</span>
                      {e.action?.message && (
                        <p className="text-[10px] text-[#555] truncate">{e.action.message}</p>
                      )}
                    </div>
                  </div>
                )
              }
              if (e.type === "action" && e.agentName) {
                const actionColor =
                  e.action?.action === "raise" ? "text-amber-400" :
                  e.action?.action === "fold" ? "text-red-400" :
                  "text-[#76b900]"
                return (
                  <div key={i} className="flex items-start gap-2 py-0.5">
                    <span className="text-[10px] text-[#444] font-mono w-10 shrink-0 text-right">
                      {new Date(e.timestamp).toLocaleTimeString().slice(0, 5)}
                    </span>
                    <div className="min-w-0">
                      <span className={`text-[11px] font-semibold ${actionColor}`}>
                        {e.agentName} {e.action?.action}
                        {e.action?.amount ? ` ${formatChip(e.action.amount)}` : ""}
                      </span>
                      {e.action?.message && (
                        <p className="text-[10px] text-[#555] truncate">&ldquo;{e.action.message}&rdquo;</p>
                      )}
                    </div>
                  </div>
                )
              }
              if (e.type === "payout") {
                return (
                  <div key={i} className="bg-[#76b900]/5 border border-[#76b900]/20 rounded-lg p-2 my-1">
                    <span className="text-[11px] font-bold text-[#76b900]">
                      {e.winnerName} wins — {e.winnerHand} (pot: {formatChip(e.potAmount ?? 0)})
                    </span>
                  </div>
                )
              }
              return null
            })}
          </div>

          {/* Probability Board */}
          {running && agents.length > 0 && (
            <div className="border-t border-[#1a2236] p-3">
              <ProbabilityBoard agents={agents} communityCards={communityCards} pot={pot} />
            </div>
          )}
        </div>

        {/* ── Center: Poker Table ─────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden">
          {/* Dealer table image — anchored toward top, filling width */}
          <div className="absolute top-[-4%] left-1/2 -translate-x-1/2 pointer-events-none select-none" style={{ width: "110%", maxWidth: "1000px" }}>
            <img
              src="/dealerTable.png"
              alt="Poker table"
              className="w-full h-auto object-contain"
            />
          </div>

          {/* Card deal animation */}
          <CardDealAnimation
            agentCount={agents.length}
            handNumber={handNumber}
            onDealComplete={() => setDealComplete(true)}
          />

          {/* Cards + Pot on the table felt — positioned on the green area */}
          <div className="absolute top-[30%] left-[52%] -translate-x-1/2 text-center z-10">
            {/* Community cards */}
            <div className="flex gap-1.5 justify-center mb-3">
              {communityCards.length > 0
                ? communityCards.map((c, i) => <CardFace key={i} card={c} />)
                : Array.from({ length: 5 }).map((_, i) => <CardBack key={i} />)
              }
            </div>
            {/* Pot */}
            <div className="bg-[#0c1018]/80 backdrop-blur rounded-full px-4 py-1.5 inline-block border border-[#1a2236]">
              <span className="text-xs text-[#76b900] font-bold">Pot: {formatChip(pot)}</span>
            </div>
            {/* Chip stacks representing each agent's investment */}
            {Object.entries(investments).some(([, v]) => v > 0) && (
              <div className="flex items-center justify-center gap-3 mt-2">
                {agents.map((agent) => {
                  const inv = investments[agent.name] ?? 0
                  if (inv <= 0) return null
                  const chipCount = Math.min(Math.ceil(inv / 20), 5)
                  return (
                    <div key={agent.name} className="flex flex-col items-center gap-0.5">
                      <div className="flex flex-col-reverse items-center" style={{ gap: -2 }}>
                        {Array.from({ length: chipCount }).map((_, i) => (
                          <div
                            key={i}
                            className="w-5 h-2 rounded-sm border shadow-sm"
                            style={{
                              backgroundColor: agent.color,
                              borderColor: `${agent.color}88`,
                              marginTop: i > 0 ? -1 : 0,
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-[9px] font-mono text-[#888]">{formatChip(inv)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Agent seats */}
          {agents.map((agent, idx) => {
            const glow = shouldRevealCards
              ? getAgentGlow(agent.name, agent.holeCards, communityCards, winner?.name ?? null, agent.lastAction)
              : "none"

            return (
            <div
              key={agent.name}
              className="absolute z-10"
              style={SEAT_POSITIONS[idx]}
            >
              <div className={`flex flex-col items-center gap-1 transition-all duration-300 ${
                agent.isActive ? "scale-110" : ""
              }`}>
                {/* Speech bubble */}
                {speechBubbles[agent.name] && (
                  <div
                    key={speechBubbles[agent.name].key}
                    className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap z-20 animate-[fadeInOut_3s_ease-in-out_forwards]"
                  >
                    <div
                      className="rounded-lg px-3 py-1.5 text-[10px] text-white/90 max-w-[160px] truncate shadow-lg"
                      style={{
                        background: "#0c1018",
                        border: `1px solid ${agent.color}66`,
                        borderLeft: `3px solid ${agent.color}`,
                      }}
                    >
                      {speechBubbles[agent.name].text}
                    </div>
                  </div>
                )}
                {/* Avatar + hole cards row */}
                <div className="flex items-center gap-1.5">
                  {/* Hole cards — FlippableCard at showdown, CardBack during play */}
                  {dealComplete && agent.lastAction?.type !== "fold" && (
                    <div className="flex gap-1" style={{
                      animation: isShowdown && showdownRevealed
                        ? `showdown-entrance 300ms ease-out ${idx * 100}ms both`
                        : undefined,
                    }}>
                      {agent.holeCards && shouldRevealCards ? (
                        <>
                          <FlippableCard card={agent.holeCards[0]} revealed={showdownRevealed} glow={glow} delay={idx * 150} />
                          <FlippableCard card={agent.holeCards[1]} revealed={showdownRevealed} glow={glow} delay={idx * 150 + 100} />
                        </>
                      ) : (
                        <>
                          <CardBack />
                          <CardBack />
                        </>
                      )}
                    </div>
                  )}
                  {/* Avatar */}
                  <div className={`relative w-24 h-24 rounded-full overflow-hidden shadow-lg shrink-0 border-2 border-[#2a3a56] ${
                    agent.isActive ? "ring-2 ring-[#76b900] ring-offset-2 ring-offset-[#060a10]" : ""
                  }`}>
                    {agent.avatar ? (
                      <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" style={{ objectPosition: "center 15%", transform: "scale(1.55) translateY(10%)" }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg font-black text-white" style={{ background: `linear-gradient(135deg, ${agent.color}cc, ${agent.color}44)` }}>
                        {agent.letter}
                      </div>
                    )}
                    {agent.isThinking && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#0c1018] rounded-full flex items-center justify-center border border-[#2a3a56]">
                        <div className="w-3 h-3 border-2 border-[#76b900] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
                {/* Name + stack + action */}
                <div className="bg-[#0c1018]/90 backdrop-blur rounded-lg px-3 py-1 border border-[#1a2236] text-center min-w-[80px]">
                  <p className="text-[11px] font-bold text-white">
                    {agent.name}
                    {agent.isUser && <span className="text-[9px] text-[#76b900] ml-1">(you)</span>}
                  </p>
                  <p className="text-[10px] font-mono text-[#888]">
                    {agent.usdcBalance
                      ? `${parseFloat(agent.usdcBalance).toFixed(2)} ${TOKEN_SYMBOL}`
                      : formatChip(agent.stack)}
                  </p>
                  {buyInConfirmed && agent.name === selectedAgent?.name && (
                    <p className="text-[9px] font-mono text-[#76b900]/70">Buy-in: {formatChip(buyInAmount)}</p>
                  )}
                  {agent.lastAction && (
                    <p className={`text-[10px] font-semibold mt-0.5 ${
                      agent.lastAction.type === "raise" ? "text-amber-400" :
                      agent.lastAction.type === "fold" ? "text-red-400" :
                      "text-[#76b900]"
                    }`}>
                      {agent.lastAction.type}{agent.lastAction.amount ? ` ${formatChip(agent.lastAction.amount)}` : ""}
                    </p>
                  )}
                  {(investments[agent.name] ?? 0) > 0 && (
                    <p className="text-[9px] font-mono text-amber-400/70 mt-0.5">
                      Invested: {formatChip(investments[agent.name])}
                    </p>
                  )}
                </div>
              </div>
            </div>
            )
          })}

          {/* Flying chip animations */}
          {flyingChips.map(chip => {
            const seat = SEAT_POSITIONS[chip.agentIdx]
            if (!seat) return null
            // Compute direction toward the pot center (top ~30%, left ~52%)
            // Seats use bottom/left or bottom/right, so we approximate the offset
            const seatLeft = seat.left ? parseFloat(seat.left) : (100 - parseFloat(seat.right ?? "0"))
            const seatBottom = parseFloat(seat.bottom ?? "0")
            const dx = 52 - seatLeft // percentage toward pot X
            const dy = -(70 - seatBottom) // negative = upward toward pot Y (top 30% = bottom 70%)
            return (
              <div
                key={chip.id}
                className="absolute z-30 pointer-events-none"
                style={{
                  bottom: seat.bottom,
                  left: seat.left ?? "auto",
                  right: seat.right ?? "auto",
                  ["--chip-dx" as string]: `${dx}vw`,
                  ["--chip-dy" as string]: `${dy}vh`,
                  animation: "chip-fly 550ms ease-in forwards",
                }}
              >
                <div className="w-5 h-5 rounded-full bg-amber-400 border-2 border-amber-600 shadow-lg flex items-center justify-center text-[8px] font-bold text-amber-900">
                  $
                </div>
              </div>
            )
          })}

          {/* Winner overlay + Deal Next Hand */}
          {winner && !gameOver && !winnerDismissed && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-[#0c1018]/95 backdrop-blur border border-[#76b900]/30 rounded-2xl px-8 py-5 text-center shadow-2xl shadow-[#76b900]/10">
              {/* Close button */}
              <button
                onClick={() => setWinnerDismissed(true)}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-[#555] hover:text-white hover:bg-[#1a2236] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              </button>
              <div className="text-lg font-black text-[#76b900]">{winner.name} wins!</div>
              <div className="text-xs text-[#888] mt-0.5">{winner.handName} &mdash; pot: {formatChip(winner.potAmount)}</div>
              <div className="flex items-center justify-center gap-2 mt-3">
                {waitingForDeal && (
                  <button onClick={dealNextHand} className="px-5 py-1.5 bg-[#76b900] hover:bg-[#8dd100] text-black text-xs font-bold rounded-lg transition-colors">
                    Deal Next Hand
                  </button>
                )}
                <button onClick={() => setWinnerDismissed(true)} className="px-4 py-1.5 bg-[#1a2236] hover:bg-[#223050] border border-[#2a3a56] text-[#888] hover:text-white text-xs font-medium rounded-lg transition-colors">
                  View Cards
                </button>
              </div>
            </div>
          )}

          {/* Game over overlay */}
          {gameOver && !gameOverDismissed && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex items-center justify-center">
              <div className="relative bg-[#0c1018] border border-[#1a2236] rounded-3xl p-10 text-center max-w-md">
                {/* Close button */}
                <button
                  onClick={() => setGameOverDismissed(true)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[#555] hover:text-white hover:bg-[#1a2236] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                </button>
                <div className="text-4xl mb-4">🏆</div>
                <h2 className="text-2xl font-black text-white mb-2">Game Over</h2>
                {winner && <p className="text-[#76b900] font-bold text-lg mb-4">{winner.name} wins!</p>}
                <div className="space-y-2 mb-6">
                  {agents.map((a) => (
                    <div key={a.name} className="flex items-center justify-between text-sm">
                      <span className="text-[#888]">{a.name}</span>
                      <span className="font-mono text-white">{formatChip(a.stack)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => { setBuyInConfirmed(false); setGameOverDismissed(false); }} className="px-6 py-2.5 bg-[#76b900] hover:bg-[#8dd100] text-black text-sm font-bold rounded-xl transition-colors">
                    Play Again
                  </button>
                  <Link href="/lobby" className="px-6 py-2.5 bg-[#1a2236] hover:bg-[#223050] text-white text-sm font-semibold rounded-xl transition-colors border border-[#2a3a56]">
                    Lobby
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Live Chat ────────────────────────────────────── */}
        <div className="w-80 border-l border-[#1a2236] flex flex-col shrink-0 hidden lg:flex">
          <div className="h-10 border-b border-[#1a2236] px-4 flex items-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#555]">Live Chat</span>
          </div>
          <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
            {chatMessages.length === 0 && (
              <p className="text-xs text-[#333] text-center py-8">Agent trash talk appears here during the game</p>
            )}
            {chatMessages.map((msg, i) => {
              const isUser = msg.from === "You"
              const isSettlement = msg.from === "Settlement"
              return (
                <div key={i} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                  <span className={`text-[10px] mb-0.5 ${isSettlement ? "text-[#76b900]" : "text-[#555]"}`}>{msg.from}</span>
                  <div className={`max-w-[85%] rounded-xl px-3 py-1.5 text-xs whitespace-pre-wrap break-all ${
                    isUser
                      ? "bg-[#76b900]/20 text-[#76b900]"
                      : isSettlement
                        ? "bg-[#76b900]/10 border border-[#76b900]/20 text-[#ccc]"
                        : "bg-[#1a2236] text-[#ccc]"
                  }`}>
                    {msg.text.split("\n").map((line, j) =>
                      line.startsWith("🔗 http") ? (
                        <a key={j} href={line.replace("🔗 ", "")} target="_blank" rel="noopener noreferrer" className="text-[#76b900] hover:underline block">
                          🔗 0G Explorer ↗
                        </a>
                      ) : <span key={j}>{line}{j < msg.text.split("\n").length - 1 ? "\n" : ""}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="p-3 border-t border-[#1a2236]">
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                placeholder="Type a message..."
                className="flex-1 bg-[#060a10] border border-[#1a2236] rounded-lg h-9 px-3 text-xs text-white placeholder:text-[#333] outline-none focus:border-[#2a3a56]"
              />
              <button onClick={sendChat} className="px-3 h-9 bg-[#1a2236] hover:bg-[#223050] border border-[#2a3a56] rounded-lg text-xs text-white/70 hover:text-white transition-all">
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Buy-in Modal — shown on entry before game starts */}
      {selectedAgent && !buyInConfirmed && !running && !gameOver && (
        <BuyInModal
          open={!buyInConfirmed && !running && !gameOver}
          onConfirm={(amount) => {
            setBuyInAmount(amount)
            setBuyInConfirmed(true)
          }}
          agentName={selectedAgent.name}
          agentColor={selectedAgent.color}
          walletAddress={selectedAgent.walletAddress}
          usdcBalance={selectedAgent.balances ? Math.floor(parseFloat(selectedAgent.balances.usdc) * 100) : 0}
          minBuyCents={20}
        />
      )}

      {/* Rebuy Modal — shown when user's agent stack hits 0 */}
      {selectedAgent && buyinDepleted && (
        <RebuyModal
          open={buyinDepleted}
          onRebuy={(amount) => {
            rebuy(amount)
          }}
          onTimeout={() => {
            rebuyTimeout()
          }}
          onLeave={() => {
            stopGame()
            window.location.href = "/lobby"
          }}
          agentName={selectedAgent.name}
          agentColor={selectedAgent.color}
          walletAddress={selectedAgent.walletAddress}
          usdcBalance={selectedAgent.balances ? Math.floor(parseFloat(selectedAgent.balances.usdc) * 100) : 0}
          timeoutSeconds={30}
        />
      )}
    </div>
  )
}
