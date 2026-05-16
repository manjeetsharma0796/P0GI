// Use node:child_process so this module loads under both Bun and Node.
// Next.js's build worker spawns a Node process to collect API-route metadata,
// which couldn't resolve the `bun` builtin and failed the build.
import { spawn } from "node:child_process"
import { INITIA_CHAIN, AGENT_WALLETS, GAS_STATION_ADDRESS, GAME_MODULE, toChip } from "../shared/chain"

const CLI = process.env.MINITIAD_PATH || "minitiad"
const NODE = process.env.ROLLUP_RPC || INITIA_CHAIN.rollup.rpc
const CHAIN = INITIA_CHAIN.rollup.chainId
const GAS_PRICES = INITIA_CHAIN.rollup.gasPrices
const KEYRING = "test"

export interface TxResult {
  txhash: string
  code: number
  rawLog: string
}

export interface SettlementInput {
  handId: number
  tableId: number
  winners: { address: string; uchipGain: number }[]
  losers: { address: string; uchipLost: number }[]
  pot: number
}

async function runCli(args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const proc = spawn(CLI, args, { stdio: ["ignore", "pipe", "pipe"] })
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    proc.stdout.on("data", (c: Buffer) => stdoutChunks.push(c))
    proc.stderr.on("data", (c: Buffer) => stderrChunks.push(c))
    proc.on("error", (e) => reject(e))
    proc.on("close", (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8")
      const stderr = Buffer.concat(stderrChunks).toString("utf8")
      if (code !== 0) {
        reject(new Error(`minitiad failed (code ${code}): ${stderr || stdout}`))
        return
      }
      resolve(stdout)
    })
  })
}

function parseTxOutput(raw: string): TxResult {
  const codeMatch = raw.match(/^code:\s*(\d+)/m)
  const txhashMatch = raw.match(/^txhash:\s*([A-Fa-f0-9]+)/m)
  return {
    code: codeMatch ? Number(codeMatch[1]) : -1,
    txhash: txhashMatch ? txhashMatch[1] : "",
    rawLog: raw,
  }
}

async function keyExists(keyName: string): Promise<boolean> {
  try {
    await runCli(["keys", "show", keyName, "--keyring-backend", KEYRING])
    return true
  } catch {
    return false
  }
}

export async function queryBalance(address: string): Promise<number> {
  const out = await runCli([
    "query", "bank", "balances", address,
    "--node", NODE,
    "--output", "json",
  ])
  const json = JSON.parse(out) as { balances: { denom: string; amount: string }[] }
  const uchip = json.balances?.find(b => b.denom === "uchip")
  return uchip ? Number(uchip.amount) : 0
}

export async function sendUchip(
  fromKey: string,
  toAddress: string,
  uchipAmount: number,
): Promise<TxResult> {
  const out = await runCli([
    "tx", "bank", "send", fromKey, toAddress, `${uchipAmount}uchip`,
    "--keyring-backend", KEYRING,
    "--from", fromKey,
    "--gas", "auto",
    "--gas-adjustment", "1.5",
    "--gas-prices", GAS_PRICES,
    "--node", NODE,
    "--chain-id", CHAIN,
    "--yes",
  ])
  const result = parseTxOutput(out)
  if (result.code !== 0) {
    throw new Error(`send failed: ${result.rawLog}`)
  }
  return result
}

export async function airdrop(toAddress: string, uchipAmount: number): Promise<TxResult> {
  return sendUchip("gas-station", toAddress, uchipAmount)
}

async function bech32ToHex(bech32Addr: string): Promise<string> {
  const out = await runCli(["keys", "parse", bech32Addr])
  // Output contains "bytes: <40-char hex>"
  const match = out.match(/bytes:\s*([A-Fa-f0-9]+)/)
  if (!match) throw new Error(`bech32ToHex: could not parse bytes from ${out}`)
  return `0x${match[1].toLowerCase()}`
}

/**
 * Record a hand's authoritative settlement on-chain via the `game::record_hand`
 * entry function. Signed by gas-station (the @agentbet admin). Emits a
 * HandSettled event that the frontend indexer picks up.
 */
export async function recordHand(params: {
  handId: number
  tableId: number
  winners: string[]    // bech32 addresses
  payouts: number[]    // uchip per winner, same length as winners
  losers: string[]     // bech32 addresses
  pot: number          // uchip
}): Promise<TxResult> {
  const winnersHex = await Promise.all(params.winners.map(bech32ToHex))
  const losersHex = await Promise.all(params.losers.map(bech32ToHex))

  const argsArray = [
    `u64:${params.handId}`,
    `u64:${params.tableId}`,
    `vector<address>:${winnersHex.join(",")}`,
    `vector<u64>:${params.payouts.join(",")}`,
    `vector<address>:${losersHex.length > 0 ? losersHex.join(",") : ""}`,
    `u64:${params.pot}`,
  ]

  const out = await runCli([
    "tx", "move", "execute",
    GAME_MODULE.address, GAME_MODULE.name, GAME_MODULE.entryFn,
    "--args", JSON.stringify(argsArray),
    "--keyring-backend", KEYRING,
    "--from", "gas-station",
    "--gas", "auto",
    "--gas-adjustment", "1.5",
    "--gas-prices", GAS_PRICES,
    "--node", NODE,
    "--chain-id", CHAIN,
    "--yes",
  ])
  const result = parseTxOutput(out)
  if (result.code !== 0) {
    throw new Error(`recordHand failed (code ${result.code}): ${result.rawLog}`)
  }
  return result
}

export function findAgentKeyByAddress(address: string): string {
  for (const info of Object.values(AGENT_WALLETS)) {
    if (info.address === address) return info.keyName
  }
  throw new Error(`no agent key found for address ${address}`)
}

/**
 * Settle a hand purely via bank MsgSend:
 *   for each loser → send uchipLost to the (first) winner.
 * Returns the tx hash of every settlement transfer. These show up on the
 * block explorer and shift visible balances on the 4 agent wallets.
 *
 * Multi-winner split-pot support: if there are multiple winners, the pot is
 * routed via a round-robin proportional to each winner's uchipGain.
 */
export async function settleHandOnChain(s: SettlementInput): Promise<TxResult[]> {
  if (s.winners.length === 0) {
    throw new Error("settleHandOnChain: need at least one winner")
  }
  const totalWinnerGain = s.winners.reduce((acc, w) => acc + w.uchipGain, 0)
  if (totalWinnerGain <= 0) {
    throw new Error("settleHandOnChain: total winner gain must be > 0")
  }

  const txs: TxResult[] = []
  for (const loser of s.losers) {
    if (loser.uchipLost <= 0) continue
    const loserKey = findAgentKeyByAddress(loser.address)
    let remaining = loser.uchipLost
    const lastIdx = s.winners.length - 1
    for (let i = 0; i <= lastIdx; i++) {
      const w = s.winners[i]
      const share =
        i === lastIdx
          ? remaining
          : Math.floor((loser.uchipLost * w.uchipGain) / totalWinnerGain)
      if (share <= 0) continue
      const tx = await sendUchip(loserKey, w.address, share)
      txs.push(tx)
      remaining -= share
    }
  }
  return txs
}

/**
 * Log helper — human-readable rendering of a settlement for the console / chat.
 */
export function explainSettlement(s: SettlementInput, txs: TxResult[]): string {
  const lines = [
    `hand #${s.handId} settled — pot ${toChip(s.pot).toFixed(2)} CHIP`,
    ...s.winners.map(w => `  + ${toChip(w.uchipGain).toFixed(2)} CHIP → ${w.address}`),
    ...s.losers.map(l => `  - ${toChip(l.uchipLost).toFixed(2)} CHIP ← ${l.address}`),
    ...txs.map(t => `    tx ${t.txhash.slice(0, 10)}…  code=${t.code}`),
  ]
  return lines.join("\n")
}

export async function ensureAllAgentKeysPresent(): Promise<void> {
  const missing: string[] = []
  for (const [name, info] of Object.entries(AGENT_WALLETS)) {
    if (!(await keyExists(info.keyName))) missing.push(name)
  }
  if (missing.length > 0) {
    throw new Error(
      `missing minitiad keys for agents: ${missing.join(", ")}. ` +
        `Run the setup script or re-import via 'minitiad keys add'.`,
    )
  }
}

export async function ensureGasStationKey(): Promise<void> {
  if (!(await keyExists("gas-station"))) {
    throw new Error(
      "gas-station key missing from keyring. Import via the mnemonic in ~/.weave/config.json.",
    )
  }
}

export const chain = {
  cli: CLI,
  node: NODE,
  chainId: CHAIN,
  denom: INITIA_CHAIN.rollup.denom,
  decimals: INITIA_CHAIN.rollup.decimals,
  gasStation: GAS_STATION_ADDRESS,
  agents: AGENT_WALLETS,
}
