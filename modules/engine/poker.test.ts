// Quick test — run with: bun run modules/engine/poker.test.ts

import { createPokerEngine, AGENT_NAMES } from "./poker"

const engine = createPokerEngine()

console.log("\n=== HAND 1 START ===")
engine.newHand()

let state = engine.getState()
console.log("Community cards:", state.communityCards)
state.players.forEach(p => {
  console.log(`${p.name}: stack=${p.stack} cards=${p.holeCards} folded=${p.folded}`)
})

// Simulate one full hand — everyone calls until showdown
for (let round = 0; round < 4; round++) {
  console.log(`\n--- Round ${round} ---`)

  // Each player acts
  for (let i = 0; i < AGENT_NAMES.length; i++) {
    state = engine.getState()
    const player = state.players[i]
    if (player.folded || !player.active) continue
    if (player.availableActions.length === 0) continue

    const action = player.availableActions.includes("CHECK") ? "call" : "call"
    console.log(`${player.name} → ${action} (stack: ${player.stack})`)
    engine.applyAction(i, action)
  }

  if (engine.canEndRound()) {
    engine.endRound()
    state = engine.getState()
    console.log("Community:", state.communityCards, "| Pot:", state.pot)
  }

  if (engine.isHandOver()) break
}

const winner = engine.getWinner()
console.log(`\n🏆 Winner: ${winner?.name} with ${winner?.handName}`)
