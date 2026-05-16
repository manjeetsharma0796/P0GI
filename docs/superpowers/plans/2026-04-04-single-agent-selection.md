# Single Agent Selection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the agents page from multi-select to single-select character picker, add a persistent top-right status bar showing the selected agent's info across all dashboard pages, and upgrade the chat modal to support real multi-turn LLM conversations.

**Architecture:** React context provider (`SelectedAgentProvider`) wraps the dashboard layout, exposing selected agent state to all child pages. A new `AgentStatusBar` component renders in the dashboard layout header. The agents page becomes a character-select screen with single-click selection, model switching, and a full test-chat modal.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, TypeScript, sonner (toasts), existing `/api/balance` endpoint, new `/api/test-agent` route for multi-turn chat.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/providers/selected-agent-provider.tsx` | React context: selected agent state, model switching, balance polling |
| `src/components/agent-status-bar.tsx` | Persistent top-right bar: agent name, model, wallet, balances |
| `src/app/api/test-agent/route.ts` | API route for multi-turn test chat with any model |

### Modified Files
| File | Changes |
|------|---------|
| `src/app/(dashboard)/layout.tsx` | Wrap with `SelectedAgentProvider`, add `AgentStatusBar` |
| `src/app/(dashboard)/agents/page.tsx` | Full rewrite: single-select character cards, model dropdown, test chat button |
| `src/app/(dashboard)/skills/page.tsx` | Show selected agent name in header, toast if no agent |
| `src/components/chat-modal.tsx` | Accept `modelId`/`apiKey` props, call `/api/test-agent` for real LLM responses with timing |

---

## Task 1: Create SelectedAgentProvider

**Files:**
- Create: `src/providers/selected-agent-provider.tsx`

- [ ] **Step 1: Create the provider file**

```tsx
"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"

// ─── Agent definitions (fixed characters) ───────────────────────────────────
const AGENT_NAMES = ["Llama", "Mistral", "Nemotron", "Qwen"] as const
type AgentName = (typeof AGENT_NAMES)[number]

const DEFAULT_MODELS: Record<AgentName, string> = {
  Llama: "meta/llama-3.3-70b-instruct",
  Mistral: "mistralai/mistral-small-4-119b-2603",
  Nemotron: "nvidia/llama-3.3-nemotron-super-49b-v1",
  Qwen: "meta/llama-3.1-8b-instruct",
}

const AGENT_WALLETS: Record<AgentName, string> = {
  Llama: "0x51dA09aB2EF760314a489D35b8207657cF471284",
  Mistral: "0x2F445DB3961E33d6500537Cd796b4812CBf7Db6b",
  Nemotron: "0x765A6824A400f714a59d99FbF4A04C252A5E328e",
  Qwen: "0xcA10A9910b62979eDA09A92CB78720fF67ffdb00",
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

export function SelectedAgentProvider({ children }: { children: ReactNode }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [modelOverrides, setModelOverrides] = useState<Record<number, { modelId: string; apiKey?: string }>>({})
  const [balances, setBalances] = useState<Record<string, { usdc: string; eth: string }>>({})

  // Build agent list
  const agents: AgentIdentity[] = AGENT_NAMES.map((name, index) => {
    const override = modelOverrides[index]
    return {
      index,
      name,
      modelId: override?.modelId ?? DEFAULT_MODELS[name],
      apiKey: override?.apiKey,
      walletAddress: AGENT_WALLETS[name],
      color: AGENT_COLORS[name],
      balances: balances[AGENT_WALLETS[name]] ?? null,
    }
  })

  const selectedAgent = selectedIndex !== null ? agents[selectedIndex] : null

  // Poll balances every 30s
  useEffect(() => {
    const fetchBalances = async () => {
      for (const name of AGENT_NAMES) {
        const address = AGENT_WALLETS[name]
        try {
          const res = await fetch(`/api/balance?address=${address}`)
          const data = await res.json()
          setBalances(prev => ({ ...prev, [address]: { usdc: data.usdc, eth: data.eth } }))
        } catch { /* ignore */ }
      }
    }
    fetchBalances()
    const interval = setInterval(fetchBalances, 30000)
    return () => clearInterval(interval)
  }, [])

  const selectAgent = useCallback((index: number) => {
    setSelectedIndex(prev => (prev === index ? null : index))
  }, [])

  const updateModel = useCallback((modelId: string, apiKey?: string) => {
    if (selectedIndex === null) return
    setModelOverrides(prev => ({ ...prev, [selectedIndex]: { modelId, apiKey } }))
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
```

- [ ] **Step 2: Verify file compiles**

Run: `cd /c/workspace/claude-adding-skill/poker-night-ai && bunx tsc --noEmit src/providers/selected-agent-provider.tsx 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/providers/selected-agent-provider.tsx
git commit -m "feat(ui): add SelectedAgentProvider context for single agent selection"
```

---

## Task 2: Create AgentStatusBar

**Files:**
- Create: `src/components/agent-status-bar.tsx`

- [ ] **Step 1: Create the status bar component**

```tsx
"use client"

import { useState, useCallback } from "react"
import { useSelectedAgent } from "@/providers/selected-agent-provider"
import Link from "next/link"

// Model display name lookup
const MODEL_NAMES: Record<string, string> = {
  "meta/llama-3.3-70b-instruct": "Llama 3.3 70B",
  "mistralai/mistral-small-4-119b-2603": "Mistral Small 4",
  "nvidia/llama-3.3-nemotron-super-49b-v1": "Nemotron 49B",
  "meta/llama-3.1-8b-instruct": "Llama 3.1 8B",
  "claude-sonnet-4-20250514": "Claude Sonnet",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gpt-4o": "GPT-4o",
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function AgentStatusBar() {
  const { selectedAgent } = useSelectedAgent()
  const [copied, setCopied] = useState(false)

  const copyAddress = useCallback((addr: string) => {
    navigator.clipboard?.writeText(addr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  if (!selectedAgent) {
    return (
      <Link
        href="/agents"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0c1018] border border-[#1a2236] hover:border-[#2a3a56] transition-colors"
      >
        <div className="w-2 h-2 rounded-full bg-[#555]" />
        <span className="text-xs text-[#555]">No agent selected</span>
      </Link>
    )
  }

  const modelName = MODEL_NAMES[selectedAgent.modelId] ?? selectedAgent.modelId.split("/").pop()

  return (
    <Link
      href="/agents"
      className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#0c1018] border border-[#1a2236] hover:border-[#2a3a56] transition-colors"
    >
      {/* Agent avatar dot */}
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedAgent.color }} />
        <span className="text-sm font-bold text-white">{selectedAgent.name}</span>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-[#1a2236]" />

      {/* Model */}
      <span className="text-xs text-[#888] font-mono">{modelName}</span>

      {/* Divider */}
      <div className="w-px h-5 bg-[#1a2236]" />

      {/* Wallet + copy */}
      <div className="flex items-center gap-1.5">
        <code className="text-[11px] text-[#666] font-mono">{truncateAddress(selectedAgent.walletAddress)}</code>
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            copyAddress(selectedAgent.walletAddress)
          }}
          className="text-[#555] hover:text-white transition-colors p-0.5 rounded hover:bg-[#1a2236]"
          title="Copy address"
        >
          {copied ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#76b900" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-[#1a2236]" />

      {/* Balances */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-white/70">
          {selectedAgent.balances
            ? `${parseFloat(selectedAgent.balances.usdc).toFixed(2)} USDC`
            : "..."}
        </span>
        {selectedAgent.balances && parseFloat(selectedAgent.balances.eth) > 0 && (
          <span className="text-[10px] font-mono text-[#555]">
            {parseFloat(selectedAgent.balances.eth).toFixed(4)} ETH
          </span>
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agent-status-bar.tsx
git commit -m "feat(ui): add AgentStatusBar component for persistent top-right display"
```

---

## Task 3: Wire Provider + StatusBar into Dashboard Layout

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Update the dashboard layout**

Replace the entire contents of `src/app/(dashboard)/layout.tsx` with:

```tsx
import { Sidebar } from "@/components/sidebar"
import { AgentStatusBar } from "@/components/agent-status-bar"
import { SelectedAgentProvider } from "@/providers/selected-agent-provider"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SelectedAgentProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-auto">
          {/* Top bar with agent status */}
          <header className="sticky top-0 z-30 flex items-center justify-end px-6 py-3 bg-[#060a10]/80 backdrop-blur-sm border-b border-[#1a2236]/50">
            <AgentStatusBar />
          </header>
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
        </div>
      </div>
    </SelectedAgentProvider>
  )
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd /c/workspace/claude-adding-skill/poker-night-ai && bun run build 2>&1 | tail -20`

If there are type errors, fix them before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/layout.tsx
git commit -m "feat(ui): wire SelectedAgentProvider and AgentStatusBar into dashboard layout"
```

---

## Task 4: Create /api/test-agent Route for Multi-Turn Chat

**Files:**
- Create: `src/app/api/test-agent/route.ts`

- [ ] **Step 1: Create the API route**

This route accepts a `POST` with `modelId`, optional `apiKey`, and `messages` array. It calls the NVIDIA NIM endpoint (or the premium model's API) and streams back the response.

```ts
import { NextRequest, NextResponse } from "next/server"

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"

// Premium model base URLs
const PREMIUM_ENDPOINTS: Record<string, { url: string; defaultModel: string }> = {
  "gemini-2.5-flash": { url: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-2.5-flash" },
  "gpt-4o": { url: "https://api.openai.com/v1", defaultModel: "gpt-4o" },
  "claude-sonnet-4-20250514": { url: "https://api.anthropic.com/v1", defaultModel: "claude-sonnet-4-20250514" },
}

interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { modelId, apiKey, messages } = (await req.json()) as {
      modelId: string
      apiKey?: string
      messages: ChatMessage[]
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 })
    }

    const premium = PREMIUM_ENDPOINTS[modelId]
    const baseUrl = premium ? premium.url : NVIDIA_BASE_URL
    const key = premium ? apiKey : (process.env.NVIDIA_API_KEY || apiKey)

    if (!key) {
      return NextResponse.json({ error: "API key required" }, { status: 400 })
    }

    // Add system message for poker context
    const systemMessage: ChatMessage = {
      role: "system",
      content: "You are an AI poker agent. You're chatting with a potential player who wants to test your intelligence and response speed. Be concise, witty, and show poker knowledge. Keep responses under 3 sentences.",
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [systemMessage, ...messages],
        max_tokens: 150,
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Model API error: ${err.slice(0, 200)}` }, { status: res.status })
    }

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content ?? "No response"

    return NextResponse.json({ reply })
  } catch (e: any) {
    return NextResponse.json({ error: e.message?.slice(0, 200) ?? "Unknown error" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/test-agent/route.ts
git commit -m "feat(api): add /api/test-agent route for multi-turn LLM chat"
```

---

## Task 5: Upgrade ChatModal for Real LLM Conversations

**Files:**
- Modify: `src/components/chat-modal.tsx`

- [ ] **Step 1: Rewrite chat-modal.tsx**

Replace the entire contents of `src/components/chat-modal.tsx`. Key changes:
- Accept `modelId` and `apiKey` props
- Call `/api/test-agent` with the full message history
- Show response time per agent message
- Remove mock responses

```tsx
"use client"

import { useState, useRef, useEffect, useCallback } from "react"

interface Message {
  id: string
  role: "user" | "agent"
  text: string
  responseMs?: number
}

interface ChatModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  avatarColor?: string
  avatarLetter?: string
  modelId: string
  apiKey?: string
}

export function ChatModal({
  open,
  onClose,
  title,
  subtitle,
  avatarColor = "#22c55e",
  avatarLetter = "A",
  modelId,
  apiKey,
}: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      setMessages([])
    }
  }, [open])

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || sending) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput("")
    setSending(true)

    const start = Date.now()
    try {
      const apiMessages = updatedMessages.map(m => ({
        role: m.role === "user" ? "user" as const : "assistant" as const,
        content: m.text,
      }))

      const res = await fetch("/api/test-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, apiKey, messages: apiMessages }),
      })

      const data = await res.json()
      const ms = Date.now() - start

      const agentMsg: Message = {
        id: crypto.randomUUID(),
        role: "agent",
        text: data.reply || data.error || "No response",
        responseMs: ms,
      }
      setMessages(prev => [...prev, agentMsg])
    } catch {
      const agentMsg: Message = {
        id: crypto.randomUUID(),
        role: "agent",
        text: "Connection failed. Is the server running?",
        responseMs: Date.now() - start,
      }
      setMessages(prev => [...prev, agentMsg])
    }
    setSending(false)
  }, [input, sending, messages, modelId, apiKey])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

  if (!open) return null

  const canSend = input.trim().length > 0 && !sending

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={handleBackdropClick}
    >
      <div
        className="flex flex-col rounded-2xl border"
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "75vh",
          backgroundColor: "#0c1018",
          borderColor: "#1a2236",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between shrink-0"
          style={{ padding: 16, borderBottom: "1px solid #1a2236" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="shrink-0 flex items-center justify-center rounded-full text-white font-bold"
              style={{
                width: 32,
                height: 32,
                backgroundColor: avatarColor,
                fontSize: 14,
              }}
            >
              {avatarLetter}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-white truncate" style={{ fontSize: 15 }}>
                {title}
              </span>
              {subtitle && (
                <span className="truncate" style={{ fontSize: 12, color: "#666" }}>
                  {subtitle}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 flex items-center justify-center rounded-lg transition-colors cursor-pointer text-[#555] hover:text-white hover:bg-[#1a2236]"
            style={{ width: 32, height: 32 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-sm text-[#555]">
              Send a message to test this agent.
            </div>
          )}
          {messages.map((msg) =>
            msg.role === "user" ? (
              <div key={msg.id} className="flex justify-end">
                <div
                  className="text-sm max-w-[80%] px-3 py-2 rounded-2xl rounded-br-sm"
                  style={{ backgroundColor: `${avatarColor}20`, color: avatarColor }}
                >
                  {msg.text}
                </div>
              </div>
            ) : (
              <div key={msg.id} className="flex items-end gap-2">
                <div
                  className="shrink-0 flex items-center justify-center rounded-full text-white font-bold"
                  style={{ width: 24, height: 24, backgroundColor: avatarColor, fontSize: 11 }}
                >
                  {avatarLetter}
                </div>
                <div className="max-w-[80%]">
                  <div
                    className="text-sm text-white px-3 py-2 rounded-2xl rounded-bl-sm"
                    style={{ backgroundColor: "#141c28" }}
                  >
                    {msg.text}
                  </div>
                  {msg.responseMs !== undefined && (
                    <span className="text-[10px] text-[#555] ml-1 mt-0.5 block">
                      {msg.responseMs}ms
                    </span>
                  )}
                </div>
              </div>
            )
          )}
          {sending && (
            <div className="flex items-center gap-2">
              <div
                className="shrink-0 flex items-center justify-center rounded-full text-white font-bold"
                style={{ width: 24, height: 24, backgroundColor: avatarColor, fontSize: 11 }}
              >
                {avatarLetter}
              </div>
              <div className="flex items-center gap-1 px-3 py-2 rounded-2xl rounded-bl-sm" style={{ backgroundColor: "#141c28" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-[#555] animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[#555] animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[#555] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="flex items-center shrink-0 p-3 border-t gap-2" style={{ borderColor: "#1a2236" }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 text-sm text-white outline-none bg-[#060a10] border border-[#1a2236] rounded-lg h-10 px-3 focus:border-[#2a3a56] transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="shrink-0 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:cursor-default"
            style={{
              width: 40,
              height: 40,
              backgroundColor: canSend ? avatarColor : "#1a2236",
              color: canSend ? "#ffffff" : "#555",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 12V4M8 4l-4 4M8 4l4 4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat-modal.tsx
git commit -m "feat(ui): upgrade ChatModal with real LLM multi-turn chat and response timing"
```

---

## Task 6: Rewrite Agents Page as Single-Select Character Picker

**Files:**
- Modify: `src/app/(dashboard)/agents/page.tsx`

- [ ] **Step 1: Rewrite agents page**

Replace the entire contents of `src/app/(dashboard)/agents/page.tsx`. Key changes:
- Uses `useSelectedAgent()` context instead of local state
- Single-click selection (not multi-select)
- Model dropdown + API key shown only on selected card
- Test Chat button opens ChatModal
- Sonner toast on selection: "Wallet allocated for [Agent]"
- Bottom bar shows selected agent info + Continue link

```tsx
"use client"

import { useState, useCallback } from "react"
import { useSelectedAgent } from "@/providers/selected-agent-provider"
import { ChatModal } from "@/components/chat-modal"
import { toast } from "sonner"

// ─── Model lists ────────────────────────────────────────────────────────────
const FREE_MODELS = [
  { id: "meta/llama-3.3-70b-instruct", name: "Llama 3.3", provider: "Meta", size: "70B", speed: "Fast", color: "#d97706", free: true },
  { id: "mistralai/mistral-small-4-119b-2603", name: "Mistral Small 4", provider: "Mistral AI", size: "119B", speed: "Medium", color: "#ef4444", free: true },
  { id: "nvidia/llama-3.3-nemotron-super-49b-v1", name: "Nemotron Super 49B", provider: "NVIDIA", size: "49B", speed: "Fast", color: "#3b82f6", free: true },
  { id: "meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B", provider: "Meta", size: "8B", speed: "Very Fast", color: "#10b981", free: true },
]

const PREMIUM_MODELS = [
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet", provider: "Anthropic", size: "-", speed: "Fast", color: "#c084fc", free: false, keyPlaceholder: "sk-ant-..." },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google AI", size: "-", speed: "Very Fast", color: "#60a5fa", free: false, keyPlaceholder: "AIza..." },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", size: "-", speed: "Fast", color: "#22c55e", free: false, keyPlaceholder: "sk-..." },
]

const ALL_MODELS = [...FREE_MODELS, ...PREMIUM_MODELS]

const SEAT_AVATARS = ["/1.png", "/2.png", "/3.png", "/4.png"]

export default function AgentsPage() {
  const { selectedAgent, agents, selectAgent, updateModel } = useSelectedAgent()
  const [chatOpen, setChatOpen] = useState(false)
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [localApiKey, setLocalApiKey] = useState("")

  const copyAddress = useCallback((addr: string) => {
    navigator.clipboard?.writeText(addr)
    setCopiedAddr(addr)
    setTimeout(() => setCopiedAddr(null), 2000)
  }, [])

  const handleSelect = useCallback((index: number) => {
    selectAgent(index)
    const agent = agents[index]
    if (selectedAgent?.index !== index) {
      toast.success(`Wallet allocated for ${agent.name}`, {
        description: `${agent.walletAddress.slice(0, 10)}...${agent.walletAddress.slice(-6)}`,
        style: { background: "#0c1018", border: `1px solid ${agent.color}`, color: "#fff" },
      })
    }
    setLocalApiKey("")
    setShowApiKey(false)
  }, [selectAgent, agents, selectedAgent])

  const handleModelChange = useCallback((modelId: string) => {
    const model = ALL_MODELS.find(m => m.id === modelId)
    if (model?.free) {
      updateModel(modelId)
      setLocalApiKey("")
    } else {
      updateModel(modelId, localApiKey || undefined)
    }
  }, [updateModel, localApiKey])

  const handleApiKeyChange = useCallback((key: string) => {
    setLocalApiKey(key)
    if (selectedAgent) {
      updateModel(selectedAgent.modelId, key || undefined)
    }
  }, [selectedAgent, updateModel])

  return (
    <div className="min-h-screen bg-[#060a10]">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight" style={{ fontFamily: "var(--font-geist-sans)" }}>
              Choose Your Agent
            </h1>
            <p className="text-sm text-[#666] mt-1">
              Pick one agent as your character. The other three will be your AI opponents.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-[#76b900]/10 border border-[#76b900]/20 rounded-full px-4 py-1.5">
            <div className="w-2 h-2 rounded-full bg-[#76b900] animate-pulse" />
            <span className="text-xs font-medium text-[#76b900]">NVIDIA NIM Connected</span>
          </div>
        </div>

        {/* ── Character Cards ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((agent, idx) => {
            const model = ALL_MODELS.find(m => m.id === agent.modelId) ?? FREE_MODELS[idx]
            const isSelected = selectedAgent?.index === idx
            const isFree = model?.free !== false

            return (
              <div
                key={idx}
                onClick={() => handleSelect(idx)}
                className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
                  isSelected
                    ? "bg-[#0c1018] border-2 shadow-lg scale-[1.02]"
                    : selectedAgent
                      ? "bg-[#0c1018] border border-[#1a2236] opacity-40 hover:opacity-60"
                      : "bg-[#0c1018] border border-[#1a2236] hover:border-[#2a3a56] hover:shadow-md"
                }`}
                style={{
                  borderColor: isSelected ? agent.color : undefined,
                  boxShadow: isSelected ? `0 0 30px ${agent.color}20` : undefined,
                }}
              >
                {/* Color accent top bar */}
                <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${agent.color}, ${agent.color}44)` }} />

                {/* Selected badge */}
                {isSelected && (
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full px-2.5 py-0.5" style={{ backgroundColor: `${agent.color}30`, border: `1px solid ${agent.color}60` }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={agent.color} strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    <span className="text-[10px] font-bold" style={{ color: agent.color }}>Your Agent</span>
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {/* Agent header */}
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border-2 border-[#2a3a56]">
                      <img src={SEAT_AVATARS[idx]} alt={agent.name} className="w-full h-full object-cover" style={{ objectPosition: "center 15%", transform: "scale(1.55) translateY(10%)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-white">{agent.name}</h3>
                      <p className="text-xs text-[#555]">{model?.provider ?? "NVIDIA"} &middot; {model?.speed ?? "Fast"}</p>
                    </div>
                  </div>

                  {/* Wallet info */}
                  <div className="bg-[#060a10] border border-[#1a2236] rounded-xl p-2.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-[10px] text-[#666] font-mono truncate">{agent.walletAddress}</code>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyAddress(agent.walletAddress) }}
                        className="shrink-0 text-[#555] hover:text-white transition-colors p-0.5 rounded hover:bg-[#1a2236]"
                      >
                        {copiedAddr === agent.walletAddress ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#76b900" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#444]">Base Sepolia</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-white/70">
                          {agent.balances ? `${parseFloat(agent.balances.usdc).toFixed(2)} USDC` : "loading..."}
                        </span>
                        {agent.balances && parseFloat(agent.balances.eth) > 0 && (
                          <span className="text-[10px] font-mono text-[#555]">
                            {parseFloat(agent.balances.eth).toFixed(4)} ETH
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded controls for selected agent */}
                  {isSelected && (
                    <div className="space-y-3 pt-2 border-t border-[#1a2236]" onClick={(e) => e.stopPropagation()}>
                      {/* Model selector */}
                      <div>
                        <label className="text-[10px] text-[#555] uppercase tracking-[0.12em] font-semibold mb-1 block">Model</label>
                        <select
                          value={agent.modelId}
                          onChange={(e) => handleModelChange(e.target.value)}
                          className="w-full bg-[#060a10] border border-[#1a2236] rounded-lg h-9 px-3 text-sm text-white/80 appearance-none cursor-pointer hover:border-[#2a3a56] transition-colors outline-none font-mono text-xs"
                        >
                          <optgroup label="Free (NVIDIA NIM)">
                            {FREE_MODELS.map(m => (
                              <option key={m.id} value={m.id}>{m.name} - {m.size} - {m.speed}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Premium (Requires API Key)">
                            {PREMIUM_MODELS.map(m => (
                              <option key={m.id} value={m.id}>{m.name} - {m.provider}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      {/* API Key for premium */}
                      {!isFree && (
                        <div>
                          <label className="text-[10px] text-[#555] uppercase tracking-[0.12em] font-semibold mb-1 block">API Key</label>
                          <div className="relative">
                            <input
                              type={showApiKey ? "text" : "password"}
                              value={localApiKey}
                              onChange={(e) => handleApiKeyChange(e.target.value)}
                              placeholder={(model as any).keyPlaceholder || "Enter API key..."}
                              className="w-full bg-[#060a10] border border-[#1a2236] rounded-lg h-9 px-3 pr-9 text-xs font-mono text-white/80 placeholder:text-[#333] outline-none focus:border-[#2a3a56] transition-colors"
                            />
                            <button
                              onClick={() => setShowApiKey(p => !p)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#444] hover:text-white/60 transition-colors"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Test Chat button */}
                      <button
                        onClick={() => setChatOpen(true)}
                        className="w-full h-9 border rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 hover:brightness-110"
                        style={{ backgroundColor: `${agent.color}15`, borderColor: `${agent.color}40`, color: agent.color }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                        Test Chat
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Bottom bar ──────────────────────────────────────────── */}
        <div className="bg-[#0c1018] border border-[#1a2236] rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              {selectedAgent ? (
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedAgent.color }} />
                  <span className="text-sm font-bold text-white">Playing as {selectedAgent.name}</span>
                  <span className="text-xs text-[#555]">&middot; 3 AI opponents</span>
                </div>
              ) : (
                <span className="text-sm text-[#555]">Select an agent to continue</span>
              )}
            </div>
            <a
              href="/skills"
              className={`px-8 py-3 text-sm font-bold rounded-xl transition-all duration-200 shadow-lg ${
                selectedAgent
                  ? "bg-gradient-to-r from-[#76b900] to-[#5a9400] hover:from-[#8dd100] hover:to-[#76b900] text-black shadow-[#76b900]/20"
                  : "bg-[#1a2236] text-[#555] cursor-not-allowed pointer-events-none shadow-none"
              }`}
            >
              Choose Skills &rarr;
            </a>
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      {selectedAgent && (
        <ChatModal
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          title={selectedAgent.name}
          subtitle={ALL_MODELS.find(m => m.id === selectedAgent.modelId)?.name ?? selectedAgent.modelId}
          avatarColor={selectedAgent.color}
          avatarLetter={selectedAgent.name[0]}
          modelId={selectedAgent.modelId}
          apiKey={selectedAgent.apiKey}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd /c/workspace/claude-adding-skill/poker-night-ai && bun run build 2>&1 | tail -30`

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/agents/page.tsx
git commit -m "feat(ui): rewrite agents page as single-select character picker"
```

---

## Task 7: Update Skills Page with Agent Context

**Files:**
- Modify: `src/app/(dashboard)/skills/page.tsx`

- [ ] **Step 1: Add agent context to skills page**

Add these changes to the top of `src/app/(dashboard)/skills/page.tsx`:

1. Import `useSelectedAgent` and `toast`:
```tsx
import { useSelectedAgent } from "@/providers/selected-agent-provider"
import { toast } from "sonner"
import { useEffect } from "react"
```

2. Inside `SkillsPage()`, add at the top of the function body:
```tsx
const { selectedAgent } = useSelectedAgent()

useEffect(() => {
  if (!selectedAgent) {
    toast.info("Pick your agent first", {
      action: { label: "Go to Agents", onClick: () => window.location.href = "/agents" },
      style: { background: "#0c1018", border: "1px solid #1a2236", color: "#fff" },
    })
  }
}, [selectedAgent])
```

3. Update the header `<h1>` line to include the agent name:
```tsx
<h1 className="text-2xl font-bold text-white tracking-tight">
  {selectedAgent ? `Choose Strategy for ${selectedAgent.name}` : "Poker Skills"}
</h1>
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd /c/workspace/claude-adding-skill/poker-night-ai && bun run build 2>&1 | tail -20`

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/skills/page.tsx
git commit -m "feat(ui): show selected agent name in skills page header with toast guard"
```

---

## Task 8: Final Verification

- [ ] **Step 1: Full build check**

Run: `cd /c/workspace/claude-adding-skill/poker-night-ai && bun run build 2>&1 | tail -30`

Expected: Build succeeds with no errors.

- [ ] **Step 2: Manual test checklist**

Run: `cd /c/workspace/claude-adding-skill/poker-night-ai && bun run dev`

Verify:
1. `/agents` shows 4 character cards in a row
2. Clicking one card selects it (highlighted), others dim
3. Clicking the same card deselects it
4. Only selected card shows model dropdown + test chat button
5. Sonner toast fires on selection
6. Top-right status bar shows agent name, model, wallet, balances
7. Status bar shows "No agent selected" when nothing picked
8. Clicking status bar navigates to `/agents`
9. Copy button on wallet address works
10. Test Chat opens modal with real LLM responses (if NVIDIA_API_KEY set)
11. `/skills` header says "Choose Strategy for [Agent]"
12. Navigating to `/skills` without agent shows toast reminder

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(ui): address issues found during manual testing"
```
