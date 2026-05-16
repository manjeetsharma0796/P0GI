"use client"

import { useState } from "react"
import { useEvmWallet } from "@/providers/evm-wallet-provider"

export function ConnectWalletButton() {
  const { address, isConnected, isConnecting, isCorrectChain, chipBalance, connect, disconnect, switchToZgChain } = useEvmWallet()
  const [showDropdown, setShowDropdown] = useState(false)

  // Not connected
  if (!isConnected) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150
          bg-gradient-to-r from-[#00D4AA] to-[#00B894] text-black hover:opacity-90 active:scale-[0.97]
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isConnecting ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="12" />
            </svg>
            Connecting...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="14" rx="2" />
              <path d="M2 10h20" />
              <path d="M16 14h.01" />
            </svg>
            Connect Wallet
          </>
        )}
      </button>
    )
  }

  // Wrong chain
  if (!isCorrectChain) {
    return (
      <button
        onClick={switchToZgChain}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150
          bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] hover:bg-[#ef4444]/20"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        Switch to 0G
      </button>
    )
  }

  const truncated = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""
  const chipDisplay = chipBalance ? parseFloat(chipBalance).toFixed(0) : "0"

  // Connected + correct chain
  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-150
          bg-[#0c1018] border border-[#1a2236] hover:border-[#2a3a56] hover:bg-[#111827]"
      >
        {/* Green dot */}
        <div className="w-2 h-2 rounded-full bg-[#00D4AA] shrink-0" />

        {/* Balance */}
        <span className="font-mono text-white text-xs">{chipDisplay} CHIP</span>

        {/* Divider */}
        <div className="w-px h-4 bg-[#1a2236]" />

        {/* Address */}
        <span className="font-mono text-[#888] text-xs">{truncated}</span>

        {/* Chevron */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-[#1a2236] bg-[#0c1018] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#1a2236]">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-[#00D4AA]" />
                <span className="text-xs text-[#00D4AA] font-medium">0G Galileo Testnet</span>
              </div>
              <p className="font-mono text-xs text-[#888] break-all">{address}</p>
            </div>

            {/* Balance */}
            <div className="px-4 py-3 border-b border-[#1a2236]">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#555]">CHIP Balance</span>
                <span className="font-mono text-sm text-white font-medium">{chipDisplay} CHIP</span>
              </div>
            </div>

            {/* Actions */}
            <div className="p-2 flex flex-col gap-1">
              <a
                href={`https://chainscan-galileo.0g.ai/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#888] hover:bg-[#1a2236] hover:text-white transition-colors"
                onClick={() => setShowDropdown(false)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                View on 0G Explorer
              </a>

              <a
                href="https://faucet.0g.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#888] hover:bg-[#1a2236] hover:text-white transition-colors"
                onClick={() => setShowDropdown(false)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v6l3-3" />
                  <path d="M12 2v6l-3-3" />
                  <path d="M5 16a7 7 0 1 0 14 0c0-3.87-7-11-7-11S5 12.13 5 16z" />
                </svg>
                Get A0GI from Faucet
              </a>

              <button
                onClick={() => { disconnect(); setShowDropdown(false) }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors w-full text-left"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Disconnect
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
