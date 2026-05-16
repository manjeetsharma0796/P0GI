// modules/agent/x402.ts
// x402 payment settlement for poker bets
// Live mode: signs USDC transfers via OWS Docker container, broadcasts on Ethereum Sepolia
// Simulated mode: in-memory balance tracking for demo/dev

import {
  createPublicClient,
  http,
  parseUnits,
  encodeFunctionData,
  serializeTransaction,
  type Address,
  type TransactionSerializable,
} from "viem"
import { sepolia } from "viem/chains"
import { execSync } from "child_process"
import type { TxHash } from "../shared/types"

// ─── Constants ──────────────────────────────────────────────────────────────

const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"
const OWS_DOCKER = process.env.OWS_DOCKER || "ows-agent-poker"
const OWS_DIRECT = process.env.OWS_DIRECT === "true" // true = call ows binary directly (Railway), false = docker exec

// ERC-20 transfer ABI fragment
const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

// ─── Address-to-OWS wallet name mapping ─────────────────────────────────────

const ADDRESS_TO_OWS_WALLET: Record<string, string> = {
  "0x51dA09aB2EF760314a489D35b8207657cF471284": "poker-llama",
  "0x2F445DB3961E33d6500537Cd796b4812CBf7Db6b": "poker-mistral",
  "0x765A6824A400f714a59d99FbF4A04C252A5E328e": "poker-deepseek",   // Nemotron uses deepseek wallet
  "0xcA10A9910b62979eDA09A92CB78720fF67ffdb00": "poker-qwen",
}

// Also include the Pot address — signed by poker-llama as the house/dealer
const POT_ADDRESS = "0xaD2390a2C25cAF161A61d7cCD0Cd197F1130e8E8"

function getOWSWalletName(address: string): string | undefined {
  // Case-insensitive lookup
  const normalized = Object.entries(ADDRESS_TO_OWS_WALLET).find(
    ([addr]) => addr.toLowerCase() === address.toLowerCase()
  )
  return normalized?.[1]
}

// ─── Simulated mode state ───────────────────────────────────────────────────

const simulatedBalances: Record<string, number> = {}
let txCounter = 1

function isLiveMode(): boolean {
  return process.env.X402_LIVE === "true"
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Settle a bet — transfer USDC from one wallet to another.
 * In live mode: builds unsigned tx, signs via OWS Docker, broadcasts on Sepolia.
 * In simulated mode: in-memory balance tracking.
 */
export async function settleBet(
  fromAddress: string,
  toAddress: string,
  amountCents: number
): Promise<TxHash> {
  if (isLiveMode()) {
    return settleOnChainViaOWS(fromAddress, toAddress, amountCents)
  }
  return settleSimulated(fromAddress, toAddress, amountCents)
}

/**
 * Distribute pot winnings to the winner.
 */
export async function distributeWinnings(
  potAddress: string,
  winnerAddress: string,
  totalPotCents: number
): Promise<TxHash> {
  return settleBet(potAddress, winnerAddress, totalPotCents)
}

// ─── Live on-chain settlement via OWS Docker signing ────────────────────────

/**
 * Real USDC transfer on Ethereum Sepolia, signed through OWS in Docker.
 *
 * Flow:
 *  1. Build unsigned EIP-1559 tx (USDC transfer call)
 *  2. Serialize unsigned with viem
 *  3. Sign via: docker exec ows-agent-poker ows sign tx ...
 *  4. Parse JSON response { signature, recovery_id }
 *  5. Combine signature with tx via serializeTransaction
 *  6. Broadcast with sendRawTransaction
 */
async function settleOnChainViaOWS(
  fromAddress: string,
  toAddress: string,
  amountCents: number
): Promise<TxHash> {
  const walletName = getOWSWalletName(fromAddress)
  if (!walletName) {
    throw new Error(
      `[x402] No OWS wallet mapped for address ${fromAddress}. ` +
      `Known addresses: ${Object.keys(ADDRESS_TO_OWS_WALLET).join(", ")}`
    )
  }

  const client = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  })

  // Convert cents to USDC (6 decimals): e.g. 100 cents = 1.00 USDC = 1000000 units
  const usdcAmount = parseUnits((amountCents / 100).toString(), 6)

  // Encode the ERC-20 transfer(to, amount) call data
  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [toAddress as Address, usdcAmount],
  })

  // Get current nonce and gas price
  const [nonce, gasPrice] = await Promise.all([
    client.getTransactionCount({ address: fromAddress as Address }),
    client.getGasPrice(),
  ])

  // Build unsigned EIP-1559 transaction
  const tx: TransactionSerializable = {
    to: USDC_ADDRESS,
    data,
    nonce,
    gas: 80000n,
    maxFeePerGas: gasPrice * 2n,
    maxPriorityFeePerGas: gasPrice / 10n,
    chainId: 11155111,
    type: "eip1559",
  }

  // Serialize unsigned
  const unsignedHex = serializeTransaction(tx)

  // Sign via OWS Docker container
  console.log(
    `[x402] Signing USDC transfer via OWS: ${walletName} | ` +
    `${fromAddress.slice(0, 10)}... -> ${toAddress.slice(0, 10)}... | ` +
    `$${(amountCents / 100).toFixed(2)} USDC`
  )

  const MAX_RETRIES = 3

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const cmd = OWS_DIRECT
        ? `ows sign tx --wallet ${walletName} --chain 11155111 --tx "${unsignedHex}" --json`
        : `docker exec ${OWS_DOCKER} ows sign tx --wallet ${walletName} --chain 11155111 --tx "${unsignedHex}" --json`

      const output = execSync(cmd, { encoding: "utf-8", timeout: 15000 }).trim()

      // Parse OWS JSON response: { "signature": "HEX128", "recovery_id": 0|1 }
      const sigData: { signature: string; recovery_id: number } = JSON.parse(output)

      const sig = sigData.signature
      const r = `0x${sig.slice(0, 64)}` as `0x${string}`
      const s = `0x${sig.slice(64, 128)}` as `0x${string}`
      const yParity = sigData.recovery_id as 0 | 1

      // Combine signature with transaction
      const signedTx = serializeTransaction(tx, { r, s, yParity })

      // Broadcast
      const hash = await client.sendRawTransaction({ serializedTransaction: signedTx })

      console.log(
        `[x402] ON-CHAIN: ${fromAddress.slice(0, 10)}... -> ${toAddress.slice(0, 10)}... | ` +
        `$${(amountCents / 100).toFixed(2)} USDC | tx: ${hash}`
      )
      console.log(`[x402] https://sepolia.etherscan.io/tx/${hash}`)

      return hash
    } catch (e: any) {
      console.log(`[x402] Attempt ${attempt}/${MAX_RETRIES} failed for ${walletName}: ${e.message?.slice(0, 100)}`)
      if (attempt === MAX_RETRIES) {
        throw new Error(`[x402] OWS signing failed for ${walletName} after ${MAX_RETRIES} attempts: ${e.message?.slice(0, 200)}`)
      }
      // Wait before retry (1s, 2s)
      await new Promise(r => setTimeout(r, attempt * 1000))
    }
  }

  throw new Error(`[x402] Unreachable — all retries exhausted for ${walletName}`)
}

// ─── Simulated transfer (demo/dev fallback) ─────────────────────────────────

function settleSimulated(
  fromAddress: string,
  toAddress: string,
  amountCents: number
): TxHash {
  if (!(fromAddress in simulatedBalances)) simulatedBalances[fromAddress] = 1000
  if (!(toAddress in simulatedBalances)) simulatedBalances[toAddress] = 0

  simulatedBalances[fromAddress] -= amountCents
  simulatedBalances[toAddress] += amountCents

  const hash: TxHash = `0xtx_${String(txCounter++).padStart(4, "0")}_${Date.now()}`

  console.log(
    `[x402] SIM: ${fromAddress.slice(0, 10)}... -> ${toAddress.slice(0, 10)}... | $${(amountCents / 100).toFixed(2)} | ${hash}`
  )

  return hash
}

// ─── Balance helpers ────────────────────────────────────────────────────────

export function getSimulatedBalance(address: string): number {
  return simulatedBalances[address] ?? 0
}

export function initSimulatedBalances(
  addresses: string[],
  startingCents: number
): void {
  for (const addr of addresses) {
    simulatedBalances[addr] = startingCents
  }
}

// ─── Test runner (run with: bun run modules/agent/x402.ts) ──────────────────

if ((import.meta as any).main) {
  console.log("=== Testing x402 Payment Settlement ===\n")
  console.log(`Mode: ${isLiveMode() ? "LIVE (on-chain via OWS)" : "SIMULATED (demo)"}\n`)

  if (isLiveMode()) {
    // Live test: small USDC transfer between two wallets
    const llamaAddr = "0x51dA09aB2EF760314a489D35b8207657cF471284"
    const mistralAddr = "0x2F445DB3961E33d6500537Cd796b4812CBf7Db6b"

    console.log("Sending 10 cents ($0.10) USDC from Llama to Mistral...")
    const tx = await settleBet(llamaAddr, mistralAddr, 10)
    console.log(`  tx: ${tx}`)
  } else {
    const agentA = "0xAgent_A_address_placeholder"
    const agentB = "0xAgent_B_address_placeholder"
    const potAddr = "0xPot_address_placeholder"

    initSimulatedBalances([agentA, agentB, potAddr], 1000)

    const tx1 = await settleBet(agentA, potAddr, 100)
    console.log(`  tx1: ${tx1}`)

    const tx2 = await settleBet(agentB, potAddr, 100)
    console.log(`  tx2: ${tx2}`)

    const tx3 = await distributeWinnings(potAddr, agentA, 200)
    console.log(`  tx3 (payout): ${tx3}`)

    console.log("\n--- Final Balances ---")
    console.log(`Agent A: ${getSimulatedBalance(agentA)} cents`)
    console.log(`Agent B: ${getSimulatedBalance(agentB)} cents`)
    console.log(`Pot:     ${getSimulatedBalance(potAddr)} cents`)
  }
}
