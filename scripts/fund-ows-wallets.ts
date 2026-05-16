// Fund 5 USDC from Llama's OWS wallet to each agent + distribute ETH for gas
// Signs via OWS encrypted vault, broadcasts via RPC
// Run: bun run scripts/fund-ows-wallets.ts

import {
  createPublicClient, http, parseUnits, parseEther, formatEther, formatUnits,
  encodeFunctionData, serializeTransaction, hexToSignature, type Address,
  type TransactionSerializable,
} from "viem"
import { sepolia } from "viem/chains"
import { execSync } from "child_process"

const RPC = "https://ethereum-sepolia-rpc.publicnode.com"
const client = createPublicClient({ chain: sepolia, transport: http(RPC) })

const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address
const LLAMA = "0x51dA09aB2EF760314a489D35b8207657cF471284" as Address
const OWS_DOCKER = "ows-agent-poker"
const WALLET = "poker-llama"

const RECIPIENTS = [
  { name: "Mistral",  addr: "0x2F445DB3961E33d6500537Cd796b4812CBf7Db6b" as Address },
  { name: "DeepSeek", addr: "0x765A6824A400f714a59d99FbF4A04C252A5E328e" as Address },
  { name: "Qwen",     addr: "0xcA10A9910b62979eDA09A92CB78720fF67ffdb00" as Address },
  { name: "Pot",      addr: "0xaD2390a2C25cAF161A61d7cCD0Cd197F1130e8E8" as Address },
]

function owsSign(txHex: string): { r: `0x${string}`; s: `0x${string}`; v: bigint } {
  const cmd = `docker exec ${OWS_DOCKER} ows sign tx --wallet ${WALLET} --chain 11155111 --tx "${txHex}" --json`
  const output = execSync(cmd, { encoding: "utf-8", timeout: 15000 }).trim()
  const json = JSON.parse(output)
  const sig = json.signature as string
  const r = `0x${sig.slice(0, 64)}` as `0x${string}`
  const s = `0x${sig.slice(64, 128)}` as `0x${string}`
  const v = BigInt(json.recovery_id)
  return { r, s, v }
}

async function sendSignedTx(tx: TransactionSerializable, sig: { r: `0x${string}`; s: `0x${string}`; v: bigint }): Promise<string> {
  const signed = serializeTransaction(tx, { r: sig.r, s: sig.s, yParity: Number(sig.v) as 0 | 1 })
  const hash = await client.sendRawTransaction({ serializedTransaction: signed })
  return hash
}

async function main() {
  console.log("=== Fund OWS Agent Wallets (Ethereum Sepolia) ===\n")

  // Check Llama balances
  const llamaEth = await client.getBalance({ address: LLAMA })
  const llamaUsdc = await client.readContract({
    address: USDC,
    abi: [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ name: "", type: "uint256" }] }],
    functionName: "balanceOf",
    args: [LLAMA],
  })
  console.log(`Llama: ${formatEther(llamaEth)} ETH | ${formatUnits(llamaUsdc, 6)} USDC\n`)

  let nonce = await client.getTransactionCount({ address: LLAMA })

  // ── Send 5 USDC to each recipient ─────────────────────────────────────────

  console.log("--- Sending 4 USDC to each agent ---\n")

  for (const r of RECIPIENTS) {
    const data = encodeFunctionData({
      abi: [{ name: "transfer", type: "function", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }],
      functionName: "transfer",
      args: [r.addr, parseUnits("4", 6)],
    })

    const gasPrice = await client.getGasPrice()
    const tx: TransactionSerializable = {
      to: USDC,
      data,
      nonce,
      gas: 80000n,
      maxFeePerGas: gasPrice * 2n,
      maxPriorityFeePerGas: gasPrice / 10n,
      chainId: 11155111,
      type: "eip1559",
    }

    const unsigned = serializeTransaction(tx)
    console.log(`Signing USDC transfer to ${r.name} via OWS vault...`)

    try {
      const sig = owsSign(unsigned)
      const hash = await sendSignedTx(tx, sig)
      console.log(`  ✅ ${r.name}: 4 USDC sent | tx: ${hash}`)
      console.log(`  🔗 https://sepolia.etherscan.io/tx/${hash}\n`)
      nonce++
      // Small delay between txs
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (e: any) {
      console.log(`  ❌ ${r.name}: ${e.message?.slice(0, 100)}\n`)
    }
  }

  // ── Send 0.008 ETH to each recipient for gas ──────────────────────────────

  console.log("--- Sending 0.008 ETH (gas) to each agent ---\n")

  for (const r of RECIPIENTS) {
    const gasPrice = await client.getGasPrice()
    const tx: TransactionSerializable = {
      to: r.addr,
      value: parseEther("0.008"),
      nonce,
      gas: 21000n,
      maxFeePerGas: gasPrice * 2n,
      maxPriorityFeePerGas: gasPrice / 10n,
      chainId: 11155111,
      type: "eip1559",
    }

    const unsigned = serializeTransaction(tx)
    console.log(`Signing ETH transfer to ${r.name} via OWS vault...`)

    try {
      const sig = owsSign(unsigned)
      const hash = await sendSignedTx(tx, sig)
      console.log(`  ✅ ${r.name}: 0.008 ETH sent | tx: ${hash}`)
      console.log(`  🔗 https://sepolia.etherscan.io/tx/${hash}\n`)
      nonce++
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (e: any) {
      console.log(`  ❌ ${r.name}: ${e.message?.slice(0, 100)}\n`)
    }
  }

  // ── Final balances ─────────────────────────────────────────────────────────

  console.log("\n=== Final Balances ===\n")
  const ABI = [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ name: "", type: "uint256" }] }] as const

  for (const r of [{ name: "Llama", addr: LLAMA }, ...RECIPIENTS]) {
    const eth = await client.getBalance({ address: r.addr })
    const usdc = await client.readContract({ address: USDC, abi: ABI, functionName: "balanceOf", args: [r.addr] })
    console.log(`${r.name.padEnd(10)}: ${formatEther(eth).padStart(10)} ETH | ${formatUnits(usdc, 6).padStart(8)} USDC`)
  }
}

main().catch(console.error)
