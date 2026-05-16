"use client"

import { useState } from "react"

interface AgentCardProps {
  id: string
  name: string
  provider: string
  logo: string
  avatarColor: string
  isCustom?: boolean
  onTest: () => void
}

export function AgentCard({ id, name, provider, logo, avatarColor, isCustom, onTest }: AgentCardProps) {
  const [apiKey, setApiKey] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [validated, setValidated] = useState(false)

  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:border-muted transition-colors duration-200 flex flex-col gap-4">
      {/* Top row */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold text-white shrink-0"
          style={{ backgroundColor: avatarColor }}
        >
          {logo}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-white">{name}</p>
          <p className="text-[13px] text-muted">{provider}</p>
        </div>
        {validated && (
          <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>

      {/* API Key input */}
      <div className="relative">
        <input
          type={showKey ? "text" : "password"}
          value={apiKey}
          onChange={e => {
            setApiKey(e.target.value)
            setValidated(false)
          }}
          placeholder="sk-..."
          className="w-full bg-[#0a0a0a] border border-border rounded-lg h-10 px-3 pr-10 text-sm font-mono text-white placeholder:text-muted/40 focus:border-muted outline-none transition-colors"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors"
        >
          {showKey ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      {/* Custom: Base URL input */}
      {isCustom && (
        <input
          type="text"
          value={baseUrl}
          onChange={e => setBaseUrl(e.target.value)}
          placeholder="https://api.example.com"
          className="w-full bg-[#0a0a0a] border border-border rounded-lg h-10 px-3 text-sm font-mono text-white placeholder:text-muted/40 focus:border-muted outline-none transition-colors"
        />
      )}

      {/* Bottom row */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (apiKey) setValidated(true)
            onTest()
          }}
          className="flex-1 border border-border rounded-lg h-8 text-sm font-medium text-muted hover:border-muted hover:text-white transition-colors duration-150"
        >
          Test
        </button>
        <div className="text-right">
          <p className="text-[13px] font-mono text-white">10.00 CHIP</p>
          <p className="text-[11px] text-muted">Wallet</p>
        </div>
      </div>
    </div>
  )
}
