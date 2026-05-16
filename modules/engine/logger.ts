// modules/engine/logger.ts
// Centralized logging — writes to console + data/game.log file
// Check data/game.log for all transaction and game events

import { appendFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"

const LOG_DIR  = join(process.cwd(), "data")
const LOG_FILE = join(LOG_DIR, "game.log")
const TX_FILE  = join(LOG_DIR, "transactions.log")

function ensureDir() {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true })
}

function ts(): string {
  return new Date().toISOString().slice(0, 23)
}

function writeLine(file: string, line: string) {
  ensureDir()
  appendFileSync(file, line + "\n")
}

// ─── Game log (everything) ──────────────────────────────────────────────────

export function log(tag: string, msg: string) {
  const line = `[${ts()}] [${tag.padEnd(8)}] ${msg}`
  console.log(line)
  writeLine(LOG_FILE, line)
}

// ─── Transaction log (settlements only) ─────────────────────────────────────

export function logTx(data: {
  hand: number
  from: string
  fromAgent: string
  to: string
  toAgent: string
  amount: number
  txHash?: string
  status: "initiated" | "success" | "failed"
  error?: string
  mode: "simulated" | "on-chain"
}) {
  const line = [
    `[${ts()}]`,
    `[HAND #${data.hand}]`,
    `[${data.status.toUpperCase()}]`,
    `[${data.mode}]`,
    `${data.fromAgent}(${data.from.slice(0, 10)}...)`,
    `→`,
    `${data.toAgent}(${data.to.slice(0, 10)}...)`,
    `$${(data.amount / 100).toFixed(2)} USDC`,
    data.txHash ? `tx:${data.txHash}` : "",
    data.error ? `err:${data.error}` : "",
  ].filter(Boolean).join(" ")

  console.log(`\x1b[33m${line}\x1b[0m`)  // yellow in console
  writeLine(TX_FILE, line)
  writeLine(LOG_FILE, line)
}

// ─── Clear logs (call at game start) ────────────────────────────────────────

export function clearLogs() {
  ensureDir()
  writeFileSync(LOG_FILE, `=== Agent Poker Game Log — ${ts()} ===\n`)
  writeFileSync(TX_FILE, `=== Transaction Log — ${ts()} ===\n`)
}

// ─── Print where to find logs ───────────────────────────────────────────────

export function printLogPaths() {
  console.log(`\n📋 Logs:`)
  console.log(`   Game:         ${LOG_FILE}`)
  console.log(`   Transactions: ${TX_FILE}`)
  console.log()
}
