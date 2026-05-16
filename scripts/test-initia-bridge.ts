#!/usr/bin/env bun
/**
 * Smoke test for modules/chain/initia.ts
 * Run inside the dev container:
 *   bun scripts/test-initia-bridge.ts
 *
 * Exercises:
 *   1. queryBalance for all 4 agent wallets
 *   2. One real settleHandOnChain round — Llama wins from Qwen
 *   3. queryBalance again to confirm deltas
 *   4. Prints tx hashes
 */
import {
  queryBalance,
  settleHandOnChain,
  ensureAllAgentKeysPresent,
  ensureGasStationKey,
  explainSettlement,
} from "../modules/chain/initia"
import { AGENT_WALLETS, toChip } from "../modules/shared/chain"

async function main() {
  console.log("=== preflight: keyring ===")
  await ensureGasStationKey()
  await ensureAllAgentKeysPresent()
  console.log("  all keys present ✓")

  console.log("\n=== balances BEFORE ===")
  const before: Record<string, number> = {}
  for (const [name, info] of Object.entries(AGENT_WALLETS)) {
    const uchip = await queryBalance(info.address)
    before[name] = uchip
    console.log(`  ${name.padEnd(9)} ${info.address}  ${toChip(uchip).toFixed(2)} CHIP`)
  }

  console.log("\n=== settling a mock hand ===")
  // Llama wins 100 CHIP from Qwen.
  const settlement = {
    handId: 1,
    tableId: 1,
    winners: [{ address: AGENT_WALLETS.Llama.address, uchipGain: 100_000_000 }],
    losers: [{ address: AGENT_WALLETS.Qwen.address, uchipLost: 100_000_000 }],
    pot: 100_000_000,
  }
  const txs = await settleHandOnChain(settlement)
  console.log(explainSettlement(settlement, txs))

  // give it 3 seconds to land
  await new Promise(r => setTimeout(r, 3000))

  console.log("\n=== balances AFTER ===")
  for (const [name, info] of Object.entries(AGENT_WALLETS)) {
    const uchip = await queryBalance(info.address)
    const delta = uchip - before[name]
    const sign = delta >= 0 ? "+" : ""
    console.log(
      `  ${name.padEnd(9)} ${toChip(uchip).toFixed(2)} CHIP  (${sign}${toChip(delta).toFixed(2)})`,
    )
  }
  console.log("\n✓ bridge is wired to the rollup.")
}

main().catch(err => {
  console.error("\n✗ bridge test failed:")
  console.error(err)
  process.exit(1)
})
