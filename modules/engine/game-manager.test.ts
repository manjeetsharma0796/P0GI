import { createGameManager } from "./game-manager"
import { writeFileSync } from "fs"

const OUT = "C:/tmp/gm_result.txt"
const gm = createGameManager()
const log: string[] = []

gm.onEvent((e) => {
  if (e.type === "payout")    log.push(`PAYOUT: ${e.winnerName} | ${e.winnerHand} | pot:${e.potAmount}`)
  if (e.type === "game_over") log.push(`GAME OVER: ${e.winnerName}`)
})

let hands = 0
gm.onEvent((e) => {
  if (e.type === "deal" && e.message?.includes("Hand #")) {
    hands++
    if (hands > 3) gm.stopGame()
  }
})

await gm.startGame()
writeFileSync(OUT, log.join("\n"))
process.exit(0)
