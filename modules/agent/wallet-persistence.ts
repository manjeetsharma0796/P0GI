// modules/agent/wallet-persistence.ts
// Persistent wallet storage — survives page reload
// Uses localStorage (client) or file-based (server/testing)
// OWS wallet addresses are real EOAs on Base Sepolia

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import {
  createPublicClient,
  http,
  formatUnits,
  type Address,
} from "viem"
import { baseSepolia } from "viem/chains"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PersistedWallet {
  address:     string
  privateKey:  string     // hex string — encrypted in production
  agentName:   string
  skillId:     string
  model:       string
  createdAt:   number
  lastUsedAt:  number
}

export interface UserProfile {
  wallets:       PersistedWallet[]
  activeWallet:  string | null    // address of currently selected wallet
  stats: {
    gamesPlayed:    number
    handsPlayed:    number
    totalWins:      number
    totalEarnings:  number  // in cents
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY   = "agent_poker_profile"
const USDC_ADDRESS  = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address // USDC on Base Sepolia
const RPC_URL       = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org"

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

// ─── Storage Backend ──────────────────────────────────────────────────────────
// Uses localStorage in browser, in-memory fallback for server/tests

let memoryStore: Record<string, string> = {}

function storageGet(key: string): string | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return localStorage.getItem(key)
  }
  return memoryStore[key] ?? null
}

function storageSet(key: string, value: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.setItem(key, value)
  }
  memoryStore[key] = value
}

// ─── Profile Management ──────────────────────────────────────────────────────

function defaultProfile(): UserProfile {
  return {
    wallets: [],
    activeWallet: null,
    stats: { gamesPlayed: 0, handsPlayed: 0, totalWins: 0, totalEarnings: 0 },
  }
}

export function loadProfile(): UserProfile {
  const raw = storageGet(STORAGE_KEY)
  if (!raw) return defaultProfile()
  try {
    return JSON.parse(raw) as UserProfile
  } catch {
    return defaultProfile()
  }
}

export function saveProfile(profile: UserProfile): void {
  storageSet(STORAGE_KEY, JSON.stringify(profile))
}

// ─── Wallet Operations ───────────────────────────────────────────────────────

/**
 * Create a new persistent wallet for an agent.
 * Generates a real EOA on Base Sepolia. Private key stored locally.
 */
export function createPersistentWallet(
  agentName: string,
  skillId: string,
  model: string
): PersistedWallet {
  const privateKey = generatePrivateKey()
  const account    = privateKeyToAccount(privateKey)

  const wallet: PersistedWallet = {
    address:    account.address,
    privateKey: privateKey,
    agentName,
    skillId,
    model,
    createdAt:  Date.now(),
    lastUsedAt: Date.now(),
  }

  // Save to profile
  const profile = loadProfile()
  profile.wallets.push(wallet)
  if (!profile.activeWallet) profile.activeWallet = wallet.address
  saveProfile(profile)

  console.log(`[WALLET] Created persistent wallet for ${agentName}: ${account.address}`)
  return wallet
}

/**
 * Get an existing wallet or create a new one.
 * This is the main entry point — call on every session start.
 */
export function getOrCreateWallet(
  agentName: string,
  skillId: string,
  model: string
): PersistedWallet {
  const profile = loadProfile()
  const existing = profile.wallets.find((w) => w.agentName === agentName)

  if (existing) {
    // Update skill + model if changed, mark as used
    existing.skillId   = skillId
    existing.model     = model
    existing.lastUsedAt = Date.now()
    saveProfile(profile)
    console.log(`[WALLET] Loaded existing wallet for ${agentName}: ${existing.address}`)
    return existing
  }

  return createPersistentWallet(agentName, skillId, model)
}

/**
 * Get all persistent wallets
 */
export function getAllWallets(): PersistedWallet[] {
  return loadProfile().wallets
}

/**
 * Get wallet by address
 */
export function getWalletByAddress(address: string): PersistedWallet | undefined {
  return loadProfile().wallets.find((w) => w.address.toLowerCase() === address.toLowerCase())
}

/**
 * Get private key for signing transactions (used by x402)
 */
export function getPrivateKey(address: string): `0x${string}` | undefined {
  const wallet = getWalletByAddress(address)
  return wallet?.privateKey as `0x${string}` | undefined
}

/**
 * Read on-chain USDC balance on Base Sepolia
 */
export async function getOnChainBalance(address: string): Promise<{
  usdc: string     // human-readable "1.50"
  eth:  string     // human-readable "0.001"
}> {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
  })

  const [usdcRaw, ethRaw] = await Promise.all([
    client.readContract({
      address: USDC_ADDRESS,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [address as Address],
    }),
    client.getBalance({ address: address as Address }),
  ])

  return {
    usdc: formatUnits(usdcRaw, 6),    // USDC has 6 decimals
    eth:  formatUnits(ethRaw, 18),
  }
}

/**
 * Update stats after a game
 */
export function updateStats(won: boolean, earnings: number, handsPlayed: number): void {
  const profile = loadProfile()
  profile.stats.gamesPlayed++
  profile.stats.handsPlayed += handsPlayed
  if (won) profile.stats.totalWins++
  profile.stats.totalEarnings += earnings
  saveProfile(profile)
}

/**
 * Export wallet for backup (user downloads this)
 */
export function exportWallet(address: string): string | null {
  const wallet = getWalletByAddress(address)
  if (!wallet) return null
  return JSON.stringify({
    address:   wallet.address,
    privateKey: wallet.privateKey,
    agentName: wallet.agentName,
    skillId:   wallet.skillId,
    exportedAt: Date.now(),
    network:   "base-sepolia",
    chainId:   84532,
  }, null, 2)
}

/**
 * Import wallet from backup
 */
export function importWallet(json: string): PersistedWallet | null {
  try {
    const data = JSON.parse(json)
    if (!data.address || !data.privateKey) return null

    const wallet: PersistedWallet = {
      address:    data.address,
      privateKey: data.privateKey,
      agentName:  data.agentName || "Imported",
      skillId:    data.skillId || "tag",
      model:      data.model || "meta/llama-3.3-70b-instruct",
      createdAt:  data.exportedAt || Date.now(),
      lastUsedAt: Date.now(),
    }

    const profile = loadProfile()
    // Don't duplicate
    if (!profile.wallets.find((w) => w.address.toLowerCase() === wallet.address.toLowerCase())) {
      profile.wallets.push(wallet)
      saveProfile(profile)
    }
    return wallet
  } catch {
    return null
  }
}

/**
 * Clear all wallets (danger zone)
 */
export function resetAllWallets(): void {
  saveProfile(defaultProfile())
}
