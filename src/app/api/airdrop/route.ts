import { NextRequest, NextResponse } from "next/server"
import { airdrop, queryBalance } from "../../../../modules/chain/initia"

/**
 * POST /api/airdrop
 * Body: { address: "init1..." }
 *
 * Sends 500 CHIP from gas-station to the given bech32 address the first time
 * it's seen. Subsequent calls for the same address return their current
 * balance without re-sending (one-shot faucet-style).
 *
 * Runs inside the container, so it can shell out to `minitiad`.
 */

const claimed = new Set<string>()
const AIRDROP_UCHIP = 500_000_000 // 500 CHIP (6 decimals)
const MIN_BALANCE_FOR_SKIP = 100_000_000 // 100 CHIP — if they already have more, skip

export async function POST(req: NextRequest) {
  let body: { address?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const address = body.address?.trim()
  if (!address || !address.startsWith("init1") || address.length < 20) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 })
  }

  if (claimed.has(address)) {
    const bal = await queryBalance(address).catch(() => 0)
    return NextResponse.json({
      status: "already_claimed",
      address,
      uchipBalance: bal,
    })
  }

  try {
    const existing = await queryBalance(address)
    if (existing >= MIN_BALANCE_FOR_SKIP) {
      claimed.add(address)
      return NextResponse.json({
        status: "sufficient_balance",
        address,
        uchipBalance: existing,
      })
    }
    const tx = await airdrop(address, AIRDROP_UCHIP)
    claimed.add(address)
    const bal = await queryBalance(address).catch(() => 0)
    return NextResponse.json({
      status: "airdropped",
      address,
      txhash: tx.txhash,
      uchipSent: AIRDROP_UCHIP,
      uchipBalance: bal,
    })
  } catch (err) {
    const msg = (err as Error).message?.slice(0, 200) ?? "airdrop failed"
    console.error("[airdrop] failed for", address, msg)
    return NextResponse.json({ status: "error", error: msg }, { status: 500 })
  }
}
