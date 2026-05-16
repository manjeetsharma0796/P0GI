// modules/agent/ows.ts
// OWS-compliant wallet management using @open-wallet-standard CLI
// Encrypted AES-256-GCM vault, policy-gated signing, multi-chain support
// Wallets stored in ~/.ows/ — keys never in plaintext

import { execSync } from "child_process"
import type { AgentName, Wallet } from "../shared/types"

// ─── Config ──────────────────────────────────────────────────────────────────

const OWS_DOCKER = process.env.OWS_DOCKER || "ows-agent-poker"
const OWS_DIRECT = process.env.OWS_DIRECT === "true"
const PASSPHRASE = process.env.OWS_PASSPHRASE || "agent-poker-hackathon"
const RPC_URL    = process.env.NEXT_PUBLIC_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"

// Run OWS CLI command via Docker container
function ows(cmd: string): string {
  try {
    const fullCmd = OWS_DIRECT ? `ows ${cmd}` : `docker exec ${OWS_DOCKER} ows ${cmd}`
    const result = execSync(fullCmd, {
      encoding: "utf-8",
      timeout: 15000,
    })
    return result.trim()
  } catch (e: any) {
    console.log(`[OWS ERROR] ${e.message?.slice(0, 100)}`)
    return e.stdout?.trim() ?? ""
  }
}

// ─── OWS Wallet addresses (pre-created, stored in encrypted vault) ──────────

const OWS_WALLETS: Record<string, { walletId: string; evmAddress: string }> = {
  Llama:    { walletId: "47f63e8d-7c27-4381-86c6-a866ec82d776", evmAddress: "0x51dA09aB2EF760314a489D35b8207657cF471284" },
  Mistral:  { walletId: "31a38c2a-0e61-45c4-bd89-c8305d1c02d5", evmAddress: "0x2F445DB3961E33d6500537Cd796b4812CBf7Db6b" },
  Nemotron: { walletId: "2fa299fa-127f-425f-a946-6df4ee1b080e", evmAddress: "0x765A6824A400f714a59d99FbF4A04C252A5E328e" },
  Qwen:     { walletId: "1e7afcb7-f879-4830-b9e0-93b997d59909", evmAddress: "0xcA10A9910b62979eDA09A92CB78720fF67ffdb00" },
  Pot:      { walletId: "856bcf16-fef1-4cc7-b29c-303e1dd33b06", evmAddress: "0xaD2390a2C25cAF161A61d7cCD0Cd197F1130e8E8" },
}

// ─── Wallet Operations ───────────────────────────────────────────────────────

export function createAgentWallet(agentName: AgentName): Wallet {
  const entry = OWS_WALLETS[agentName]
  if (entry) {
    console.log(`[OWS] Loaded wallet for ${agentName}: ${entry.evmAddress} (vault: ${entry.walletId})`)
    return { address: entry.evmAddress, agentName }
  }

  // Create new wallet via OWS CLI if not pre-registered
  const walletName = `poker-${agentName.toLowerCase()}`
  const output = ows(`wallet create --name ${walletName}`)
  const evmMatch = output.match(/eip155:1 → (0x[a-fA-F0-9]+)/)
  const address = evmMatch?.[1] ?? ""
  console.log(`[OWS] Created wallet for ${agentName}: ${address}`)
  return { address, agentName }
}

export async function setupAllWallets(
  agentNames: AgentName[],
  _startingBalanceUsdc: number
): Promise<Record<AgentName, Wallet>> {
  const wallets: Partial<Record<AgentName, Wallet>> = {}
  for (const name of agentNames) {
    wallets[name] = createAgentWallet(name)
  }
  return wallets as Record<AgentName, Wallet>
}

export function getAgentAddress(agentName: AgentName): string {
  return OWS_WALLETS[agentName]?.evmAddress ?? ""
}

export function getPotAddress(): string {
  return OWS_WALLETS.Pot.evmAddress
}

export async function getBalance(address: string): Promise<number> {
  return 0  // Balance is public on-chain data — read via RPC in production
}

// ─── OWS Signing ─────────────────────────────────────────────────────────────

/**
 * Sign a message using OWS encrypted vault.
 * Flow: request → policy check → key decrypt (AES-256-GCM) → sign → key wipe
 */
export function owsSignMessage(agentName: AgentName, message: string): string {
  const walletName = `poker-${agentName.toLowerCase()}`
  const result = ows(`sign message --wallet ${walletName} --chain ethereum --message "${message}"`)
  const sigMatch = result.match(/([a-fA-F0-9]{128,})/)
  return sigMatch?.[1] ?? result
}

/**
 * Sign a transaction using OWS. Policy is evaluated before key decryption.
 */
export function owsSignTransaction(agentName: AgentName, txHex: string): string {
  const walletName = `poker-${agentName.toLowerCase()}`
  const result = ows(`sign tx --wallet ${walletName} --chain 11155111 --tx "${txHex}" --json`)
  return result
}

/**
 * Sign and broadcast a transaction via OWS.
 * The RPC URL is passed to OWS so it can broadcast after signing.
 */
export function owsSignAndSend(agentName: AgentName, txHex: string): string {
  const walletName = `poker-${agentName.toLowerCase()}`
  const result = ows(`sign tx --wallet ${walletName} --chain evm --tx "${txHex}" --passphrase "${PASSPHRASE}" --rpc "${RPC_URL}" --send`)
  const txMatch = result.match(/0x[a-fA-F0-9]{64}/)
  return txMatch?.[0] ?? result
}

// ─── Private key export (for x402 SDK compatibility) ─────────────────────────

/**
 * Export private key from OWS vault for x402 signing.
 * In production, x402 should sign through OWS's signing interface directly.
 */
export function getAgentPrivateKey(address: string): `0x${string}` | undefined {
  const entry = Object.values(OWS_WALLETS).find(
    (w) => w.evmAddress.toLowerCase() === address.toLowerCase()
  )
  if (!entry) return undefined

  // Find wallet name from address
  const agentName = Object.entries(OWS_WALLETS).find(
    ([_, w]) => w.evmAddress.toLowerCase() === address.toLowerCase()
  )?.[0]
  if (!agentName) return undefined

  const walletName = `poker-${agentName.toLowerCase()}`
  const exported = ows(`wallet export --name ${walletName} --passphrase "${PASSPHRASE}"`)

  // OWS exports the mnemonic — we need to derive the private key from it
  // For the hackathon, the export gives us what we need for x402 signing
  if (exported.includes("0x")) {
    const keyMatch = exported.match(/(0x[a-fA-F0-9]{64})/)
    return keyMatch?.[1] as `0x${string}` | undefined
  }
  return undefined
}

// ─── List wallets ────────────────────────────────────────────────────────────

export function listAgentWallets(): string {
  return ows("wallet list")
}
