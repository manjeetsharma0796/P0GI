# AI Poker Night — Build Checklist

> Goal: Get AI agents playing poker with real OWS wallets + x402 bet settlement.
> Everything else is later.

---

## PHASE 1 — Project Setup

- [ ] `npx create-next-app@latest poker-night-ai --typescript --tailwind --app`
- [ ] `npm install @chevtek/poker-engine pokersolver`
- [ ] `npm install openai` (NVIDIA API is OpenAI-compatible)
- [ ] `npm install socket.io socket.io-client`
- [ ] `npm install @open-wallet-standard/core` (OWS)
- [ ] Create `.env.local` with `NVIDIA_API_KEY`
- [ ] Verify NVIDIA API works — make one test call, get a response

---

## PHASE 2 — Agent Decisions (NVIDIA)

- [ ] Create `lib/nvidia.ts` — initialize OpenAI client pointing to NVIDIA base URL
- [ ] Define 4 agents array (name, model, personality)
- [ ] Write `getAgentAction(agentName, gameState)` function
  - Builds prompt: hole cards, community cards, pot, stack, call amount, other actions
  - Calls NVIDIA API with that agent's model
  - Parses JSON response `{ action, amount, message }`
- [ ] Add fallback: if response is not valid JSON → default to `fold`
- [ ] Test: call `getAgentAction` manually, log the decision

---

## PHASE 3 — Poker Engine

- [ ] Create `lib/poker.ts`
- [ ] Initialize `Table` from `@chevtek/poker-engine` with 4 agent seats
- [ ] Sit 4 agents down with starting stacks
- [ ] `table.dealCards()` starts a hand
- [ ] Read `table.currentActor` to know whose turn it is
- [ ] Read `table.currentActorSeat.legalActions()` to get valid moves
- [ ] Apply agent decision back to table: `callAction()` / `raiseAction(n)` / `foldAction()`
- [ ] Listen to `showdown` event → use `pokersolver` to find winner
- [ ] Loop: after showdown, deal next hand
- [ ] Test: run a full hand in Node with `console.log`, no UI yet

---

## PHASE 4 — OWS Wallets

- [ ] Create `lib/ows.ts`
- [ ] Create one OWS wallet per agent at game start
- [ ] Fund each wallet with starting USDC amount
- [ ] Read wallet balance before each bet to confirm funds exist
- [ ] Store wallet addresses mapped to agent names
- [ ] Test: create 4 wallets, log addresses and balances

---

## PHASE 5 — x402 Bet Settlement

- [ ] Create `lib/x402.ts`
- [ ] On every `callAction` or `raiseAction`: trigger x402 payment from agent wallet → pot wallet
- [ ] On `showdown` winner: trigger x402 payment from pot wallet → winner wallet
- [ ] After each payment: read updated wallet balance via OWS
- [ ] Test: one full hand where bets settle on-chain, log tx hashes

---

## PHASE 6 — Game Loop (Backend)

- [ ] Create `server/game-manager.ts`
- [ ] `startGame()`: create wallets → deal first hand
- [ ] `playTurn()`: get current agent → call NVIDIA → apply decision → settle x402
- [ ] `nextHand()`: deal again after showdown
- [ ] `endGame()`: triggered when one agent has all chips
- [ ] Run full game loop end-to-end in terminal — no UI, just logs
- [ ] Test: 3 full hands play out, wallets change correctly

---

## PHASE 7 — Minimal UI

- [ ] Single page `/game` — shows the game in real time
- [ ] Socket.io: server emits game events, client listens
- [ ] Display: 4 agent cards (name, stack, last action)
- [ ] Display: community cards
- [ ] Display: pot size
- [ ] Display: current hand number
- [ ] Display: live action log (scrolling feed of what each agent did)
- [ ] Display: each agent's wallet balance (from OWS)
- [ ] "Start Game" button triggers `startGame()`
- [ ] Test: watch one full game play out in the browser

---

## DONE = MVP ✅
> Agents are playing poker. Bets settle via x402. OWS wallets track balances. Game runs in browser.

---

## LATER (do not build now)

- Spectator betting (Myriad prediction markets)
- XMTP agent trash talk chat
- Zerion portfolio view
- Allium real-time tx streaming
- MoonPay on-ramp / deposit flow
- Lobby / multiple tables
- Leaderboard
- Agent skill / strategy selection UI
- OWS policy setup screen
- Wallet connect screen
- Results + audit log download
- Mobile responsive
