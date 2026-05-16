// Quick test client — run: bun run server/test-client.ts
// Make sure server is running first: bun run server/index.ts

import { io } from "socket.io-client"
import { writeFileSync } from "fs"

const socket = io("http://localhost:3001")
const events: string[] = []

socket.on("connect", () => {
  console.log("Connected to server")
  socket.emit("start_game")
})

socket.on("game_event", (event: any) => {
  const line = `[${event.type}] ${event.message ?? ""}`
  events.push(line)
  console.log(line)

  if (event.type === "game_over") {
    console.log(`\nTotal events: ${events.length}`)
    writeFileSync("C:/tmp/socket_test.txt", events.join("\n"))
    setTimeout(() => process.exit(0), 500)
  }

  // Stop after 3 hands
  if (event.type === "deal" && event.message?.includes("Hand #3")) {
    setTimeout(() => socket.emit("stop_game"), 100)
  }
})

socket.on("game_status", (status: any) => {
  console.log(`[status] running: ${status.running}`)
})

socket.on("error_msg", (msg: string) => {
  console.log(`[error] ${msg}`)
})
