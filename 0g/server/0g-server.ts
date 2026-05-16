// 0g/server/0g-server.ts
// Socket.io server for the 0G-integrated agent-bet poker game.
// Mirrors server/index.ts but uses the 0G game manager with provider switching.
//
// Run: bun run 0g/server/0g-server.ts

import { Server } from "socket.io"
import { createServer } from "http"
import { createGameManager, type ZgGameManager } from "../engine/0g-game-manager"
import { setZgAgentConfig } from "../compute/0g-compute"
import { setAgentConfig } from "../../modules/agent/nvidia"
import {
  getAgentActionFromProvider,
  getAvailableModels,
  getDefaultAgents,
  type AIProvider,
} from "../compute/provider-selector"
import { getLeaderboard } from "../storage/0g-storage"
import { KNOWN_PROVIDERS } from "../sealed-inference/config"

const PORT = Number(process.env.ZG_SERVER_PORT ?? 3001)

// ─── HTTP server ────────────────────────────────────────────────────────────

const httpServer = createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      status: "ok",
      service: "agentbet-0g-server",
      provider: gm.getProvider(),
    }))
    return
  }
  // Fallback 404
  res.writeHead(404)
  res.end()
})

const io = new Server(httpServer, {
  cors: { origin: "*" },
})

// ─── Game manager ───────────────────────────────────────────────────────────

const gm: ZgGameManager = createGameManager()

// Broadcast all game events to connected clients
gm.onEvent((event) => {
  io.emit("game_event", event)
})

// ─── Socket.io events ───────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`[0G-SERVER] Client connected: ${socket.id}`)

  // Stop any stale game so new client gets fresh buy-in flow
  if (gm.isRunning()) {
    console.log("[0G-SERVER] Stopping stale game for new client...")
    gm.stopGame()
  }

  socket.emit("game_status", { running: false, provider: gm.getProvider() })

  // ── Agent configuration ─────────────────────────────────────────────────

  socket.on("configure_agents", (configs: { seatIndex: number; modelId: string; skillId: string; isUser?: boolean }[]) => {
    console.log("[0G-SERVER] Agent config received:", configs)

    // Update both provider agent lists so switching works seamlessly
    const provider = gm.getProvider()
    if (provider === "nvidia") {
      setAgentConfig(configs)
    } else {
      setZgAgentConfig(configs)
    }

    socket.emit("config_applied", true)
  })

  // ── Start game ──────────────────────────────────────────────────────────

  socket.on("start_game", async (data?: { buyInCents?: number; userAgent?: string }) => {
    if (gm.isRunning()) {
      console.log("[0G-SERVER] Stopping previous game before starting new one...")
      gm.stopGame()
      await new Promise(r => setTimeout(r, 500))
    }
    const buyIn = data?.buyInCents ?? 0
    const userAgent = data?.userAgent
    console.log(`[0G-SERVER] Starting game... (buy-in: $${(buyIn / 100).toFixed(2)}, user: ${userAgent ?? "none"}, provider: ${gm.getProvider()})`)
    io.emit("game_status", { running: true, provider: gm.getProvider() })
    await gm.startGame(buyIn, userAgent)
    io.emit("game_status", { running: false, provider: gm.getProvider() })
  })

  // ── Deal next hand ──────────────────────────────────────────────────────

  socket.on("deal_next_hand", () => {
    gm.dealNextHand()
  })

  // ── Rebuy ───────────────────────────────────────────────────────────────

  socket.on("rebuy", (data: { amount: number }) => {
    console.log(`[0G-SERVER] Rebuy: $${(data.amount / 100).toFixed(2)}`)
    gm.rebuy(data.amount)
  })

  // ── Rebuy timeout ───────────────────────────────────────────────────────

  socket.on("rebuy_timeout", () => {
    console.log("[0G-SERVER] Rebuy timeout — agent will force-fold")
    gm.setForceFold()
  })

  // ── Stop game ───────────────────────────────────────────────────────────

  socket.on("stop_game", () => {
    if (!gm.isRunning()) return
    console.log("[0G-SERVER] Stopping game...")
    gm.stopGame()
    io.emit("game_status", { running: false, provider: gm.getProvider() })
  })

  // ── Current state ───────────────────────────────────────────────────────

  socket.on("get_state", () => {
    socket.emit("game_state", gm.getState())
  })

  // ── Provider switching ────────────────────────────────────────────────────
  // Frontend can switch AI provider at any time (between hands).
  // provider: "nvidia" | "0g" | "0g-sealed"

  socket.on("set_provider", (data: { provider: string }) => {
    const valid = ["nvidia", "0g", "0g-sealed"]
    if (!valid.includes(data.provider)) {
      socket.emit("provider_error", { message: `Invalid provider: ${data.provider}. Valid: ${valid.join(", ")}` })
      return
    }
    gm.setProvider(data.provider as AIProvider | "0g-sealed")
    console.log(`[0G-SERVER] Provider set to: ${data.provider}`)
    io.emit("provider_changed", { provider: data.provider })
  })

  // ── Get available providers and models ──────────────────────────────────

  socket.on("get_providers", () => {
    const providers = [
      {
        id: "nvidia",
        name: "NVIDIA NIM",
        description: "NVIDIA free API (OpenAI-compatible)",
        models: getAvailableModels("nvidia"),
        agents: getDefaultAgents("nvidia").map(a => ({ name: a.name, model: a.model, personality: a.personality, skillId: a.skillId })),
      },
      {
        id: "0g",
        name: "0G Compute",
        description: "0G Compute Network via router API",
        models: getAvailableModels("0g"),
        agents: getDefaultAgents("0g").map(a => ({ name: a.name, model: a.model, personality: a.personality, skillId: a.skillId })),
      },
      {
        id: "0g-sealed",
        name: "0G Sealed Inference",
        description: "TEE-verified AI via 0G Compute Network",
        models: Object.entries(KNOWN_PROVIDERS).map(([key, p]) => ({
          id: p.address,
          name: p.name,
          provider: "0G TEE",
          size: "varies",
          free: false,
        })),
        agents: getDefaultAgents("0g").map(a => ({ name: a.name, model: a.model, personality: a.personality, skillId: a.skillId })),
      },
    ]

    socket.emit("providers", {
      current: gm.getProvider(),
      available: providers,
    })
  })

  // ── Leaderboard from 0G Storage KV ────────────────────────────────────

  socket.on("get_leaderboard", async () => {
    try {
      const entries = await getLeaderboard()
      socket.emit("leaderboard", { entries, source: "0g-storage-kv" })
    } catch (err) {
      console.error("[0G-SERVER] Leaderboard fetch failed:", (err as Error).message?.slice(0, 100))
      socket.emit("leaderboard", {
        entries: [],
        source: "0g-storage-kv",
        error: "Failed to fetch leaderboard from 0G Storage",
      })
    }
  })

  // ── Disconnect ──────────────────────────────────────────────────────────

  socket.on("disconnect", () => {
    console.log(`[0G-SERVER] Client disconnected: ${socket.id}`)
  })
})

// ─── Start ──────────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`\n[0G-SERVER] Agent Poker (0G) running on http://localhost:${PORT}`)
  console.log(`[0G-SERVER] AI Provider: ${gm.getProvider()}`)
  console.log("[0G-SERVER] Waiting for client to connect and send 'start_game'...\n")
})
