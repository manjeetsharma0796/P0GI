// server/index.ts
// Owner: M
// Bun server + Socket.io — emits game events to the UI
// Run: bun run server/index.ts

import { Server } from "socket.io"
import { createServer } from "http"
import { createGameManager } from "../modules/engine/game-manager"
import { setAgentConfig } from "../modules/agent/nvidia"

const PORT = 3001

const httpServer = createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ status: "ok", service: "agentbet-server" }))
  }
})
const io = new Server(httpServer, {
  cors: { origin: "*" },
})

const gm = createGameManager()

// Broadcast all game events to connected clients
gm.onEvent((event) => {
  io.emit("game_event", event)
})

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Stop any stale game so new client gets fresh buy-in flow
  if (gm.isRunning()) {
    console.log("Stopping stale game for new client...")
    gm.stopGame()
  }

  socket.emit("game_status", { running: false })

  // Client sends agent config (model + skill selections from UI)
  socket.on("configure_agents", (configs: { seatIndex: number; modelId: string; skillId: string; isUser?: boolean }[]) => {
    console.log("Agent config received:", configs)
    setAgentConfig(configs)
    socket.emit("config_applied", true)
  })

  // Client requests to start game with buy-in
  socket.on("start_game", async (data?: { buyInCents?: number; userAgent?: string }) => {
    if (gm.isRunning()) {
      console.log("Stopping previous game before starting new one...")
      gm.stopGame()
      await new Promise(r => setTimeout(r, 500))
    }
    const buyIn = data?.buyInCents ?? 0
    const userAgent = data?.userAgent
    console.log(`Starting game... (buy-in: $${(buyIn / 100).toFixed(2)}, user: ${userAgent ?? "none"})`)
    io.emit("game_status", { running: true })
    await gm.startGame(buyIn, userAgent)
    io.emit("game_status", { running: false })
  })

  // Client clicks "Deal Next Hand"
  socket.on("deal_next_hand", () => {
    gm.dealNextHand()
  })

  // Client re-buys after running out
  socket.on("rebuy", (data: { amount: number }) => {
    console.log(`Rebuy: $${(data.amount / 100).toFixed(2)}`)
    gm.rebuy(data.amount)
  })

  // Client timed out on rebuy — force fold
  socket.on("rebuy_timeout", () => {
    console.log("Rebuy timeout — agent will force-fold")
    gm.setForceFold()
  })

  // Client requests to stop game
  socket.on("stop_game", () => {
    if (!gm.isRunning()) return
    console.log("Stopping game...")
    gm.stopGame()
    io.emit("game_status", { running: false })
  })

  // Client requests current state
  socket.on("get_state", () => {
    socket.emit("game_state", gm.getState())
  })

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`\n🃏 Agent Poker server running on http://localhost:${PORT}`)
  console.log("Waiting for client to connect and send 'start_game'...\n")
})
