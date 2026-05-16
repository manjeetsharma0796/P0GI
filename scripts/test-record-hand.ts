#!/usr/bin/env bun
import { recordHand } from "../modules/chain/initia"
import { AGENT_WALLETS } from "../modules/shared/chain"

const tx = await recordHand({
  handId: 1,
  tableId: 1,
  winners: [AGENT_WALLETS.Llama.address],
  payouts: [100_000_000], // 100 CHIP
  losers: [AGENT_WALLETS.Qwen.address],
  pot: 100_000_000,
})

console.log("record_hand tx:", tx.txhash, "code:", tx.code)
console.log("→ explore: http://localhost:8080/tx/" + tx.txhash)
