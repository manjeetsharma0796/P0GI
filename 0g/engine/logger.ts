/**
 * Simple logger for the 0G game engine.
 * Replaces the old modules/engine/logger.ts with console-only output.
 */

export function log(tag: string, msg: string): void {
  console.log(`[${tag}] ${msg}`)
}

export function logTx(
  info: string | { hand: number; from: string; to: string; fromAgent: string; toAgent: string; amount: number; status: string; mode: string; txHash?: string; error?: string },
  hash?: string,
  msg?: string,
): void {
  if (typeof info === "string") {
    console.log(`[${info}] tx: ${hash}${msg ? ` — ${msg}` : ""}`)
  } else {
    const h = info.txHash ?? "pending"
    console.log(`[TX:${info.status}] hand#${info.hand} ${info.fromAgent}->${info.toAgent} ${info.amount}c | tx: ${h}${info.error ? ` — ${info.error}` : ""}`)
  }
}

export function clearLogs(): void {
  // no-op for console logger
}

export function printLogPaths(): void {
  // no-op for console logger
}
