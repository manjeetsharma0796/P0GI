# AI Poker Night — Project Context & Feature Checklist

> OWS Hackathon | April 3, 2026 | Deadline: midnight EST
> Track: Creative/Unhinged | Target: Grand Prize ($10,000)

---

## Concept

6 AI agents (different LLM models via NVIDIA free API) each hold an OWS wallet funded with real USDC. They play Texas Hold'em poker. Bets settle via x402 micropayments. Spectators watch live and bet on outcomes. OWS policy engine enforces spending limits per agent.

**Two user types:**
- **Agent Builders** — create an agent, set a strategy/skill, fund its wallet, enter it into tournaments
- **Spectators** — watch live games, bet on which agent wins via x402

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js + Tailwind + ui-ux-pro-max skill |
| Backend | Node.js / Express |
| LLM API | NVIDIA free API (OpenAI-compatible, 100+ models) |
| Wallet | OWS SDK (npm) |
| Payments | x402 micropayments |
| Messaging | XMTP React SDK (agent trash talk + spectator chat) |
| Portfolio view | Zerion API (live wallet balances) |
| Onchain data | Allium Real-Time Streaming (live tx feed) |
| On-ramp | MoonPay CLI (mp) |
| Prediction market | Myriad JS SDK (spectator betting odds) |
| Realtime UI | WebSocket (Socket.io) |

---

## NVIDIA API Setup

```js
import OpenAI from "openai"

const nvidia = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY
})

const AGENTS = [
  { name: "Llama",    model: "meta/llama-3.3-70b-instruct",          personality: "calculated, patient" },
  { name: "Mistral",  model: "mistralai/mistral-large-2-instruct",   personality: "aggressive, bluffs often" },
  { name: "DeepSeek", model: "deepseek-ai/deepseek-r1",              personality: "slow thinker, rarely folds" },
  { name: "Qwen",     model: "qwen/qwen2.5-72b-instruct",            personality: "conservative, tight" },
  { name: "Gemma",    model: "google/gemma-3-27b-it",                personality: "chaotic, unpredictable" },
  { name: "Phi",      model: "microsoft/phi-4",                      personality: "mathematical, pot-odds focused" },
]
```

---

## Complete Screen Flow

```
[Screen 0] Wallet Create / Connect
        │
        ↓ OWS wallet created → address stored
        │
[Screen 1] Agent List + Balance
        │  - Shows: free agent balance | your wallet balance
        │  - DEPOSIT button → MoonPay on-ramp → x402 to OWS wallet
        │
        ↓ wallet funded
        │
[Screen 2] Skill / Strategy List
        │  - Pre-built strategies: Aggressive | Passive | Bluffer | Mathematician
        │  - OR: enter custom system prompt
        │
        ↓ strategy selected
        │
[Screen 2.5] Agent Policy Setup  ← OWS core feature
        │  - Max bet per hand: $X
        │  - Stop-loss limit: $X
        │  - Session budget: $X
        │  - Allowed chains
        │  - Generate OWS API Key for this agent
        │
        ↓ policy saved → OWS API key issued
        │
[Screen 3] Lobby — Active Game Sessions
        │  - Grid of live tables (players, pot size, status)
        │  - Pay entry fee → x402 from agent wallet to pot wallet
        │
        ↓ entry fee paid
        │
[Screen 4] Game Session (Live)
        │  ┌─ Left panel: Live game feed
        │  │   - Community cards, current hand #, pot size
        │  │   - Each agent's last action (raised/called/folded)
        │  │   - Agent thinking indicator
        │  │   - XMTP chat (agent messages + spectator chat)
        │  │
        │  ├─ Center: Agent seats (A, B, C, D circles)
        │  │   - Live stack size per agent
        │  │   - Active/folded status
        │  │
        │  ├─ Right panel: Pie chart (live betting odds)
        │  │   - Slice grows as more bets placed on agent
        │  │   - BET ON A / B / C / D buttons
        │  │   → Confirmation modal → x402 payment
        │  │
        │  └─ Bottom: Your wallet balance (depletes in real time)
        │
        ↓ game ends (one agent has all chips or time limit)
        │
[Screen 5] Results + Payout
        │  - Winner announced
        │  - x402 pot → winner's OWS wallet (tx hash shown)
        │  - Spectator payouts via x402
        │  - OWS audit log download
        │
        ↓
[Screen 6] Leaderboard
           - All-time agent rankings
           - Win rate, earnings, model name
           - Powered by OWS audit log as source of truth
```

---

## OWS + x402 Integration Map

| Screen | OWS Usage | x402 Usage |
|--------|-----------|------------|
| 0. Wallet Create | `ows.createWallet()` | — |
| 1. Agent List | Read balance from OWS | Deposit via x402 |
| 2.5. Policy Setup | `ows.setPolicy()`, `ows.generateApiKey()` | — |
| 3. Lobby | OWS key scoped to session budget | Entry fee via x402 |
| 4. Game Session | Policy blocks over-limit bets | Bet per hand via x402 |
| 4. Spectator Bet | — | BET ON X via x402 |
| 5. Results | OWS audit log proof | Payout via x402 |

---

## Feature Checklist

### Phase 0 — Project Setup
- [ ] Init Next.js project
- [ ] Install OWS SDK (`npm install @open-wallet-standard/core`)
- [ ] Install x402 SDK
- [ ] Setup NVIDIA API key in `.env`
- [ ] Install XMTP SDK
- [ ] Install Zerion SDK / Allium SDK
- [ ] Setup Socket.io for realtime
- [ ] Setup Myriad SDK for prediction markets

### Phase 1 — OWS Wallet Foundation
- [ ] Screen 0: Create OWS wallet (new user)
- [ ] Screen 0: Connect existing OWS wallet
- [ ] Store wallet address in session
- [ ] Read wallet balance via OWS SDK
- [ ] Screen 2.5: Policy setup form (max bet, stop-loss, session budget)
- [ ] `ows.setPolicy()` call on form submit
- [ ] Generate OWS API key for agent
- [ ] Display API key with copy button

### Phase 2 — Wallet Funding (x402)
- [ ] Screen 1: Show free agent balance + your wallet balance
- [ ] DEPOSIT button → MoonPay on-ramp flow
- [ ] x402 payment: user wallet → agent OWS wallet
- [ ] Balance updates in real time after deposit
- [ ] Entry fee payment: agent wallet → pot wallet via x402

### Phase 3 — Agent & Skill System
- [ ] Screen 1: Agent list with balance and status
- [ ] Screen 2: Pre-built strategy cards (Aggressive, Passive, Bluffer, Math)
- [ ] Screen 2: Custom system prompt input
- [ ] Save agent config (name, model, strategy, wallet address)
- [ ] Map strategy → NVIDIA model selection

### Phase 4 — Poker Engine (Backend)
- [ ] Texas Hold'em game state manager
- [ ] Card dealing logic (server-side, hidden from agents)
- [ ] Hand evaluation (determine winner at showdown)
- [ ] Betting round manager (pre-flop, flop, turn, river)
- [ ] Turn rotation logic
- [ ] Pot management
- [ ] All-in handling
- [ ] Bust detection (agent wallet = 0)

### Phase 5 — AI Agent Decision System
- [ ] `getAgentAction(agent, gameState)` function
- [ ] Build game state prompt (cards, pot, stack, to-call, other actions)
- [ ] Call NVIDIA API per agent turn
- [ ] Parse JSON response `{ action, amount, message }`
- [ ] Validate action against OWS policy (within bet limits?)
- [ ] Fallback if LLM returns invalid JSON (default to fold)
- [ ] x402 payment per valid bet/call action

### Phase 6 — Lobby (Screen 3)
- [ ] List active game sessions (table name, players, pot, status)
- [ ] Create new game session button
- [ ] Join existing game (pay entry fee via x402)
- [ ] Session status: waiting / live / finished
- [ ] Max players per table config

### Phase 7 — Live Game UI (Screen 4)
- [ ] Agent seats layout (A, B, C, D circles with stack sizes)
- [ ] Community cards display (flip animation)
- [ ] Pot size counter
- [ ] Current hand number
- [ ] Live action feed (Agent X raised $0.20, Agent Y folded...)
- [ ] "Thinking..." indicator when agent is querying LLM
- [ ] WebSocket push for every game event
- [ ] Your wallet balance live counter (depletes as you bet)

### Phase 8 — Spectator Betting (Screen 4 right panel)
- [ ] Pie chart showing live bet distribution per agent
- [ ] BET ON A / B / C / D buttons
- [ ] Bet confirmation modal (amount, odds, potential payout, wallet address)
- [ ] x402 payment on confirm
- [ ] Myriad prediction market integration for odds calculation
- [ ] Odds update in real time as bets come in
- [ ] Show spectator's active bets

### Phase 9 — XMTP Chat
- [ ] Initialize XMTP client per agent (wallet address as identity)
- [ ] Agents send trash talk messages after each action
- [ ] Spectator chat (human messages alongside agent messages)
- [ ] Display in live game feed panel
- [ ] XMTP Content Types: reactions on agent messages

### Phase 10 — Results & Payout (Screen 5)
- [ ] Game over detection
- [ ] Winner announcement screen
- [ ] x402 pot distribution → winner OWS wallet
- [ ] Spectator payout calculation (bet × odds)
- [ ] x402 payout → each winning spectator wallet
- [ ] Show all tx hashes with block explorer links
- [ ] OWS audit log download (JSON)
- [ ] "Play Again" → back to lobby

### Phase 11 — Leaderboard (Screen 6)
- [ ] Read OWS audit logs for all completed games
- [ ] Calculate: wins, losses, total earnings per agent
- [ ] Rank by earnings
- [ ] Show model name, personality, win rate
- [ ] All-time vs. today filter

### Phase 12 — Polish & Demo Prep
- [ ] Zerion API: live multi-chain balance display per agent
- [ ] Allium Real-Time Streaming: onchain tx feed in results screen
- [ ] Mobile responsive layout
- [ ] Loading states on all async operations
- [ ] Error handling: LLM timeout → auto-fold
- [ ] Error handling: x402 failure → retry once → skip turn
- [ ] Demo script: walk through one full game live
- [ ] Seed data: 3 completed games for leaderboard
- [ ] Environment variables documented in `.env.example`

---

## Priority Order for Hackathon (time-boxed)

```
Must ship (core demo):
  Phase 0 → Phase 4 → Phase 5 → Phase 7 → Phase 10

Should ship (judging criteria):
  Phase 1 → Phase 2 → Phase 8

Nice to have (bonus points):
  Phase 9 → Phase 6 → Phase 11 → Phase 3 → Phase 12
```

---

## File Structure (planned)

```
poker-night-ai/
├── app/                    # Next.js app router
│   ├── page.tsx            # Screen 0: wallet connect
│   ├── agents/page.tsx     # Screen 1: agent list
│   ├── skills/page.tsx     # Screen 2: skill list
│   ├── policy/page.tsx     # Screen 2.5: policy setup
│   ├── lobby/page.tsx      # Screen 3: game lobby
│   ├── game/[id]/page.tsx  # Screen 4: live game
│   ├── results/[id]/page.tsx # Screen 5: results
│   └── leaderboard/page.tsx  # Screen 6: leaderboard
├── lib/
│   ├── ows.ts              # OWS wallet helpers
│   ├── x402.ts             # x402 payment helpers
│   ├── nvidia.ts           # NVIDIA API + agent decision
│   ├── poker.ts            # Poker engine (game state, hand eval)
│   ├── xmtp.ts             # XMTP messaging
│   └── zerion.ts           # Zerion API helpers
├── server/
│   ├── index.ts            # Express + Socket.io server
│   └── game-manager.ts     # Game session orchestrator
├── .env.example
└── PROJECT.md              # this file
```

---

## Environment Variables Needed

```env
NVIDIA_API_KEY=
OWS_NETWORK=base          # or polygon, solana, etc.
X402_FACILITATOR_URL=
XMTP_ENV=production
ZERION_API_KEY=
ALLIUM_API_KEY=
MYRIAD_API_KEY=
MOONPAY_API_KEY=
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```
