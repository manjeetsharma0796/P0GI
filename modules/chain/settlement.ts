/**
 * Drop-in replacement for modules/agent/x402 + modules/agent/ows, backed by
 * the Initia agentbet-1 rollup. Keeps the same exported names so the
 * surgical change in game-manager.ts is just an import path.
 *
 * Unit mapping:
 *   game world uses "cents" (100 cents = 1 "game dollar")
 *   chain uses uchip (1_000_000 uchip = 1 CHIP)
 *   We map 1 game-cent = 10_000 uchip  (i.e. 1 game-dollar = 1 CHIP)
 *   So an agent funded with 10_000 CHIP has a bankroll of "100,000 cents" = $1,000 game-dollars.
 */
import type { AgentName, Wallet } from "../shared/types"
import { AGENT_WALLETS, GAS_STATION_ADDRESS } from "../shared/chain"
import { queryBalance, sendUchip, airdrop as airdropUchip, recordHand } from "./initia"

export const UCHIP_PER_CENT = 10_000
export const centsToUchip = (cents: number) => Math.round(cents * UCHIP_PER_CENT)
export const uchipToCents = (uchip: number) => Math.floor(uchip / UCHIP_PER_CENT)

export async function setupAllWallets(
  agentNames: AgentName[],
  _startingBalanceUsdc: number,
): Promise<Record<AgentName, Wallet>> {
  const out: Partial<Record<AgentName, Wallet>> = {}
  for (const name of agentNames) {
    const info = AGENT_WALLETS[name]
    if (!info) throw new Error(`No chain wallet configured for agent ${name}`)
    out[name] = { address: info.address, agentName: name }
  }
  return out as Record<AgentName, Wallet>
}

export function getPotAddress(): string {
  // Gas station plays the role of "pot address" — house/dealer account.
  return GAS_STATION_ADDRESS
}

/** USDC-era helper kept for call-site compatibility. Returns CHIP balance in cents. */
export async function getBalance(address: string): Promise<number> {
  const uchip = await queryBalance(address)
  return uchipToCents(uchip)
}

/** x402 compatibility — same name game-manager.ts already calls. */
export async function getUsdcBalanceCents(address: string): Promise<number> {
  return getBalance(address)
}

/**
 * Settle a single edge of the pot: move `amountCents` worth of CHIP from
 * loser's wallet to winner's wallet. Returns the on-chain tx hash.
 */
export async function settleBet(
  fromAddress: string,
  toAddress: string,
  amountCents: number,
): Promise<string> {
  const fromKey = findKeyByAddress(fromAddress)
  const uchip = centsToUchip(amountCents)
  const tx = await sendUchip(fromKey, toAddress, uchip)
  return tx.txhash
}

/**
 * Distribute winnings from the pot address (gas-station) to a single winner.
 * Kept for parity with the old x402 module surface; game-manager.ts mostly
 * uses settleBet per-loser, but tournaments / airdrop flows may need this.
 */
export async function distributeWinnings(
  winnerAddress: string,
  amountCents: number,
): Promise<string> {
  const tx = await airdropUchip(winnerAddress, centsToUchip(amountCents))
  return tx.txhash
}

function findKeyByAddress(address: string): string {
  for (const info of Object.values(AGENT_WALLETS)) {
    if (info.address === address) return info.keyName
  }
  if (address === GAS_STATION_ADDRESS) return "gas-station"
  throw new Error(`No chain key for address ${address}`)
}

export const explorerTxUrl = (hash: string) =>
  `http://localhost:8080/tx/${hash}` // replaced by public tunnel URL later

/**
 * Emit on-chain audit record for a settled hand (HandSettled event from
 * agentbet::game module). Failures are non-fatal — the bank MsgSend
 * settlements have already succeeded by this point; this is the audit trail.
 */
export async function recordHandOnChain(params: {
  handId: number
  tableId: number
  winnerAddress: string
  potCents: number
  losers: { address: string; lossCents: number }[]
}): Promise<string | null> {
  try {
    const tx = await recordHand({
      handId: params.handId,
      tableId: params.tableId,
      winners: [params.winnerAddress],
      payouts: [centsToUchip(params.potCents)],
      losers: params.losers.map(l => l.address),
      pot: centsToUchip(params.potCents),
    })
    return tx.txhash
  } catch (err) {
    console.warn(`[chain] recordHandOnChain failed (non-fatal): ${(err as Error).message?.slice(0, 100)}`)
    return null
  }
}
