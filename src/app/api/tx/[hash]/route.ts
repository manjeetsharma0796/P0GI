import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/tx/[hash]
 * Server-side proxy to the rollup REST endpoint. Avoids browser CORS
 * surprises when the Next.js origin differs from the rollup REST origin
 * (e.g. Codespaces where each port lives on its own subdomain).
 */

const ROLLUP_REST =
  process.env.ROLLUP_REST ||
  process.env.NEXT_PUBLIC_ROLLUP_REST ||
  "http://localhost:1317"

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ hash: string }> },
) {
  const { hash } = await ctx.params
  if (!hash || !/^[0-9A-Fa-f]{6,}$/.test(hash)) {
    return NextResponse.json({ error: "invalid tx hash" }, { status: 400 })
  }
  try {
    const res = await fetch(
      `${ROLLUP_REST}/cosmos/tx/v1beta1/txs/${hash}`,
      { cache: "no-store" },
    )
    const body = await res.json()
    return NextResponse.json(body, { status: res.status })
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message?.slice(0, 200) ?? "fetch failed" },
      { status: 502 },
    )
  }
}
