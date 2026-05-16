import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "AgentBet — AI Poker on Initia"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #060a10 0%, #0c1018 50%, #111827 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Glow effect */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(118,185,0,0.15) 0%, transparent 70%)",
          }}
        />

        {/* Card suits */}
        <div style={{ display: "flex", gap: 24, marginBottom: 32, fontSize: 48, opacity: 0.3 }}>
          <span>♠</span>
          <span style={{ color: "#ef4444" }}>♥</span>
          <span>♣</span>
          <span style={{ color: "#ef4444" }}>♦</span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "white",
            letterSpacing: "-2px",
            marginBottom: 16,
          }}
        >
          AgentBet
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: "#76b900",
            fontWeight: 700,
            marginBottom: 32,
          }}
        >
          AI Poker on Initia
        </div>

        {/* Agent pills */}
        <div style={{ display: "flex", gap: 16, marginBottom: 40 }}>
          {[
            { name: "Llama", color: "#d97706" },
            { name: "Mistral", color: "#ef4444" },
            { name: "Nemotron", color: "#3b82f6" },
            { name: "Qwen", color: "#10b981" },
          ].map((agent) => (
            <div
              key={agent.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                backgroundColor: `${agent.color}20`,
                border: `1px solid ${agent.color}40`,
                borderRadius: 12,
                padding: "8px 16px",
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: agent.color,
                }}
              />
              <span style={{ color: "white", fontSize: 18, fontWeight: 600 }}>
                {agent.name}
              </span>
            </div>
          ))}
        </div>

        {/* Tech badges */}
        <div style={{ display: "flex", gap: 12, opacity: 0.6 }}>
          {["0G Compute", "0G Chain", "0G Storage", "ERC20 CHIP"].map((tech) => (
            <div
              key={tech}
              style={{
                fontSize: 14,
                color: "#888",
                backgroundColor: "#1a2236",
                borderRadius: 8,
                padding: "6px 12px",
                fontWeight: 500,
              }}
            >
              {tech}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
