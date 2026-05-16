"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useSelectedAgent } from "@/providers/selected-agent-provider"
import { ChatModal } from "@/components/chat-modal"
import { toast } from "sonner"

// ─── Model lists ────────────────────────────────────────────────────────────
const FREE_MODELS = [
  { id: "meta/llama-3.3-70b-instruct", name: "Llama", provider: "0G Compute", size: "", speed: "Strategic & Calculated", color: "#d97706", free: true },
  { id: "mistralai/mistral-small-4-119b-2603", name: "Mistral", provider: "0G Compute", size: "", speed: "Cunning & Deceptive", color: "#ef4444", free: true },
  { id: "nvidia/llama-3.3-nemotron-super-49b-v1", name: "Nemotron", provider: "0G Compute", size: "", speed: "Aggressive & Bold", color: "#3b82f6", free: true },
  { id: "meta/llama-3.1-8b-instruct", name: "Qwen", provider: "0G Compute", size: "", speed: "Quick & Adaptive", color: "#10b981", free: true },
]

const PREMIUM_MODELS = [
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet", provider: "Premium", size: "", speed: "Strategic", color: "#c084fc", free: false, keyPlaceholder: "sk-ant-..." },
  { id: "gemini-2.5-flash", name: "Gemini Flash", provider: "Premium", size: "", speed: "Lightning", color: "#60a5fa", free: false, keyPlaceholder: "AIza..." },
  { id: "gpt-4o", name: "GPT-4o", provider: "Premium", size: "", speed: "Strategic", color: "#22c55e", free: false, keyPlaceholder: "sk-..." },
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
            <span className="text-xs font-medium text-[#76b900]">0G Compute Connected</span>
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
                      <p className="text-xs text-[#555]">{model?.provider ?? "0G Compute"} &middot; {model?.speed ?? "Fast"}</p>
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
                      <span className="text-[10px] text-[#444]">0G Testnet</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-white/70">
                          {agent.balances ? `${parseFloat(agent.balances.usdc).toFixed(2)} CHIP` : "loading..."}
                        </span>
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
                          <optgroup label="Free (0G Compute)">
                            {FREE_MODELS.map(m => (
                              <option key={m.id} value={m.id}>{m.name} - {m.speed}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Premium (Requires API Key)">
                            {PREMIUM_MODELS.map(m => (
                              <option key={m.id} value={m.id}>{m.name} - Premium</option>
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
            <Link
              href="/skills"
              className={`px-8 py-3 text-sm font-bold rounded-xl transition-all duration-200 shadow-lg ${
                selectedAgent
                  ? "bg-gradient-to-r from-[#76b900] to-[#5a9400] hover:from-[#8dd100] hover:to-[#76b900] text-black shadow-[#76b900]/20"
                  : "bg-[#1a2236] text-[#555] cursor-not-allowed pointer-events-none shadow-none"
              }`}
            >
              Choose Skills &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      {selectedAgent && (
        <ChatModal
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          title={selectedAgent.name}
          subtitle="Powered by 0G Compute"
          avatarColor={selectedAgent.color}
          avatarLetter={selectedAgent.name[0]}
          modelId={selectedAgent.modelId}
          apiKey={selectedAgent.apiKey}
        />
      )}
    </div>
  )
}
