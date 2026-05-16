// 0g/server/0g-server.ts
// Socket.io server for the 0G-integrated agent-bet poker game.
// All AI inference is powered by 0G Compute.
//
// Run: bun run 0g/server/0g-server.ts

import { Server } from "socket.io"
import { createServer } from "http"
import { createGameManager, type ZgGameManager } from "../engine/0g-game-manager"
import { setZgAgentConfig } from "../compute/0g-compute"
import { getAvailableModelsDynamic, getDefaultAgents } from "../compute/provider-selector"
import { getLeaderboard } from "../storage/0g-storage"

const PORT = Number(process.env.ZG_SERVER_PORT ?? 3001)

// ─── HTTP server ────────────────────────────────────────────────────────────

const httpServer = createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      status: "ok",
      service: "agentbet-0g-server",
      provider: "0G Compute",
    }))
    return
  }
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

  socket.emit("game_status", { running: false, provider: "0G Compute" })

  // ── Agent configuration ─────────────────────────────────────────────────

  socket.on("configure_agents", (configs: { seatIndex: number; modelId: string; skillId: string; isUser?: boolean }[]) => {
    console.log("[0G-SERVER] Agent config received:", configs)
    setZgAgentConfig(configs)
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
    console.log(`[0G-SERVER] Starting game... (buy-in: $${(buyIn / 100).toFixed(2)}, user: ${userAgent ?? "none"}, provider: 0G Compute)`)
    io.emit("game_status", { running: true, provider: "0G Compute" })
    await gm.startGame(buyIn, userAgent)
    io.emit("game_status", { running: false, provider: "0G Compute" })
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
    io.emit("game_status", { running: false, provider: "0G Compute" })
  })

  // ── Current state ───────────────────────────────────────────────────────

  socket.on("get_state", () => {
    socket.emit("game_state", gm.getState())
  })

  // ── Get available models ──────────────────────────────────────────────

  socket.on("get_providers", async () => {
    const [models, agents] = await Promise.all([
      getAvailableModelsDynamic(),
      Promise.resolve(getDefaultAgents()),
    ])
    socket.emit("providers", {
      current: "0G Compute",
      available: [{
        id: "0g-compute",
        name: "0G Compute",
        description: "AI inference powered by the 0G Compute Network",
        models,
        agents: agents.map(a => ({ name: a.name, model: a.model, personality: a.personality, skillId: a.skillId })),
      }],
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
  console.log(`\n[0G-SERVER] Agent Poker (0G Compute) running on http://localhost:${PORT}`)
  console.log("[0G-SERVER] AI Provider: 0G Compute")
  console.log("[0G-SERVER] Waiting for client to connect and send 'start_game'...\n")
})
