/**
 * Shared display helpers for the AgentBet UI.
 * Everything on-chain is native A0GI on the 0G Galileo Testnet (chain 16602).
 * 1 game-cent = 10^14 wei = 0.0001 A0GI.
 */

export const ZG_CHAIN_ID = 16602
export const ZG_RPC_URL =
  process.env.NEXT_PUBLIC_ZG_RPC_URL || "https://evmrpc-testnet.0g.ai"
export const ZG_EXPLORER =
  process.env.NEXT_PUBLIC_ZG_EXPLORER || "https://chainscan-galileo.0g.ai"

export const TOKEN_SYMBOL = "A0GI"
export const TOKEN_DECIMALS = 18

/**
 * Internal "cents" → display token string.
 * The game engine uses `cents` (100 cents = 1 unit of display).
 * 1 game-cent = 0.0001 A0GI. So "5000 cents" → "0.50 A0GI".
 */
export function formatChip(cents: number, opts?: { symbol?: boolean; decimals?: number }): string {
  const decimals = opts?.decimals ?? 4
  const value = (cents / 10000).toFixed(decimals)
  return opts?.symbol === false ? value : `${value} ${TOKEN_SYMBOL}`
}

/**
 * Short variant without the ticker symbol. Use when the column header already
 * says "A0GI" to avoid doubling up.
 */
export function formatChipBare(cents: number, decimals = 4): string {
  return (cents / 10000).toFixed(decimals)
}

/** Wei → display A0GI string. */
export function formatWei(wei: bigint | string | number, decimals = 4): string {
  const n = typeof wei === "bigint" ? wei : BigInt(wei)
  const whole = n / BigInt(10 ** TOKEN_DECIMALS)
  const frac = n % BigInt(10 ** TOKEN_DECIMALS)
  const fracStr = frac.toString().padStart(TOKEN_DECIMALS, "0").slice(0, decimals)
  return `${whole}.${fracStr} ${TOKEN_SYMBOL}`
}

/** Tx detail URL — links to 0G chain explorer. */
export function explorerTxUrl(hash: string): string {
  return `${ZG_EXPLORER}/tx/${hash}`
}

/** Address URL on 0G explorer. */
export function explorerAddressUrl(address: string): string {
  return `${ZG_EXPLORER}/address/${address}`
}

/** Truncate an `0x…` address for display. */
export function truncateAddress(address: string, head = 8, tail = 6): string {
  if (!address) return ""
  if (address.length <= head + tail + 3) return address
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}

/** Truncate a tx hash for display. */
export function truncateHash(hash: string, head = 8, tail = 6): string {
  return truncateAddress(hash, head, tail)
}

export const NETWORK_LABEL = "0G · Galileo Testnet"
