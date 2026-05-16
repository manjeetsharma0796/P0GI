// Full poker session with transaction logging
// Run: bun run scripts/play-session.ts

import { createGameManager } from "../modules/engine/game-manager"
import { AGENTS } from "../modules/agent/nvidia"
import { POKER_SKILLS } from "../modules/agent/skills"
import { getAllWallets } from "../modules/agent/wallet-persistence"
import { writeFileSync } from "fs"

const LOG_FILE = "data/session-log.txt"
const lines: string[] = []

function log(s: string) {
  lines.push(s)
  console.log(s)
}

function save() {
  writeFileSync(LOG_FILE, lines.join("\n"))
}

// ─── Header ──────────────────────────────────────────────────────────────────

log("╔═══════════════════════════════════════════════════════════════╗")
log("║              🃏 AGENT POKER NIGHT — SESSION LOG 🃏            ║")
log("║   Real LLMs · Persistent Wallets · x402 Payments             ║")
log("║   Network: Ethereum Sepolia Testnet                          ║")
log(`║   Date: ${new Date().toISOString()}                    ║`)
log("╚═══════════════════════════════════════════════════════════════╝")
log("")

// ─── Agent lineup ────────────────────────────────────────────────────────────

log("┌─────────── AGENTS ───────────┐")
const wallets = getAllWallets()
for (const a of AGENTS) {
  const skill = POKER_SKILLS.find((s) => s.id === a.skillId)
  const wallet = wallets.find((w) => w.agentName === a.name)
  log(`│ ${skill?.emoji} ${a.name.padEnd(10)} ${(skill?.name ?? "").padEnd(18)} │`)
  log(`│   Model:  ${a.model.split("/")[1]?.slice(0, 28).padEnd(28)} │`)
  log(`│   Wallet: ${(wallet?.address ?? "N/A").slice(0, 28)}... │`)
}
log("└─────────────────────────────┘")
log("")

// ─── Game ────────────────────────────────────────────────────────────────────

const gm = createGameManager()
let handCount = 0
const MAX_HANDS = 5

gm.onEvent((e) => {
  const ts = new Date().toISOString().slice(11, 23)

  if (e.type === "deal" && e.message?.includes("Hand #")) {
    handCount++
    log("")
    log(`═══════════════════════════════════════════`)
    log(`  HAND #${handCount}`)
    log(`═══════════════════════════════════════════`)
    if (e.stacks) {
      log(`  Stacks: ${Object.entries(e.stacks).map(([n, s]) => `${n}:${s}`).join(" | ")}`)
    }
    if (handCount > MAX_HANDS) gm.stopGame()
  }

  if (e.type === "deal" && e.communityCards?.length) {
    log(`  📋 Board: [${e.communityCards.join(" ")}]`)
  }

  if (e.type === "action" && e.action?.message !== "thinking...") {
    const skill = POKER_SKILLS.find((s) => s.id === AGENTS.find((a) => a.name === e.agentName)?.skillId)
    const amt = e.action?.amount ? ` $${(e.action.amount / 100).toFixed(2)}` : ""
    const tx = e.txHash ? `  [tx: ${e.txHash}]` : ""
    log(`  ${ts} ${skill?.emoji} ${(e.agentName ?? "").padEnd(10)} ${(e.action?.action ?? "").padEnd(6)}${amt}`)
    log(`           "${e.action?.message}"${tx}`)
  }

  if (e.type === "payout") {
    log("")
    log(`  🏆 WINNER: ${e.winnerName} — ${e.winnerHand}`)
    log(`     Pot: ${e.potAmount} chips`)
    log(`     Payout tx: ${e.txHash}`)
    if (e.stacks) {
      log(`     Stacks after: ${Object.entries(e.stacks).map(([n, s]) => `${n}:${s}`).join(" | ")}`)
    }
  }

  if (e.type === "game_over") {
    log("")
    log(`═══════════════════════════════════════════`)
    log(`  🎮 SESSION OVER — ${e.message}`)
    log(`═══════════════════════════════════════════`)
  }

  // Save after every event
  save()
})

log("Starting session...")
log("")

await gm.startGame()

// ─── Summary ─────────────────────────────────────────────────────────────────

log("")
log("┌─────────── SESSION SUMMARY ───────────┐")
log(`│ Hands played: ${handCount}`)
log(`│ Network:      Ethereum Sepolia`)
log(`│ Mode:         ${process.env.X402_LIVE === "true" ? "ON-CHAIN" : "SIMULATED"} x402`)
log(`│ LLM:          ${process.env.NVIDIA_API_KEY ? "REAL (NVIDIA NIM)" : "MOCK"}`)
log(`│ Log saved:    ${LOG_FILE}`)
log("└────────────────────────────────────────┘")
save()

console.log(`\n📄 Full log saved to: ${LOG_FILE}`)
process.exit(0)
