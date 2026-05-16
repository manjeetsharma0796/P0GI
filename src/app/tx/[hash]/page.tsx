"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { NETWORK_LABEL, ROLLUP_REST, ROLLUP_INDEXER, truncateAddress, truncateHash, TOKEN_SYMBOL } from "@/lib/format"

interface CosmosEventAttr { key: string; value: string; index?: boolean }
interface CosmosEvent { type: string; attributes: CosmosEventAttr[] }

interface TxResponse {
  txhash: string
  height: string
  code: number
  gas_used: string
  gas_wanted: string
  timestamp: string
  events: CosmosEvent[]
  raw_log?: string
}
interface TxDetail {
  tx: any
  tx_response: TxResponse
  error?: string
}

function attr(ev: CosmosEvent, key: string): string | null {
  return ev.attributes.find(a => a.key === key)?.value ?? null
}

function findHandSettled(events: CosmosEvent[]) {
  for (const ev of events) {
    if (ev.type !== "move") continue
    const tag = attr(ev, "type_tag")
    if (!tag || !tag.endsWith("::game::HandSettled")) continue
    const data = attr(ev, "data")
    if (!data) continue
    try {
      return JSON.parse(data) as {
        hand_id: string
        table_id: string
        winners: string[]
        payouts: string[]
        losers: string[]
        pot: string
      }
    } catch { /* fall through */ }
  }
  return null
}

function findTransfers(events: CosmosEvent[]) {
  return events
    .filter(e => e.type === "transfer")
    .map(e => ({
      from: attr(e, "sender"),
      to: attr(e, "recipient"),
      amount: attr(e, "amount"),
    }))
    .filter(t => t.from && t.to && t.amount)
}

function findMoveExecute(events: CosmosEvent[]) {
  const ev = events.find(e => {
    if (e.type !== "execute") return false
    const fn = attr(e, "function_name")
    return fn && fn !== "sudo_transfer"
  })
  if (!ev) return null
  return {
    moduleAddr: attr(ev, "module_addr"),
    moduleName: attr(ev, "module_name"),
    functionName: attr(ev, "function_name"),
    sender: attr(ev, "sender"),
  }
}

/** uchip → "X.XX CHIP" */
function fmtUchip(raw: string | number): string {
  const n = typeof raw === "string" ? Number(raw) : raw
  return `${(n / 1_000_000).toFixed(2)} ${TOKEN_SYMBOL}`
}

function fmtUchipStringWithDenom(amt: string | null): string {
  if (!amt) return "—"
  const m = amt.match(/^(\d+)(.+)$/)
  if (!m) return amt
  const uchip = Number(m[1])
  if (m[2] !== "uchip") return amt
  return fmtUchip(uchip)
}

export default function TxPage() {
  const { hash } = useParams<{ hash: string }>()
  const [data, setData] = useState<TxDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!hash) return
    fetch(`/api/tx/${hash}`)
      .then(r => r.json())
      .then(setData)
      .catch(e => setErr(e.message ?? "fetch failed"))
  }, [hash])

  if (err) return <Shell><div className="text-red-400">Error: {err}</div></Shell>
  if (!data) return <Shell><div className="text-muted">Loading tx {truncateHash(hash)}…</div></Shell>
  if (data.error) return <Shell><div className="text-red-400">{data.error}</div></Shell>

  const res = data.tx_response
  if (!res) return <Shell><div className="text-red-400">Unexpected response shape</div></Shell>

  const success = res.code === 0
  const settled = findHandSettled(res.events ?? [])
  const transfers = findTransfers(res.events ?? [])
  const move = findMoveExecute(res.events ?? [])
  const fee = res.gas_used
    ? `${res.gas_used} / ${res.gas_wanted} gas`
    : "—"

  return (
    <Shell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold text-white">Transaction</h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                success ? "bg-[#22c55e]/15 text-[#22c55e]" : "bg-red-500/15 text-red-400"
              }`}
            >
              {success ? "✓ Success" : `✗ Failed (code ${res.code})`}
            </span>
            <span className="text-[11px] text-muted font-mono">{NETWORK_LABEL}</span>
          </div>
        </div>
        <Link href="/" className="text-[12px] text-muted hover:text-white">← back to app</Link>
      </div>

      <Section title="Transaction">
        <Row label="Hash" mono>{res.txhash}</Row>
        <Row label="Block height">{res.height}</Row>
        <Row label="Timestamp">{new Date(res.timestamp).toLocaleString()}</Row>
        <Row label="Gas">{fee}</Row>
      </Section>

      {move && (
        <Section title="Move Call">
          <Row label="Module">
            <span className="font-mono text-[12px]">{move.moduleAddr}::{move.moduleName}</span>
          </Row>
          <Row label="Function"><span className="font-mono">{move.functionName}</span></Row>
          <Row label="Sender" mono>{move.sender}</Row>
        </Section>
      )}

      {settled && (
        <Section title="HandSettled (on-chain audit)">
          <Row label="Hand ID">#{settled.hand_id}</Row>
          <Row label="Table ID">#{settled.table_id}</Row>
          <Row label="Pot"><span className="font-mono text-[#22c55e]">{fmtUchip(settled.pot)}</span></Row>
          <div className="py-2 border-t border-border">
            <div className="text-[11px] uppercase tracking-wide text-muted mb-1">Winners</div>
            {settled.winners.map((w, i) => (
              <div key={w} className="flex items-center justify-between py-1">
                <span className="font-mono text-[12px] text-white">{w}</span>
                <span className="font-mono text-[12px] text-[#22c55e]">+ {fmtUchip(settled.payouts[i] ?? "0")}</span>
              </div>
            ))}
          </div>
          {settled.losers.length > 0 && (
            <div className="py-2 border-t border-border">
              <div className="text-[11px] uppercase tracking-wide text-muted mb-1">Losers</div>
              {settled.losers.map(l => (
                <div key={l} className="py-1">
                  <span className="font-mono text-[12px] text-muted">{l}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {transfers.length > 0 && (
        <Section title="Transfers">
          <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-3 gap-y-1 text-[12px]">
            <div className="text-muted font-mono">From</div>
            <div></div>
            <div className="text-muted font-mono">To</div>
            <div className="text-muted font-mono text-right">Amount</div>
            {transfers.map((t, i) => (
              <>
                <div key={`f${i}`} className="font-mono truncate" title={t.from ?? ""}>{truncateAddress(t.from ?? "", 10, 8)}</div>
                <div key={`a${i}`} className="text-muted">→</div>
                <div key={`t${i}`} className="font-mono truncate" title={t.to ?? ""}>{truncateAddress(t.to ?? "", 10, 8)}</div>
                <div key={`m${i}`} className="font-mono text-right">{fmtUchipStringWithDenom(t.amount)}</div>
              </>
            ))}
          </div>
        </Section>
      )}

      <div className="mt-8 flex gap-3">
        <a
          href={`${ROLLUP_REST}/cosmos/tx/v1beta1/txs/${res.txhash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] text-muted hover:text-white underline underline-offset-2"
        >
          view raw JSON ↗
        </a>
        <a
          href={`${ROLLUP_INDEXER}/tx/${res.txhash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] text-muted hover:text-white underline underline-offset-2"
        >
          indexer ↗
        </a>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#060a10] py-10 px-6">
      <div className="max-w-3xl mx-auto">{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 bg-[#0c1018] border border-[#1a2236] rounded-xl overflow-hidden">
      <div className="px-4 py-2 border-b border-[#1a2236] text-[11px] uppercase tracking-wide text-muted font-medium">
        {title}
      </div>
      <div className="px-4 py-3 flex flex-col">
        {children}
      </div>
    </section>
  )
}

function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-1.5 gap-3">
      <span className="text-[11px] text-muted uppercase tracking-wide w-32 shrink-0 pt-0.5">{label}</span>
      <span className={`text-[13px] text-white break-all text-right ${mono ? "font-mono" : ""}`}>{children}</span>
    </div>
  )
}
