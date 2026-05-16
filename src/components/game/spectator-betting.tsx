"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useInterwovenKit } from "@initia/interwovenkit-react"
import { useWallet } from "@/providers/wallet-provider"

const CHAIN_ID = process.env.NEXT_PUBLIC_ROLLUP_CHAIN_ID || "agentbet-1"
const ROLLUP_INDEXER =
  process.env.NEXT_PUBLIC_ROLLUP_INDEXER || "http://localhost:8080"

// Gas-station address on the rollup — side-bet escrow.
const SIDE_BET_ESCROW =
  process.env.NEXT_PUBLIC_SIDE_BET_ESCROW ||
  "init1tec2l52n7c5fpf5630wpn7x7x7rcw84e77730z"

const AGENTS = [
  { id: "Llama",    name: "Llama",    color: "#d97706", letter: "L" },
  { id: "Qwen",     name: "Qwen",     color: "#3b82f6", letter: "Q" },
  { id: "Mistral",  name: "Mistral",  color: "#10b981", letter: "M" },
  { id: "Nemotron", name: "Nemotron", color: "#a855f7", letter: "N" },
] as const

// 1 game-dollar = 1 CHIP. Betting input accepts dollars; convert to uchip.
const CHIP_DECIMALS = 6
const dollarsToUchip = (d: number) => Math.round(d * 10 ** CHIP_DECIMALS)

export function SpectatorBetting() {
  const {
    isConnected,
    initiaAddress,
    openConnect,
    requestTxSync,
    autoSign,
  } = useInterwovenKit()
  const { wallet } = useWallet()

  const [betAmount, setBetAmount] = useState("")
  const [bets, setBets] = useState<Record<string, number>>({})
  const [userBet, setUserBet] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const totalCents = Object.values(bets).reduce((sum, v) => sum + v, 0)
  const poolDisplay = `${(totalCents / 100).toFixed(2)} CHIP`
  const autoSignOn = autoSign.isEnabledByChain[CHAIN_ID] ?? false

  function getPercent(agentId: string): number {
    if (totalCents === 0) return 0
    return Math.round(((bets[agentId] ?? 0) / totalCents) * 100)
  }

  async function handleBet(agentId: string) {
    if (!isConnected || !initiaAddress) {
      openConnect()
      return
    }
    const parsed = parseFloat(betAmount)
    if (isNaN(parsed) || parsed <= 0) return

    setSending(true)
    const toastId = toast.loading(
      autoSignOn ? `Placing ${parsed} CHIP on ${agentId}…` : "Awaiting wallet signature…",
    )
    try {
      const uchip = dollarsToUchip(parsed)
      const txHash = await requestTxSync({
        chainId: CHAIN_ID,
        messages: [
          {
            typeUrl: "/cosmos.bank.v1beta1.MsgSend",
            value: {
              fromAddress: initiaAddress,
              toAddress: SIDE_BET_ESCROW,
              amount: [{ denom: "uchip", amount: String(uchip) }],
            },
          },
        ],
        memo: `agentbet:side-bet:${agentId}`,
      })

      setBets(prev => ({
        ...prev,
        [agentId]: (prev[agentId] ?? 0) + Math.round(parsed * 100),
      }))
      setUserBet(agentId)
      setBetAmount("")
      toast.success(
        <div className="flex flex-col">
          <span>Bet placed on {agentId}</span>
          <a
            href={`${ROLLUP_INDEXER}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] underline"
          >
            {txHash.slice(0, 10)}…
          </a>
        </div>,
        { id: toastId },
      )
    } catch (err) {
      const msg = (err as Error).message?.slice(0, 120) ?? "transaction failed"
      toast.error(msg, { id: toastId })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 240 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#262626]">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-[#737373] uppercase tracking-wide">
            Place Your Bet
          </span>
          {autoSignOn && (
            <span className="rounded-full bg-[#22c55e]/15 px-2 py-0.5 text-[10px] font-medium text-[#22c55e]">
              ⚡ Auto-sign ON
            </span>
          )}
        </div>
        <span className="text-[13px] font-mono text-[#22c55e]">
          Pool: {poolDisplay}
        </span>
      </div>

      {/* Amount input */}
      <div className="px-3 py-2">
        <input
          type="text"
          inputMode="decimal"
          value={betAmount}
          onChange={e => setBetAmount(e.target.value)}
          placeholder="0.00 CHIP"
          disabled={sending}
          className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg h-9 px-3 text-[13px] font-mono text-white placeholder-[#737373]/40 outline-none focus:border-[#737373] transition-colors disabled:opacity-50"
        />
      </div>

      {/* Bet buttons 2x2 */}
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        {AGENTS.map(agent => {
          const pct = getPercent(agent.id)
          const isUserPick = userBet === agent.id
          return (
            <button
              key={agent.id}
              onClick={() => handleBet(agent.id)}
              disabled={sending}
              className={`rounded-lg border bg-transparent h-12 relative overflow-hidden flex items-center px-3 gap-2 transition-all disabled:opacity-50 ${
                isUserPick
                  ? "border-[#22c55e]"
                  : "border-[#262626] hover:border-[#737373] hover:bg-[#1a1a1a]"
              }`}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: agent.color }}
              >
                <span className="text-[11px] font-bold text-white leading-none">
                  {agent.letter}
                </span>
              </div>
              <span className="text-[13px] font-medium text-white flex-1 text-left">
                {agent.name}
              </span>
              <span className="text-[12px] font-mono text-[#737373]">
                {pct}%
              </span>
              <div
                className={`absolute bottom-0 left-0 h-[3px] rounded-full ${
                  isUserPick ? "bg-[#22c55e]/40" : "bg-[#22c55e]/20"
                }`}
                style={{ width: `${pct}%` }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
