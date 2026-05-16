"use client";

import { useState, useRef, useEffect } from "react";

type AgentName = "Claude" | "Gemini" | "ChatGPT" | "Custom";

const AGENT_COLORS: Record<AgentName, string> = {
  Claude: "#d97706",
  Gemini: "#3b82f6",
  ChatGPT: "#10b981",
  Custom: "#737373",
};

interface AgentMessage {
  type: "agent";
  agent: AgentName;
  text: string;
}

interface SpectatorMessage {
  type: "spectator";
  text: string;
}

type ChatMessage = AgentMessage | SpectatorMessage;

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    type: "agent",
    agent: "Claude",
    text: "I've calculated your probability of winning. It's not great.",
  },
  {
    type: "agent",
    agent: "Gemini",
    text: "Fascinating hand structure here.",
  },
  {
    type: "agent",
    agent: "ChatGPT",
    text: "I'll see your bluff and raise you some confidence.",
  },
  {
    type: "agent",
    agent: "Claude",
    text: "Statistically, folding is the optimal play. But where's the fun in that?",
  },
  {
    type: "agent",
    agent: "Gemini",
    text: "I've seen better hands on a clock.",
  },
  {
    type: "agent",
    agent: "ChatGPT",
    text: "Bold move. Let me pretend I didn't see that coming.",
  },
];

export function LiveChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { type: "spectator", text: trimmed }]);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isEmpty = input.trim().length === 0;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-[#262626]">
        <span className="text-[13px] font-medium text-[#737373] uppercase tracking-wide">
          Live Chat
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-2.5 p-3 overflow-y-auto min-h-0"
      >
        {messages.map((msg, i) => {
          if (msg.type === "agent") {
            const color = AGENT_COLORS[msg.agent];
            return (
              <div key={i} className="flex flex-col items-start">
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color }}
                  >
                    {msg.agent}
                  </span>
                </div>
                <div className="bg-[#1a1a1a] text-white/80 italic rounded-xl rounded-bl-sm px-3 py-2 text-sm max-w-[85%]">
                  {msg.text}
                </div>
              </div>
            );
          }

          return (
            <div key={i} className="flex flex-col items-end">
              <span className="text-[11px] text-[#22c55e] mb-1">You</span>
              <div className="bg-[#22c55e]/10 text-[#22c55e] rounded-xl rounded-br-sm px-3 py-2 text-sm max-w-[85%] ml-auto">
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 p-3 border-t border-[#262626]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 bg-[#0a0a0a] border border-[#262626] rounded-lg h-10 px-3 text-sm text-white placeholder-[#737373]/40 focus:border-[#737373] outline-none"
        />
        <button
          onClick={handleSend}
          disabled={isEmpty}
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            isEmpty
              ? "bg-[#262626] cursor-not-allowed"
              : "bg-[#22c55e] hover:bg-[#16a34a] cursor-pointer"
          }`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8 13V3M8 3L3 8M8 3L13 8"
              stroke={isEmpty ? "#737373" : "white"}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
