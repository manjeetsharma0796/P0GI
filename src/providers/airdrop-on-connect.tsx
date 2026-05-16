"use client"

import { useEffect, useRef } from "react"
import { useInterwovenKit } from "@initia/interwovenkit-react"
import { toast } from "sonner"

const ROLLUP_INDEXER =
  process.env.NEXT_PUBLIC_ROLLUP_INDEXER || "http://localhost:8080"

/**
 * Invisible component: fires a one-shot airdrop request the first time the
 * user connects a fresh wallet so they have CHIP to sign txs immediately.
 */
export function AirdropOnConnect() {
  const { isConnected, initiaAddress } = useInterwovenKit()
  const requested = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!isConnected || !initiaAddress) return
    if (requested.current.has(initiaAddress)) return
    requested.current.add(initiaAddress)

    void (async () => {
      try {
        const res = await fetch("/api/airdrop", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address: initiaAddress }),
        })
        const data = await res.json()
        if (data.status === "airdropped") {
          toast.success(
            <div className="flex flex-col">
              <span>Welcome — 500 CHIP airdropped</span>
              <a
                href={`${ROLLUP_INDEXER}/tx/${data.txhash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[11px] underline"
              >
                {data.txhash?.slice(0, 10)}…
              </a>
            </div>,
          )
        }
      } catch (err) {
        console.warn("[airdrop] request failed:", err)
      }
    })()
  }, [isConnected, initiaAddress])

  return null
}
