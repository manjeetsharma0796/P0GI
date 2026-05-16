import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/balance?address=init1...
 * Returns the wallet's CHIP balance on the agentbet-1 rollup.
 *
 * Response shape preserved for backward compatibility with use-game.ts:
 *   { usdc: "12345.67", eth: "0", network: "Initia · agentbet-1" }
 * `usdc` is actually CHIP (1 CHIP = 1 game-dollar by convention here); the
 * field name is kept to avoid breaking callers mid-port. UI reads this as
 * "CHIP" everywhere.
 */

// Server-side route: prefer the localhost REST endpoint.
// NEXT_PUBLIC_ROLLUP_REST points at the Codespace tunnel which is 401-gated
// for unauthenticated server-to-server calls, so it must not be used here.
const ROLLUP_REST =
  process.env.ROLLUP_REST || "http://localhost:1317"

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 })

  try {
    const res = await fetch(
      `${ROLLUP_REST}/cosmos/bank/v1beta1/balances/${encodeURIComponent(address)}?pagination.limit=50`,
      { cache: "no-store" },
    )
    if (!res.ok) {
      return NextResponse.json({
        usdc: "0", eth: "0",
        network: "Initia · agentbet-1",
        chainId: "agentbet-1",
        error: `rest ${res.status}`,
      })
    }
    const json = (await res.json()) as {
      balances?: { denom: string; amount: string }[]
    }
    const uchip = json.balances?.find(b => b.denom === "uchip")
    const chip = uchip ? Number(uchip.amount) / 1_000_000 : 0
    return NextResponse.json({
      usdc: chip.toFixed(6),
      eth: "0",
      network: "Initia · agentbet-1",
      chainId: "agentbet-1",
    })
  } catch (e: any) {
    return NextResponse.json({
      usdc: "0", eth: "0",
      network: "Initia · agentbet-1",
      chainId: "agentbet-1",
      error: e.message?.slice(0, 80),
    })
  }
}
