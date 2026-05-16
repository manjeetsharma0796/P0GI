import { getOrCreateWallet, resetAllWallets } from "../modules/agent/wallet-persistence"
import { AGENTS } from "../modules/agent/nvidia"
import { POKER_SKILLS } from "../modules/agent/skills"

resetAllWallets()

console.log("=== 4 Agent Wallets — Base Sepolia ===")
console.log("Fund each with test USDC + tiny ETH for gas.\n")

for (const agent of AGENTS) {
  const w = getOrCreateWallet(agent.name, agent.skillId, agent.model)
  const skill = POKER_SKILLS.find((s) => s.id === agent.skillId)
  console.log(`${skill?.emoji} ${agent.name}`)
  console.log(`  Address: ${w.address}`)
  console.log(`  Skill:   ${skill?.name}`)
  console.log(`  Model:   ${agent.model}`)
  console.log()
}
