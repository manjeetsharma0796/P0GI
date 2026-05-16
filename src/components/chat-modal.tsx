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
