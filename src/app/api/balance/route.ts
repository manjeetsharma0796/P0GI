import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/balance?address=0x...
 * Returns the wallet's CHIP token balance on 0G Galileo Testnet.
 *
 * Response shape preserved for backward compatibility:
 *   { usdc: "10000.00", eth: "0", network: "0G · Galileo Testnet" }
 * `usdc` field name kept to avoid breaking callers — UI reads as CHIP.
 */

const ZG_RPC_URL =
  process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai"

// ERC20 balanceOf(address) selector = 0x70a08231
const BALANCE_OF_SELECTOR = "0x70a08231"

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 })

  const chipToken = process.env.ZG_CHIP_TOKEN_ADDRESS
  if (!chipToken) {
    // Fallback: if no CHIP token address, query native A0GI
    return queryNativeBalance(address)
  }

  try {
    // Encode balanceOf(address) call
    const paddedAddress = address.toLowerCase().replace("0x", "").padStart(64, "0")
    const callData = BALANCE_OF_SELECTOR + paddedAddress

    const res = await fetch(ZG_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to: chipToken, data: callData }, "latest"],
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

    // Convert wei hex → CHIP (18 decimals)
    const weiHex = json.result ?? "0x0"
    const wei = BigInt(weiHex)
    const chip = Number(wei) / 1e18

    return NextResponse.json({
      usdc: chip.toFixed(2),
      eth: "0",
      network: "0G · Galileo Testnet",
      chainId: 16602,
      token: "CHIP",
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

/** Fallback: query native A0GI balance if no CHIP token deployed yet */
async function queryNativeBalance(address: string) {
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
      cache: "no-store",
    })
    const json = (await res.json()) as { result?: string }
    const wei = BigInt(json.result ?? "0x0")
    const a0gi = Number(wei) / 1e18
    return NextResponse.json({
      usdc: a0gi.toFixed(6),
      eth: "0",
      network: "0G · Galileo Testnet",
      chainId: 16602,
      token: "A0GI",
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
