"use client"

import { useEffect, useState, useCallback } from "react"
import { useSocket } from "@/providers/socket-provider"
import { toast } from "sonner"
import { explorerTxUrl } from "@/lib/format"

interface AgentState {
  name: string
  letter: string
  color: string
  stack: number
  walletAddress: string
  usdcBalance: string | null
  ethBalance: string | null
  holeCards: [string, string] | null
  lastAction?: { type: "fold" | "call" | "raise" | "check"; amount?: number; message?: string }
  isActive: boolean
  isThinking: boolean
  skillEmoji?: string
  avatar: string
  isUser?: boolean
}

interface GameEvent {
  type: "action" | "deal" | "showdown" | "payout" | "game_over"
  handNumber: number
  agentName?: string
  action?: { action: string; amount: number; message: string }
  message?: string
  timestamp: number
  communityCards?: string[]
  stacks?: Record<string, number>
  winnerName?: string
  winnerHand?: string
  potAmount?: number
  txHash?: string
  holeCards?: Record<string, [string, string]>
}

interface Winner {
  name: string
  letter: string
  color: string
  potAmount: number
  handName?: string
}

const AGENT_CONFIGS: Record<string, { letter: string; color: string; emoji: string; avatar: string; wallet: string }> = {
  Llama:    { letter: "L", color: "#d97706", emoji: "\u{1F988}", avatar: "/1.png", wallet: "0x51dA09aB2EF760314a489D35b8207657cF471284" },
  Mistral:  { letter: "M", color: "#ef4444", emoji: "\u{1F0CF}", avatar: "/2.png", wallet: "0x2F445DB3961E33d6500537Cd796b4812CBf7Db6b" },
  Nemotron: { letter: "N", color: "#3b82f6", emoji: "\u{1F9EE}", avatar: "/3.png", wallet: "0x765A6824A400f714a59d99FbF4A04C252A5E328e" },
  Qwen:     { letter: "Q", color: "#10b981", emoji: "\u{1F525}", avatar: "/4.png", wallet: "0xcA10A9910b62979eDA09A92CB78720fF67ffdb00" },
}

function agentConfig(name: string) {
  return AGENT_CONFIGS[name] ?? { letter: "?", color: "#737373", emoji: "?", avatar: "" }
}

export function useGame() {
  const { socket, connected } = useSocket()
  const [events, setEvents] = useState<GameEvent[]>([])
  const [agents, setAgents] = useState<AgentState[]>(
    Object.entries(AGENT_CONFIGS).map(([name, cfg]) => ({
      name,
      letter: cfg.letter,
      color: cfg.color,
      skillEmoji: cfg.emoji,
      avatar: cfg.avatar,
      walletAddress: cfg.wallet,
      usdcBalance: null,
      ethBalance: null,
      stack: 1000,
      holeCards: null,
      isActive: false,
      isThinking: false,
    }))
  )

  // Fetch real on-chain balances on mount
  useEffect(() => {
    async function fetchBalances() {
      const results = await Promise.allSettled(
        Object.entries(AGENT_CONFIGS).map(async ([name, cfg]) => {
          const res = await fetch(`/api/balance?address=${cfg.wallet}`)
          const data = await res.json()
          return { name, usdc: data.usdc as string, eth: data.eth as string }
        })
      )
      setAgents(prev => prev.map(a => {
        const result = results.find(
          r => r.status === "fulfilled" && r.value.name === a.name
        )
        if (result?.status === "fulfilled") {
          const usdcCents = Math.round(parseFloat(result.value.usdc) * 100)
          return {
            ...a,
            usdcBalance: result.value.usdc,
            ethBalance: result.value.eth,
            stack: usdcCents > 0 ? usdcCents : a.stack,
          }
        }
        return a
      }))
    }
    fetchBalances()
  }, [])
  const [communityCards, setCommunityCards] = useState<string[]>([])
  const [pot, setPot] = useState(0)
  const [handNumber, setHandNumber] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [winner, setWinner] = useState<Winner | null>(null)
  const [running, setRunning] = useState(false)
  const [waitingForDeal, setWaitingForDeal] = useState(false)
  const [buyinDepleted, setBuyinDepleted] = useState(false)

  const handleGameEvent = useCallback((event: GameEvent) => {
    setEvents(prev => [...prev.slice(-100), { ...event, timestamp: Date.now() }])

    if (event.handNumber) setHandNumber(event.handNumber)

    if (event.stacks) {
      setAgents(prev => prev.map(a => ({
        ...a,
        stack: event.stacks?.[a.name] ?? a.stack,
      })))
    }

    if (event.type === "deal" && event.communityCards) {
      setCommunityCards(event.communityCards)
    }

    // New hand — reset
    if (event.type === "deal" && event.message?.includes("Hand #")) {
      setCommunityCards([])
      setPot(0)
      setWinner(null)
      setAgents(prev => prev.map(a => ({
        ...a,
        lastAction: undefined,
        holeCards: null,
        isActive: false,
        isThinking: false,
        stack: event.stacks?.[a.name] ?? a.stack,
      })))
    }

    // Update pot from any event that includes it
    if (event.potAmount !== undefined && event.potAmount > 0) {
      setPot(event.potAmount)
    }

    // Agent action
    if (event.type === "action" && event.agentName && event.action) {
      const actionType = event.action.action as "fold" | "call" | "raise"
      if (event.action.message === "thinking...") {
        setAgents(prev => prev.map(a => ({
          ...a,
          isActive: a.name === event.agentName,
          isThinking: a.name === event.agentName,
        })))
      } else {
        setAgents(prev => prev.map(a => ({
          ...a,
          isActive: false,
          isThinking: false,
          ...(a.name === event.agentName ? {
            lastAction: { type: actionType, amount: event.action!.amount, message: event.action!.message },
          } : {}),
        })))
      }
    }

    // Payout — reveal hole cards if provided
    if (event.type === "payout" && event.winnerName) {
      const cfg = agentConfig(event.winnerName)
      setPot(event.potAmount ?? 0)
      setWinner({
        name: event.winnerName,
        letter: cfg.letter,
        color: cfg.color,
        potAmount: event.potAmount ?? 0,
        handName: event.winnerHand,
      })

      // Set hole cards from event if available
      if (event.holeCards) {
        setAgents(prev => prev.map(a => ({
          ...a,
          holeCards: event.holeCards?.[a.name] ?? a.holeCards,
        })))
      }

      // Sonner toast — link to our rollup indexer
      if (event.txHash) {
        const txUrl = explorerTxUrl(event.txHash)
        toast.success("✅ Hand settled on-chain", {
          description: `${event.message}`,
          duration: 15000,
          action: {
            label: "View on agentbet-1 ↗",
            onClick: () => window.open(txUrl, "_blank"),
          },
          style: { background: "#0c1018", border: "1px solid #76b900", color: "#fff" },
        })
      }
    }

    // Individual settlement — each loser's transfer gets its own toast
    if (event.type === "action" && (event.message === "settlement_complete" || event.message === "settlement_failed")) {
      toast.dismiss("settlement-loading")
    }
    if (event.type === "action" && event.message === "settlement_complete" && event.txHash) {
      const txUrl = explorerTxUrl(event.txHash)
      toast.success("✅ CHIP transfer confirmed", {
        description: `${event.action?.message}\ntx: ${event.txHash.slice(0, 18)}...`,
        duration: 15000,
        action: {
          label: "View tx ↗",
          onClick: () => window.open(txUrl, "_blank"),
        },
        style: {
          background: "#0c1018",
          border: "1px solid #76b900",
          color: "#fff",
        },
      })
    }
    if (event.type === "action" && event.message === "hand_recorded_onchain" && event.txHash) {
      const txUrl = explorerTxUrl(event.txHash)
      toast("📝 HandSettled event emitted", {
        description: `agentbet::game::record_hand\ntx: ${event.txHash.slice(0, 18)}...`,
        duration: 10000,
        action: {
          label: "View ↗",
          onClick: () => window.open(txUrl, "_blank"),
        },
        style: { background: "#0c1018", border: "1px solid #1a2236", color: "#bbb" },
      })
    }

    // Settlement failed
    if (event.type === "action" && event.message === "settlement_failed") {
      toast.error("❌ Settlement Failed", {
        description: event.action?.message,
        duration: 15000,
        style: { background: "#0c1018", border: "1px solid #ef4444", color: "#ef4444" },
      })
    }

    // Settlement started — loading spinner
    if (event.type === "action" && event.message === "settlement_started") {
      toast.loading("⏳ Signing & broadcasting on-chain settlement...", {
        id: "settlement-loading",
        duration: 30000,
        style: { background: "#0c1018", border: "1px solid #1a2236", color: "#888" },
      })
    }

    // Waiting for user to deal next hand
    if (event.type === "action" && event.message === "waiting_for_user") {
      setWaitingForDeal(true)
    }

    // User's agent ran out of buy-in
    if (event.type === "action" && event.message === "buyin_depleted") {
      setBuyinDepleted(true)
    }

    if (event.type === "game_over") {
      setGameOver(true)
      setRunning(false)
      // Dismiss any lingering settlement toasts
      toast.dismiss("settlement-loading")
    }
  }, [])

  const startGame = useCallback((buyInCents?: number, userAgent?: string) => {
    if (!socket || !connected) return
    socket.emit("start_game", { buyInCents, userAgent })
    setGameOver(false)
    setBuyinDepleted(false)
    setEvents([])
    setHandNumber(0)
    setCommunityCards([])
    setPot(0)
    setWinner(null)
  }, [socket, connected])

  const stopGame = useCallback(() => {
    if (!socket || !connected) return
    socket.emit("stop_game")
  }, [socket, connected])

  const rebuy = useCallback((amount: number) => {
    if (!socket || !connected) return
    socket.emit("rebuy", { amount })
    setBuyinDepleted(false)
  }, [socket, connected])

  const rebuyTimeout = useCallback(() => {
    if (!socket || !connected) return
    socket.emit("rebuy_timeout")
    setBuyinDepleted(false)
  }, [socket, connected])

  const dealNextHand = useCallback(() => {
    if (!socket || !connected) return
    socket.emit("deal_next_hand")
    setWinner(null)
    setWaitingForDeal(false)
  }, [socket, connected])

  const configureAgents = useCallback((configs: { seatIndex: number; modelId: string; skillId: string; isUser?: boolean }[]) => {
    if (!socket || !connected) return
    socket.emit("configure_agents", configs)
    const userSeat = configs.find(c => c.isUser)
    if (userSeat !== undefined) {
      setAgents(prev => prev.map((a, i) => ({ ...a, isUser: i === userSeat.seatIndex })))
    }
  }, [socket, connected])

  useEffect(() => {
    if (!socket || !connected) return

    socket.on("game_event", handleGameEvent)
    socket.on("game_status", (status: { running: boolean }) => {
      setRunning(status.running)
    })

    return () => {
      socket.off("game_event", handleGameEvent)
      socket.off("game_status")
    }
  }, [socket, connected, handleGameEvent])

  return {
    events, agents, communityCards, pot, handNumber,
    gameOver, winner, running, connected, waitingForDeal, buyinDepleted,
    startGame, stopGame, dealNextHand, configureAgents, rebuy, rebuyTimeout,
  }
}
