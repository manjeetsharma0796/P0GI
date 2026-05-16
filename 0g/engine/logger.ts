/**
 * Simple logger for the 0G game engine.
 * Replaces the old modules/engine/logger.ts with console-only output.
 */

export function log(tag: string, msg: string): void {
  console.log(`[${tag}] ${msg}`)
}

export function logTx(tag: string, hash: string, msg?: string): void {
  console.log(`[${tag}] tx: ${hash}${msg ? ` — ${msg}` : ""}`)
}

export function clearLogs(): void {
  // no-op for console logger
}

export function printLogPaths(): void {
  // no-op for console logger
}
