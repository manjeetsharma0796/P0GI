// Fund 3 agent wallets from Llama's wallet using viem
// Run: bun run scripts/fund-wallets.ts

import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "viem"
import { sepolia } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import { getAllWallets } from "../modules/agent/wallet-persistence"

const RPC = "https://ethereum-sepolia-rpc.publicnode.com"

const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC) })

// Load Llama's wallet (funded with 0.05 ETH)
const wallets = getAllWallets()
const llama = wallets.find((w) => w.agentName === "Llama")
if (!llama) { console.log("Llama wallet not found"); process.exit(1) }

const account = privateKeyToAccount(llama.privateKey as `0x${string}`)
const walletClient = createWalletClient({ account, chain: sepolia, transport: http(RPC) })

// Check Llama's balance first
const balance = await publicClient.getBalance({ address: account.address })
console.log(`Llama balance: ${formatEther(balance)} ETH\n`)

// Send 0.01 ETH to each of the other 3 wallets
const recipients = wallets.filter((w) => w.agentName !== "Llama" && w.agentName !== "Llama")
const AMOUNT = parseEther("0.01")

for (const r of recipients) {
  if (r.agentName === "Llama") continue  // skip self
  console.log(`Sending 0.01 ETH to ${r.agentName} (${r.address})...`)
  try {
    const hash = await walletClient.sendTransaction({
      to: r.address as `0x${string}`,
      value: AMOUNT,
    })
    console.log(`  ✅ tx: ${hash}`)
    console.log(`  🔗 https://sepolia.etherscan.io/tx/${hash}\n`)
  } catch (e: any) {
    console.log(`  ❌ Error: ${e.message?.slice(0, 80)}\n`)
  }
}

// Final balances
console.log("--- Final balances ---")
for (const w of wallets) {
  const bal = await publicClient.getBalance({ address: w.address as `0x${string}` })
  console.log(`${w.agentName.padEnd(10)}: ${formatEther(bal)} ETH`)
}
