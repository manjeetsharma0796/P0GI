// 0g/storage/0g-storage.ts
// 0G Storage integration — Log layer (immutable game history) + KV layer (mutable leaderboard)
//
// Log layer:  each completed hand is serialized to JSON → uploaded via MemData → rootHash returned
// KV layer:   per-agent leaderboard stats keyed by agent name, read/written via Batcher + KvClient
//
// Install: bun add @0gfoundation/0g-ts-sdk

import { Indexer, MemData, KvClient, Batcher, getFlowContract } from "@0gfoundation/0g-ts-sdk"
import { ethers } from "ethers"
import { getStorageConfig } from "./config"

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface GameSessionData {
  gameId: string
  handNumber: number
  players: {
    name: string
    stack: number
    holeCards: string[]
  }[]
  communityCards: string[]
  winner: string
  winnerHand: string
  potAmount: number
  actions: {
    agentName: string
    action: string
    amount: number
    message: string
    street: string
  }[]
  settlements: {
    from: string
    to: string
    amount: number
    txHash: string
  }[]
  timestamp: number
}

export interface LeaderboardEntry {
  agentName: string
  wins: number
  losses: number
  totalGames: number
  totalEarnings: number
  biggestPot: number
  lastPlayed: number
}

export interface HandResult {
  winner: boolean
  earnings: number
  potSize: number
}

// ─── Signer / Provider helpers ──────────────────────────────────────────────

function getSigner(): ethers.Wallet {
  const cfg = getStorageConfig()
  if (!cfg.privateKey) throw new Error("ZG_PRIVATE_KEY not set — cannot sign storage transactions")
  const provider = new ethers.JsonRpcProvider(cfg.evmRpc)
  return new ethers.Wallet(cfg.privateKey, provider)
}

function getIndexer(): Indexer {
  const cfg = getStorageConfig()
  return new Indexer(cfg.indexerRpc)
}

function getKvClient(): KvClient {
  const cfg = getStorageConfig()
  if (!cfg.kvNodeRpc) throw new Error("ZG_KV_NODE_RPC not set — cannot read KV data")
  return new KvClient(cfg.kvNodeRpc)
}

function requireStreamId(): string {
  const cfg = getStorageConfig()
  if (!cfg.streamId) throw new Error("ZG_STREAM_ID not set — required for KV leaderboard operations")
  return cfg.streamId
}

// ─── Log Layer — Game History (immutable) ───────────────────────────────────

/**
 * Upload a completed hand/session to 0G Storage (Log layer).
 * Data is serialized to JSON, uploaded via MemData (no temp files), and the
 * rootHash is returned for future retrieval.
 *
 * Requires gas (testnet tokens from https://faucet.0g.ai).
 */
export async function uploadGameSession(sessionData: GameSessionData): Promise<string> {
  const cfg = getStorageConfig()
  const signer = getSigner()
  const indexer = getIndexer()

  const json = JSON.stringify(sessionData)
  const encoded = new TextEncoder().encode(json)

  // MemData wraps an in-memory buffer — no temp files needed
  const memData = new MemData(encoded)

  // merkleTree() MUST be called before upload — populates internal state.
  // Returns [MerkleTree | null, Error | null].
  const [tree, treeErr] = await memData.merkleTree()
  if (treeErr || !tree) throw new Error(`Failed to build merkle tree: ${treeErr?.message ?? "unknown"}`)
  const rootHash = tree.rootHash()

  console.log(`[0G-STORAGE] Uploading hand #${sessionData.handNumber} (${encoded.length} bytes) ...`)

  // SDK expects ethers v5 signer — cast to satisfy type checker with ethers v6
  const [tx, err] = await indexer.upload(memData, cfg.evmRpc, signer as any)

  if (err) {
    console.error(`[0G-STORAGE] Upload failed for hand #${sessionData.handNumber}:`, err)
    throw new Error(`0G Storage upload failed: ${String(err)}`)
  }

  // tx shape: { rootHash, txHash } for single files, { rootHashes[], txHashes[] } for fragmented
  let finalRootHash: string
  if (tx && "rootHash" in tx) {
    finalRootHash = tx.rootHash as string
  } else {
    // Fallback to locally computed root hash
    finalRootHash = rootHash ?? ""
  }

  console.log(`[0G-STORAGE] Hand #${sessionData.handNumber} uploaded — rootHash: ${finalRootHash}`)
  return finalRootHash
}

/**
 * Download a game session from 0G Storage by its rootHash.
 * Downloads are free (no gas required).
 */
export async function downloadGameSession(rootHash: string): Promise<GameSessionData> {
  const indexer = getIndexer()

  console.log(`[0G-STORAGE] Downloading session rootHash: ${rootHash.slice(0, 16)}...`)

  // Download to a temp file path, then read it back.
  // The SDK's download() writes to disk via fs.appendFileSync.
  const { tmpdir } = await import("os")
  const { join } = await import("path")
  const outputPath = join(tmpdir(), `0g-session-${rootHash.slice(0, 12)}-${Date.now()}.json`)

  const err = await indexer.download(rootHash, outputPath, false)
  if (err) {
    console.error(`[0G-STORAGE] Download failed for ${rootHash}:`, err)
    throw new Error(`0G Storage download failed: ${String(err)}`)
  }

  // Read the downloaded file
  const { readFileSync, unlinkSync } = await import("fs")
  try {
    const raw = readFileSync(outputPath, "utf-8")
    const data = JSON.parse(raw) as GameSessionData
    console.log(`[0G-STORAGE] Downloaded hand #${data.handNumber} (game ${data.gameId})`)
    return data
  } finally {
    // Clean up temp file
    try { unlinkSync(outputPath) } catch {}
  }
}

// ─── KV Layer — Leaderboard (mutable) ───────────────────────────────────────

/** Encode a string key to Uint8Array for KV operations. */
function encodeKey(key: string): Uint8Array {
  return new TextEncoder().encode(key)
}

/** Decode a base64 KV value to a UTF-8 string. */
function decodeValue(raw: string): string {
  return Buffer.from(raw, "base64").toString("utf-8")
}

/** Leaderboard key prefix — all agent stats live under this namespace. */
const LB_PREFIX = "leaderboard:"

/** The list of all agent names we track (must stay in sync with types.ts). */
const AGENT_NAMES = ["Llama", "Mistral", "Nemotron", "Qwen"] as const

function leaderboardKey(agentName: string): string {
  return `${LB_PREFIX}${agentName}`
}

function emptyEntry(agentName: string): LeaderboardEntry {
  return {
    agentName,
    wins: 0,
    losses: 0,
    totalGames: 0,
    totalEarnings: 0,
    biggestPot: 0,
    lastPlayed: 0,
  }
}

/**
 * Read a single agent's leaderboard entry from KV.
 * Returns null if no entry exists yet.
 */
export async function getPlayerStats(agentName: string): Promise<LeaderboardEntry | null> {
  try {
    const kvClient = getKvClient()
    const streamId = requireStreamId()
    const key = leaderboardKey(agentName)
    const encodedKey = ethers.encodeBase64(encodeKey(key))

    // getValue returns Value | null, where Value = { version, data: Base64, size }
    const val = await kvClient.getValue(streamId, encodedKey)
    if (!val) return null

    const decoded = decodeValue(val.data)
    return JSON.parse(decoded) as LeaderboardEntry
  } catch (err) {
    console.warn(`[0G-KV] Failed to read stats for ${agentName}:`, (err as Error).message?.slice(0, 80))
    return null
  }
}

/**
 * Fetch leaderboard entries for all agents, sorted by wins descending.
 */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const entries: LeaderboardEntry[] = []

  for (const name of AGENT_NAMES) {
    const stats = await getPlayerStats(name)
    entries.push(stats ?? emptyEntry(name))
  }

  // Sort by wins desc, then by total earnings desc as tiebreaker
  entries.sort((a, b) => b.wins - a.wins || b.totalEarnings - a.totalEarnings)

  return entries
}

/**
 * Update leaderboard stats for an agent after a hand completes.
 * Reads current stats from KV, merges the new result, writes back.
 *
 * Requires gas for the Batcher write.
 */
export async function updateLeaderboard(agentName: string, result: HandResult): Promise<void> {
  const cfg = getStorageConfig()
  const signer = getSigner()
  const indexer = getIndexer()
  const streamId = requireStreamId()

  // Read existing stats (or start fresh)
  const existing = await getPlayerStats(agentName) ?? emptyEntry(agentName)

  // Merge
  const updated: LeaderboardEntry = {
    agentName,
    wins: existing.wins + (result.winner ? 1 : 0),
    losses: existing.losses + (result.winner ? 0 : 1),
    totalGames: existing.totalGames + 1,
    totalEarnings: existing.totalEarnings + result.earnings,
    biggestPot: Math.max(existing.biggestPot, result.potSize),
    lastPlayed: Date.now(),
  }

  const key = leaderboardKey(agentName)
  const keyBytes = encodeKey(key)
  const valueBytes = new TextEncoder().encode(JSON.stringify(updated))

  console.log(`[0G-KV] Updating ${agentName}: ${updated.wins}W/${updated.losses}L, earnings=${updated.totalEarnings}`)

  try {
    // Select storage nodes through the indexer
    const [nodes, selectErr] = await indexer.selectNodes(1)
    if (selectErr || !nodes || nodes.length === 0) {
      throw new Error(`Node selection failed: ${String(selectErr)}`)
    }

    // Discover flow contract address from the first node's status
    const status = await nodes[0].getStatus()
    if (!status?.networkIdentity?.flowAddress) {
      throw new Error("Could not discover flow contract address from storage node")
    }

    // Create FixedPriceFlow contract instance connected to our signer
    const flow = getFlowContract(status.networkIdentity.flowAddress, signer as any)

    // Create a Batcher to write the KV pair
    const batcher = new Batcher(1, nodes, flow, cfg.evmRpc)

    batcher.streamDataBuilder.set(
      streamId,
      keyBytes,
      valueBytes,
    )

    // Execute the batch — requires gas
    const [tx, batchErr] = await batcher.exec()

    if (batchErr) {
      throw new Error(`Batcher exec failed: ${String(batchErr)}`)
    }

    console.log(`[0G-KV] ${agentName} stats updated successfully`)
  } catch (err) {
    console.error(`[0G-KV] Failed to update ${agentName}:`, (err as Error).message?.slice(0, 100))
    throw err
  }
}

// ─── Convenience: batch update after a hand ─────────────────────────────────

/**
 * After a hand completes, archive the session to Log layer and update all
 * players' leaderboard stats on KV layer. Non-fatal — logs errors but does
 * not throw so the game loop is never blocked by storage failures.
 */
export async function recordHandToStorage(
  sessionData: GameSessionData,
  results: Record<string, HandResult>,
): Promise<{ rootHash: string | null; kvErrors: string[] }> {
  let rootHash: string | null = null
  const kvErrors: string[] = []

  // 1. Upload game session to Log layer (immutable archive)
  try {
    rootHash = await uploadGameSession(sessionData)
  } catch (err) {
    console.error("[0G-STORAGE] Game session upload failed (non-fatal):", (err as Error).message?.slice(0, 100))
  }

  // 2. Update leaderboard for each player on KV layer
  for (const [agentName, result] of Object.entries(results)) {
    try {
      await updateLeaderboard(agentName, result)
    } catch (err) {
      const msg = `${agentName}: ${(err as Error).message?.slice(0, 60)}`
      kvErrors.push(msg)
      console.warn(`[0G-KV] Leaderboard update failed (non-fatal): ${msg}`)
    }
  }

  return { rootHash, kvErrors }
}
