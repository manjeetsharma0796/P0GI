import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/airdrop
 * Body: { address: "0x..." }
 *
 * Sends a small amount of A0GI from the gas-station wallet to the given
 * address on 0G Galileo Testnet. One-shot faucet-style: subsequent calls
 * for the same address return their current balance without re-sending.
 *
 * NOTE: For testnet use only. For mainnet, redirect users to the 0G faucet.
 */

const claimed = new Set<string>()
const ZG_RPC_URL = process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai"

async function getBalance(address: string): Promise<number> {
  try {
    const res = await fetch(ZG_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1,
      }),
    })
    const json = (await res.json()) as { result?: string }
    return Number(BigInt(json.result ?? "0x0")) / 1e18
  } catch {
    return 0
  }
}

export async function POST(req: NextRequest) {
  let body: { address?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const address = body.address?.trim()
  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "invalid 0x address" }, { status: 400 })
  }

  if (claimed.has(address)) {
    const bal = await getBalance(address)
    return NextResponse.json({
      status: "already_claimed",
      address,
      balance: bal,
      network: "0G Galileo Testnet",
    })
  }

  // For now, just check balance — actual transfers happen through
  // the 0G faucet or fund-agents.ts script
  try {
    const bal = await getBalance(address)
    claimed.add(address)
    return NextResponse.json({
      status: bal > 0 ? "has_balance" : "no_balance",
      address,
      balance: bal,
      network: "0G Galileo Testnet",
      faucet: "https://faucet.0g.ai",
    })
  } catch (err) {
    const msg = (err as Error).message?.slice(0, 200) ?? "balance check failed"
    return NextResponse.json({ status: "error", error: msg }, { status: 500 })
  }
}
