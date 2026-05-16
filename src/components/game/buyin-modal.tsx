"use client"

import { useState } from "react"

interface BuyInModalProps {
  open: boolean
  onConfirm: (amountCents: number) => void
  agentName: string
  agentColor: string
  walletAddress: string
  usdcBalance: number  // in cents
  minBuyCents: number  // big blind = 20 cents
}

export function BuyInModal({
  open,
  onConfirm,
  agentName,
  agentColor,
  walletAddress,
  usdcBalance,
  minBuyCents,
}: BuyInModalProps) {
  const defaultAmount = Math.floor(usdcBalance / 2 / 10) * 10
  const [amount, setAmount] = useState(defaultAmount > 0 ? defaultAmount : minBuyCents)
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const truncatedAddress = walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4)

  function handleCopy() {
    navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) return // modal is not dismissable — must confirm
  }

  const noFunds = usdcBalance <= 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={handleBackdropClick}
    >
      <div
        className="flex flex-col rounded-2xl border w-full"
        style={{
          maxWidth: 440,
          backgroundColor: "#0c1018",
          borderColor: "#1a2236",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 shrink-0 px-5 pt-5 pb-4"
          style={{ borderBottom: "1px solid #1a2236" }}
        >
          {/* Colored dot */}
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: agentColor }}
          />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-white" style={{ fontSize: 15 }}>
              {agentName}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono text-[12px] text-[#555]">
                {truncatedAddress}
              </span>
              <button
                onClick={handleCopy}
                className="text-[#555] hover:text-white transition-colors"
                aria-label="Copy wallet address"
              >
                {copied ? (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="ml-auto flex flex-col items-end">
            <span className="text-[11px] text-[#555] uppercase tracking-wide">Available</span>
            <span className="font-mono text-sm text-white">
              {Math.floor(usdcBalance / 100)} CHIP
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 px-5 py-5">
          {noFunds ? (
            /* No funds state */
            <div className="flex flex-col items-center gap-4 py-3">
              <div
                className="flex items-center justify-center rounded-full"
                style={{ width: 44, height: 44, backgroundColor: "#1a2236" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="text-sm text-[#888] text-center leading-relaxed">
                Your agent has no funds. Fund wallet first.
              </p>
              {/* Copyable wallet address */}
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 w-full"
                style={{ backgroundColor: "#060a10", border: "1px solid #1a2236" }}
              >
                <span className="font-mono text-[12px] text-[#555] flex-1 truncate">
                  {walletAddress}
                </span>
                <button
                  onClick={handleCopy}
                  className="shrink-0 text-[#555] hover:text-white transition-colors"
                  aria-label="Copy wallet address"
                >
                  {copied ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Slider state */
            <>
              {/* Amount display */}
              <div className="flex flex-col items-center gap-1">
                <span
                  className="text-[40px] font-bold font-mono"
                  style={{ color: agentColor }}
                >
                  {Math.floor(amount / 100)} CHIP
                </span>
                <span className="text-xs text-[#555]">Buy-in amount</span>
              </div>

              {/* Slider */}
              <div className="flex flex-col gap-2">
                <input
                  type="range"
                  min={minBuyCents}
                  max={usdcBalance}
                  step={10}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer outline-none"
                  style={{
                    background: `linear-gradient(to right, ${agentColor} 0%, ${agentColor} ${((amount - minBuyCents) / (usdcBalance - minBuyCents)) * 100}%, #1a2236 ${((amount - minBuyCents) / (usdcBalance - minBuyCents)) * 100}%, #1a2236 100%)`,
                    // Thumb color via CSS custom property workaround — we inject a style tag below
                  }}
                />
                {/* Min / Max labels */}
                <div className="flex justify-between">
                  <span className="text-[11px] font-mono text-[#555]">
                    {Math.floor(minBuyCents / 100)}
                  </span>
                  <span className="text-[11px] font-mono text-[#555]">
                    {Math.floor(usdcBalance / 100)}
                  </span>
                </div>
              </div>

              {/* Quick select buttons */}
              <div className="flex gap-2">
                {[0.25, 0.5, 0.75, 1].map((frac) => {
                  const val = Math.round((minBuyCents + (usdcBalance - minBuyCents) * frac) / 10) * 10
                  const label = frac === 1 ? "Max" : `${Math.round(frac * 100)}%`
                  return (
                    <button
                      key={frac}
                      onClick={() => setAmount(Math.min(val, usdcBalance))}
                      className="flex-1 h-7 rounded-lg text-[11px] font-medium transition-colors"
                      style={{
                        backgroundColor: amount === Math.min(val, usdcBalance) ? agentColor + "20" : "#1a2236",
                        color: amount === Math.min(val, usdcBalance) ? agentColor : "#555",
                        border: `1px solid ${amount === Math.min(val, usdcBalance) ? agentColor + "40" : "transparent"}`,
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!noFunds && (
          <div className="px-5 pb-5">
            <button
              onClick={() => onConfirm(amount)}
              className="w-full h-11 rounded-xl text-sm font-semibold text-black transition-opacity hover:opacity-90 active:opacity-80"
              style={{ backgroundColor: agentColor }}
            >
              Confirm Buy-in
            </button>
          </div>
        )}

        {/* Inline slider thumb style */}
        <style>{`
          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: ${noFunds ? "#1a2236" : agentColor};
            cursor: pointer;
            border: 2px solid #0c1018;
            box-shadow: 0 0 0 1px ${noFunds ? "#1a2236" : agentColor}40;
          }
          input[type="range"]::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: ${noFunds ? "#1a2236" : agentColor};
            cursor: pointer;
            border: 2px solid #0c1018;
            box-shadow: 0 0 0 1px ${noFunds ? "#1a2236" : agentColor}40;
          }
        `}</style>
      </div>
    </div>
  )
}
