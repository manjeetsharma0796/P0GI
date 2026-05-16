"use client"

import { useEffect, useState } from "react"
import { useInterwovenKit } from "@initia/interwovenkit-react"
import { useWallet } from "@/providers/wallet-provider"

const CHAIN_ID = process.env.NEXT_PUBLIC_ROLLUP_CHAIN_ID || "agentbet-1"
const ROLLUP_REST =
  process.env.NEXT_PUBLIC_ROLLUP_REST || "http://localhost:1317"
const ROLLUP_INDEXER =
  process.env.NEXT_PUBLIC_ROLLUP_INDEXER || "http://localhost:8080"

async function fetchChipBalance(address: string): Promise<number> {
  try {
    const res = await fetch(
      `${ROLLUP_REST}/cosmos/bank/v1beta1/balances/${address}?pagination.limit=50`,
    )
    if (!res.ok) return 0
    const json = (await res.json()) as {
      balances: { denom: string; amount: string }[]
    }
    const uchip = json.balances?.find(b => b.denom === "uchip")
    return uchip ? Number(uchip.amount) : 0
  } catch {
    return 0
  }
}

export function WalletPanel() {
  const {
    address,
    initiaAddress,
    username,
    isConnected,
    openConnect,
    openWallet,
    autoSign,
  } = useInterwovenKit()
  const { wallet } = useWallet()

  const [uchipBalance, setUchipBalance] = useState(0)
  const [copied, setCopied] = useState(false)
  const [togglingAutoSign, setTogglingAutoSign] = useState(false)

  const currentAddress = initiaAddress || address || ""
  const displayAddress = username || currentAddress
  const truncated = displayAddress
    ? displayAddress.slice(0, 8) + "..." + displayAddress.slice(-6)
    : ""

  const chipDisplay = (uchipBalance / 1_000_000).toFixed(2)
  const autoSignEnabled = autoSign.isEnabledByChain[CHAIN_ID] ?? false

  // Poll for balance every 5s while connected.
  useEffect(() => {
    if (!currentAddress) return
    let alive = true
    const run = async () => {
      const bal = await fetchChipBalance(currentAddress)
      if (alive) setUchipBalance(bal)
    }
    run()
    const t = setInterval(run, 5_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [currentAddress])

  function handleCopy() {
    if (!currentAddress) return
    navigator.clipboard.writeText(currentAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function toggleAutoSign() {
    setTogglingAutoSign(true)
    try {
      if (autoSignEnabled) {
        await autoSign.disable(CHAIN_ID)
      } else {
        await autoSign.enable(CHAIN_ID)
      }
    } catch (err) {
      console.error("auto-sign toggle failed:", err)
    } finally {
      setTogglingAutoSign(false)
    }
  }

  const badgeStyles: Record<string, string> = {
    deposit: "bg-[#22c55e]/10 text-[#22c55e]",
    bet: "bg-[#f59e0b]/10 text-[#f59e0b]",
    payout: "bg-[#3b82f6]/10 text-[#3b82f6]",
  }

  function formatTime(timestamp: number) {
    const d = new Date(timestamp)
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  }

  function formatAmount(cents: number) {
    return (cents / 100).toFixed(2) + " CHIP"
  }

  // ── Disconnected state ──────────────────────────────────────────────
  if (!isConnected || !currentAddress) {
    return (
      <div className="sticky top-24 flex flex-col gap-5 rounded-xl border border-[#262626] bg-[#141414] p-6">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-medium uppercase tracking-wide text-[#737373]">
            Connect Wallet
          </span>
          <span className="text-xs text-[#737373]/70">
            Connect to agentbet-1 to play and bet with CHIP.
          </span>
        </div>
        <button
          onClick={openConnect}
          className="h-10 rounded-lg bg-[#22c55e] px-5 text-sm font-semibold text-black transition-colors hover:bg-[#16a34a]"
        >
          Connect via InterwovenKit
        </button>
        <div className="rounded-lg border border-[#262626] bg-[#0a0a0a] p-3 text-[11px] leading-relaxed text-[#737373]">
          <p className="mb-1 font-medium text-white/70">Rollup: {CHAIN_ID}</p>
          <p>Your own Initia appchain. CHIP is the native token (6 decimals).</p>
          <p className="mt-2">
            First connect gets airdropped test CHIP by the server — no faucet trip required.
          </p>
        </div>
      </div>
    )
  }

  // ── Connected state ─────────────────────────────────────────────────
  return (
    <div className="sticky top-24 flex flex-col gap-5 rounded-xl border border-[#262626] bg-[#141414] p-6">
      {/* Address row */}
      <div className="flex items-center justify-between">
        <button
          onClick={openWallet}
          className="font-mono text-[13px] text-white/80 hover:text-white hover:underline"
          title="Open wallet drawer"
        >
          {truncated}
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="text-[#737373] hover:text-white"
            aria-label="Copy address"
          >
            {copied ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Balance */}
      <div className="flex flex-col gap-1">
        <span className="text-[32px] font-bold text-white">{chipDisplay}</span>
        <span className="text-xs text-[#737373]">CHIP on {CHAIN_ID}</span>
      </div>

      {/* Auto-sign toggle — NATIVE FEATURE */}
      <div className="flex flex-col gap-2 rounded-lg border border-[#262626] bg-[#0a0a0a] p-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[13px] font-medium text-white">Auto-sign</span>
            <span className="text-[11px] text-[#737373]">
              Rapid bets without wallet popups
            </span>
          </div>
          <button
            onClick={toggleAutoSign}
            disabled={togglingAutoSign || autoSign.isLoading}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              autoSignEnabled ? "bg-[#22c55e]" : "bg-[#262626]"
            } ${togglingAutoSign || autoSign.isLoading ? "opacity-50" : ""}`}
            aria-label="Toggle auto-sign"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                autoSignEnabled ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        {autoSignEnabled && autoSign.expiredAtByChain[CHAIN_ID] ? (
          <span className="text-[10px] text-[#22c55e]/80">
            Active until {autoSign.expiredAtByChain[CHAIN_ID]?.toLocaleTimeString()}
          </span>
        ) : null}
      </div>

      {/* Deposit via InterwovenKit */}
      <button
        onClick={openWallet}
        className="h-9 rounded-lg border border-[#262626] bg-[#0a0a0a] text-sm font-medium text-white hover:border-[#737373]"
      >
        Open Wallet Drawer
      </button>

      {/* Session transaction history (kept from mock) */}
      {wallet.transactions.length > 0 && (
        <div>
          <h3 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-[#737373]">
            Session Transactions
          </h3>
          <div className="max-h-[240px] overflow-auto">
            {wallet.transactions.map((tx, i) => (
              <div
                key={tx.hash + i}
                className={`flex items-center justify-between py-3 ${
                  i < wallet.transactions.length - 1 ? "border-b border-[#262626]" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeStyles[tx.type]}`}
                  >
                    {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                  </span>
                  <span className="font-mono text-sm text-white">
                    {formatAmount(tx.amount)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#737373]">
                    {formatTime(tx.timestamp)}
                  </span>
                  {tx.hash.startsWith("0xMOCK") ? (
                    <span className="font-mono text-xs text-[#737373]">
                      {tx.hash.slice(-6)}
                    </span>
                  ) : (
                    <a
                      href={`${ROLLUP_INDEXER}/tx/${tx.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-[#737373] hover:text-white hover:underline"
                    >
                      {tx.hash.slice(0, 8)}…
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
