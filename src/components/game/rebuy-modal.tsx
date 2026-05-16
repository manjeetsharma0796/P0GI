"use client"

import { useState, useEffect, useCallback } from "react"

interface RebuyModalProps {
  open: boolean
  onRebuy: (amountCents: number) => void
  onTimeout: () => void
  onLeave: () => void
  agentName: string
  agentColor: string
  walletAddress: string
  usdcBalance: number // in cents, may update when user funds
  timeoutSeconds: number // 30
}

export function RebuyModal({
  open,
  onRebuy,
  onTimeout,
  onLeave,
  agentName,
  agentColor,
  walletAddress,
  usdcBalance,
  timeoutSeconds,
}: RebuyModalProps) {
  const [countdown, setCountdown] = useState(timeoutSeconds)
  const [balance, setBalance] = useState(usdcBalance)
  const [sliderValue, setSliderValue] = useState(20)
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)

  // Reset and start countdown whenever modal opens
  useEffect(() => {
    if (!open) return

    setCountdown(timeoutSeconds)
    setBalance(usdcBalance)
    setSliderValue(Math.min(20, usdcBalance))

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          onTimeout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Keep slider max in sync when balance changes
  useEffect(() => {
    if (balance > 0 && sliderValue > balance) {
      setSliderValue(balance)
    }
  }, [balance, sliderValue])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [walletAddress])

  const handleCheckBalance = useCallback(async () => {
    setChecking(true)
    try {
      const res = await fetch(`/api/balance?address=${walletAddress}`)
      const data = await res.json()
      const newBalance = Math.floor(parseFloat(data.usdc || "0") * 100)
      setBalance(newBalance)
      if (newBalance > 0) {
        setSliderValue(Math.max(20, Math.min(sliderValue, newBalance)))
      }
    } catch {
      // silently ignore — user can retry
    } finally {
      setChecking(false)
    }
  }, [walletAddress, sliderValue])

  const handleRebuy = useCallback(() => {
    onRebuy(sliderValue)
  }, [onRebuy, sliderValue])

  const truncatedAddress = walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4)
  const agentLetter = agentName.charAt(0).toUpperCase()

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="flex flex-col rounded-2xl border w-full"
        style={{
          maxWidth: 460,
          backgroundColor: "#0c1018",
          borderColor: "#1a2236",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0 px-5 py-4"
          style={{ borderBottom: "1px solid #1a2236" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="shrink-0 flex items-center justify-center rounded-full text-white font-bold text-sm"
              style={{
                width: 36,
                height: 36,
                backgroundColor: agentColor,
              }}
            >
              {agentLetter}
            </div>
            <span className="font-bold text-white" style={{ fontSize: 16 }}>
              Your agent is out of chips!
            </span>
          </div>

          {/* Countdown */}
          <div
            className="flex items-center justify-center rounded-lg font-mono font-bold tabular-nums"
            style={{
              minWidth: 48,
              height: 36,
              backgroundColor: countdown <= 10 ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.05)",
              color: "#ef4444",
              fontSize: 18,
              padding: "0 10px",
            }}
          >
            {countdown}s
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 px-5 py-5">
          {/* Countdown description */}
          <p className="text-sm" style={{ color: "#6b7280" }}>
            Re-buy within{" "}
            <span className="font-semibold" style={{ color: "#ef4444" }}>
              {countdown} second{countdown !== 1 ? "s" : ""}
            </span>{" "}
            or your agent will be removed from the game.
          </p>

          {/* Wallet address + copy */}
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2.5"
            style={{ backgroundColor: "#060a10", border: "1px solid #1a2236" }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6b7280"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 7V5a2 2 0 0 0-4 0v2" />
            </svg>
            <span className="flex-1 font-mono text-sm text-white/70 truncate">
              {truncatedAddress}
            </span>
            <button
              onClick={handleCopy}
              className="shrink-0 transition-colors cursor-pointer"
              style={{ color: copied ? "#22c55e" : "#6b7280" }}
              aria-label="Copy wallet address"
              title={copied ? "Copied!" : "Copy address"}
            >
              {copied ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          </div>

          <p className="text-xs" style={{ color: "#4b5563" }}>
            Send CHIP to this address on <span style={{ color: "#9ca3af" }}>agentbet-1</span>, then click{" "}
            <span style={{ color: "#9ca3af" }}>Check Balance</span> to refresh.
          </p>

          {/* Balance + check button */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs uppercase tracking-wide font-medium" style={{ color: "#6b7280" }}>
                CHIP Balance
              </span>
              <span className="font-mono font-bold text-white" style={{ fontSize: 20 }}>
                {(balance / 100).toFixed(2)} CHIP
              </span>
            </div>
            <button
              onClick={handleCheckBalance}
              disabled={checking}
              className="flex items-center gap-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer disabled:cursor-default disabled:opacity-60"
              style={{
                height: 36,
                paddingLeft: 14,
                paddingRight: 14,
                backgroundColor: "#141c28",
                border: "1px solid #1a2236",
                color: "#9ca3af",
              }}
            >
              {checking ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                  Checking…
                </>
              ) : (
                "Check Balance"
              )}
            </button>
          </div>

          {/* Slider + Re-buy (only visible when balance > 0) */}
          {balance > 0 && (
            <div
              className="flex flex-col gap-3 rounded-xl p-4"
              style={{ backgroundColor: "#060a10", border: "1px solid #1a2236" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: "#9ca3af" }}>
                  Re-buy amount
                </span>
                <span className="font-mono font-bold text-white text-sm">
                  {(sliderValue / 100).toFixed(2)} CHIP
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={balance}
                step={10}
                value={sliderValue}
                onChange={(e) => setSliderValue(Number(e.target.value))}
                className="w-full accent-[#22c55e] cursor-pointer"
                style={{ height: 4 }}
              />
              <div className="flex items-center justify-between text-xs font-mono" style={{ color: "#4b5563" }}>
                <span>0.20 CHIP</span>
                <span>{(balance / 100).toFixed(2)} CHIP</span>
              </div>
              <button
                onClick={handleRebuy}
                className="w-full rounded-lg text-sm font-bold text-black transition-colors cursor-pointer"
                style={{
                  height: 40,
                  backgroundColor: "#22c55e",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#16a34a")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#22c55e")}
              >
                Re-buy {(sliderValue / 100).toFixed(2)} CHIP
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid #1a2236" }}
        >
          <button
            onClick={onLeave}
            className="text-sm font-medium transition-colors cursor-pointer"
            style={{ color: "#6b7280" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
          >
            Leave Game
          </button>
        </div>
      </div>
    </div>
  )
}
