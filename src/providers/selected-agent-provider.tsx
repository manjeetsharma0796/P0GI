"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"

const AGENT_NAMES = ["Llama", "Mistral", "Nemotron", "Qwen"] as const
type AgentName = (typeof AGENT_NAMES)[number]

const DEFAULT_MODELS: Record<AgentName, string> = {
  Llama: "meta/llama-3.3-70b-instruct",
  Mistral: "mistralai/mistral-small-4-119b-2603",
  Nemotron: "nvidia/llama-3.3-nemotron-super-49b-v1",
  Qwen: "meta/llama-3.1-8b-instruct",
}

// Agent wallet addresses on 0G Galileo Testnet (chain 16602)
const AGENT_WALLETS: Record<AgentName, string> = {
  Llama: "0x204f4516015905772B7e5c3f1ae42eA6C17Afd38",
  Mistral: "0x8e46aB328B2b2E35C4dC84432dfa86e273f22612",
  Nemotron: "0x4f40B47eb826b69136f68E0D36B94229313d12A1",
  Qwen: "0x4BCc33Eb36fbbf25dDcF26cf485FA08049d44fAb",
}

const AGENT_COLORS: Record<AgentName, string> = {
  Llama: "#d97706",
  Mistral: "#ef4444",
  Nemotron: "#3b82f6",
  Qwen: "#10b981",
}

export interface AgentIdentity {
  index: number
  name: AgentName
  modelId: string
  apiKey?: string
  walletAddress: string
  color: string
  balances: { usdc: string; eth: string } | null
}

interface SelectedAgentContextType {
  selectedAgent: AgentIdentity | null
  agents: AgentIdentity[]
  selectAgent: (index: number) => void
  updateModel: (modelId: string, apiKey?: string) => void
  clearAgent: () => void
}

const SelectedAgentContext = createContext<SelectedAgentContextType>({
  selectedAgent: null,
  agents: [],
  selectAgent: () => {},
  updateModel: () => {},
  clearAgent: () => {},
})

export function useSelectedAgent() {
  return useContext(SelectedAgentContext)
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch { return fallback }
}

export function SelectedAgentProvider({ children }: { children: ReactNode }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(() => loadFromStorage("agent_index", null))
  const [modelOverrides, setModelOverrides] = useState<Partial<Record<AgentName, { modelId: string; apiKey?: string }>>>(() => loadFromStorage("agent_models", {}))
  const [balances, setBalances] = useState<Record<AgentName, { usdc: string; eth: string } | null>>({
    Llama: null,
    Mistral: null,
    Nemotron: null,
    Qwen: null,
  })

  // Persist selection to localStorage
  useEffect(() => {
    localStorage.setItem("agent_index", JSON.stringify(selectedIndex))
  }, [selectedIndex])

  useEffect(() => {
    localStorage.setItem("agent_models", JSON.stringify(modelOverrides))
  }, [modelOverrides])

  const buildAgents = useCallback((): AgentIdentity[] => {
    return AGENT_NAMES.map((name, index) => {
      const override = modelOverrides[name]
      return {
        index,
        name,
        modelId: override?.modelId ?? DEFAULT_MODELS[name],
        apiKey: override?.apiKey,
        walletAddress: AGENT_WALLETS[name],
        color: AGENT_COLORS[name],
        balances: balances[name],
      }
    })
  }, [modelOverrides, balances])

  const fetchBalances = useCallback(async () => {
    const results = await Promise.allSettled(
      AGENT_NAMES.map(async (name) => {
        const res = await fetch(`/api/balance?address=${AGENT_WALLETS[name]}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        return { name, usdc: data.usdc as string, eth: data.eth as string }
      })
    )

    setBalances((prev) => {
      const next = { ...prev }
      for (const result of results) {
        if (result.status === "fulfilled") {
          next[result.value.name] = { usdc: result.value.usdc, eth: result.value.eth }
        }
      }
      return next
    })
  }, [])

  useEffect(() => {
    fetchBalances()
    const interval = setInterval(fetchBalances, 30_000)
    return () => clearInterval(interval)
  }, [fetchBalances])

  const agents = buildAgents()

  const selectedAgent = selectedIndex !== null ? (agents[selectedIndex] ?? null) : null

  const selectAgent = useCallback((index: number) => {
    setSelectedIndex((prev) => (prev === index ? null : index))
  }, [])

  const updateModel = useCallback((modelId: string, apiKey?: string) => {
    if (selectedIndex === null) return
    const name = AGENT_NAMES[selectedIndex]
    setModelOverrides((prev) => ({
      ...prev,
      [name]: { modelId, apiKey },
    }))
  }, [selectedIndex])

  const clearAgent = useCallback(() => {
    setSelectedIndex(null)
  }, [])

  return (
    <SelectedAgentContext.Provider value={{ selectedAgent, agents, selectAgent, updateModel, clearAgent }}>
      {children}
    </SelectedAgentContext.Provider>
  )
}
