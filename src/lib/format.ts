/**
 * Shared display helpers for the AgentBet UI. Everything onchain is CHIP on
 * our `agentbet-1` rollup — this module centralizes the formatting so the
 * app never leaks stale "$" / "USDC" / sepolia strings.
 */

export const ROLLUP_CHAIN_ID =
  process.env.NEXT_PUBLIC_ROLLUP_CHAIN_ID || "agentbet-1"
export const ROLLUP_INDEXER =
  process.env.NEXT_PUBLIC_ROLLUP_INDEXER || "http://localhost:8080"
export const ROLLUP_REST =
  process.env.NEXT_PUBLIC_ROLLUP_REST || "http://localhost:1317"
export const ROLLUP_RPC =
  process.env.NEXT_PUBLIC_ROLLUP_RPC || "http://localhost:26657"

export const TOKEN_SYMBOL = "CHIP"
export const TOKEN_DECIMALS = 6

/**
 * Internal "cents" → display CHIP string.
 * The game engine uses `cents` (100 cents = 1 unit of display).
 * 1 game-cent = 0.01 CHIP display. So "5000 cents" → "50.00 CHIP".
 */
export function formatChip(cents: number, opts?: { symbol?: boolean; decimals?: number }): string {
  const decimals = opts?.decimals ?? 2
  const value = (cents / 100).toFixed(decimals)
  return opts?.symbol === false ? value : `${value} ${TOKEN_SYMBOL}`
}

/**
 * Short variant without the ticker symbol. Use when the column header already
 * says "CHIP" to avoid doubling up.
 */
export function formatChipBare(cents: number, decimals = 2): string {
  return (cents / 100).toFixed(decimals)
}

/** uchip (on-chain unit) → display CHIP string. */
export function formatUchip(uchip: number | string, decimals = 2): string {
  const n = typeof uchip === "string" ? Number(uchip) : uchip
  return `${(n / 10 ** TOKEN_DECIMALS).toFixed(decimals)} ${TOKEN_SYMBOL}`
}

/** Tx detail URL — our own Next.js page at `/tx/[hash]` which server-side
 *  proxies the rollup REST endpoint and renders a clean block-explorer-style
 *  view (tx info, Move call, HandSettled event, transfers). */
export function explorerTxUrl(hash: string): string {
  return `/tx/${hash}`
}

/** Raw REST JSON for advanced users. */
export function explorerTxRawJsonUrl(hash: string): string {
  return `${ROLLUP_REST}/cosmos/tx/v1beta1/txs/${hash}`
}

/** Address balance URL (pretty JSON of all coin balances held at this addr). */
export function explorerAddressUrl(address: string): string {
  return `${ROLLUP_REST}/cosmos/bank/v1beta1/balances/${address}`
}

/** Truncate an `init1…` or `0x…` address for display. */
export function truncateAddress(address: string, head = 8, tail = 6): string {
  if (!address) return ""
  if (address.length <= head + tail + 3) return address
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}

/** Truncate a tx hash for display. */
export function truncateHash(hash: string, head = 8, tail = 6): string {
  return truncateAddress(hash, head, tail)
}

export const NETWORK_LABEL = "Initia · agentbet-1"
