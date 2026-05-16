import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/balance?address=0x...
 * Returns the wallet's A0GI balance on 0G Galileo Testnet.
 *
 * Response shape preserved for backward compatibility with use-game.ts:
 *   { usdc: "0.1234", eth: "0", network: "0G · Galileo Testnet" }
 * `usdc` field name kept to avoid breaking callers — UI reads as A0GI.
 */

const ZG_RPC_URL =
  process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai"

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 })

  try {
    // EVM JSON-RPC eth_getBalance
    const res = await fetch(ZG_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: 1,
      }),
      cache: "no-store",
    })

    if (!res.ok) {
      return NextResponse.json({
        usdc: "0", eth: "0",
        network: "0G · Galileo Testnet",
        chainId: 16602,
        error: `rpc ${res.status}`,
      })
    }

    const json = (await res.json()) as { result?: string; error?: { message: string } }
    if (json.error) {
      return NextResponse.json({
        usdc: "0", eth: "0",
        network: "0G · Galileo Testnet",
        chainId: 16602,
        error: json.error.message?.slice(0, 80),
      })
    }

    // Convert wei hex → A0GI (18 decimals)
    const weiHex = json.result ?? "0x0"
    const wei = BigInt(weiHex)
    const a0gi = Number(wei) / 1e18

    return NextResponse.json({
      usdc: a0gi.toFixed(6),
      eth: "0",
      network: "0G · Galileo Testnet",
      chainId: 16602,
    })
  } catch (e: any) {
    return NextResponse.json({
      usdc: "0", eth: "0",
      network: "0G · Galileo Testnet",
      chainId: 16602,
      error: e.message?.slice(0, 80),
    })
  }
}
