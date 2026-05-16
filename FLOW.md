# Agent Poker Night — End-to-End Flow

> A comprehensive guide to how the system works, from user journey to on-chain settlement.

---

## Table of Contents

1. [User Journey](#user-journey)
2. [Technical Architecture](#technical-architecture)
3. [Agent Selection Flow](#agent-selection-flow)
4. [Game Flow (Texas Hold'em)](#game-flow)
5. [On-Chain Settlement Flow](#settlement-flow)
6. [Data Persistence](#data-persistence)
7. [System Components](#system-components)

---

## 1. User Journey <a id="user-journey"></a>

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER FLOW                                    │
│                                                                      │
│  [1] AGENTS PAGE (/agents)                                          │
│      │                                                               │
│      ├── Browse AI models:                                          │
│      │   FREE (NVIDIA NIM — no API key):                            │
│      │     • Llama 3.3 70B (Meta)                                   │
│      │     • Mistral Small 4 119B (Mistral AI)                      │
│      │     • Nemotron Super 49B (NVIDIA)                            │
│      │     • Llama 3.1 70B (Meta)                                   │
│      │                                                               │
│      │   PREMIUM (requires API key):                                │
│      │     • Claude Sonnet (Anthropic) — sk-ant-...                 │
│      │     • Gemini 2.5 Flash (Google) — AIza...                    │
│      │     • GPT-4o (OpenAI) — sk-...                               │
│      │                                                               │
│      ├── Select YOUR agent (1 of 4 seats)                           │
│      │   Other 3 seats auto-filled with remaining models            │
│      │                                                               │
│      ├── See OWS wallet address per agent                           │
│      │   Copy address button + USDC balance + ETH balance           │
│      │   Network: Ethereum Sepolia                                  │
│      │                                                               │
│      ├── Quick Chat Test (optional)                                 │
│      │   Send a test prompt to see response speed                   │
│      │                                                               │
│      └── Click "Choose Skills →"                                    │
│          Agent selection saved to localStorage                      │
│                                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─               │
│  TOP-RIGHT CORNER (persistent on all pages):                        │
│  ┌──────────────────────────────────────────────┐                   │
│  │ [Avatar] Llama (you) | 3.00 USDC | 0.018 ETH │                  │
│  │ 0x51dA...1284 [copy]                          │                  │
│  └──────────────────────────────────────────────┘                   │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─               │
│                                                                      │
│  [2] SKILLS PAGE (/skills)                                          │
│      │                                                               │
│      ├── 5 pre-built poker strategies:                              │
│      │   🦈 Tight Aggressive (TAG) — top 8% hands, bet hard        │
│      │   🔥 Loose Aggressive (LAG) — raise relentlessly             │
│      │   🪨 The Rock — top 5% only, never raises first              │
│      │   🧮 GTO Grinder — game theory optimal, balanced             │
│      │   🃏 The Maniac — raises every hand, pure chaos              │
│      │                                                               │
│      ├── Custom skill option (user writes own prompt)               │
│      │                                                               │
│      ├── Top-right shows: "Your Agent: Llama | $3.00 USDC"         │
│      │                                                               │
│      └── Click "Continue to Lobby →"                                │
│          Skill selection saved to localStorage                      │
│                                                                      │
│  [3] LOBBY PAGE (/lobby)                                            │
│      │                                                               │
│      ├── Browse open rooms (public/private)                         │
│      │   Each shows: name, host, player count, blinds, status       │
│      │                                                               │
│      ├── Create Room (name, blinds, public/private)                 │
│      │                                                               │
│      ├── Join (if vacant) or Spectate (if full/live)                │
│      │                                                               │
│      └── Quick Play → jumps straight to /game/1                     │
│                                                                      │
│  [4] GAME PAGE (/game/:id)                                         │
│      │                                                               │
│      ├── Three-column layout:                                       │
│      │   LEFT:   Action Log (timestamped, color-coded)              │
│      │   CENTER: Poker Table (dealer image, agent seats, cards)     │
│      │   RIGHT:  Live Chat (user messages only)                     │
│      │                                                               │
│      ├── Click "Start Game"                                         │
│      │   → Server creates OWS wallets                               │
│      │   → 4 agents sit at table                                    │
│      │   → Your agent shows "(you)" label                           │
│      │                                                               │
│      ├── Watch the game:                                            │
│      │   • Cards dealt (fly animation from dealer)                  │
│      │   • Each agent thinks (spinner) → acts (5s pause)            │
│      │   • Community cards revealed per street                      │
│      │   • Pot updates in real-time                                 │
│      │   • Chip animation on bets                                   │
│      │   • Speech bubbles for agent trash talk                      │
│      │   • Win probability board (live %)                           │
│      │                                                               │
│      ├── Hand ends:                                                 │
│      │   • Winner announced with hand name                          │
│      │   • All hole cards flip face-up (showdown animation)         │
│      │   • Winner: golden glow | Strong hand: green | Bluff: red    │
│      │   • P&L shown per agent (+$0.40, -$0.20)                    │
│      │   • x402 settlement → Sonner toast with Etherscan link       │
│      │   • "Deal Next Hand" button (game pauses until clicked)      │
│      │                                                               │
│      └── Game Over:                                                 │
│          • When any agent's budget exhausted                        │
│          • Final standings shown                                    │
│          • "Play Again" or "Lobby" buttons                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technical Architecture <a id="technical-architecture"></a>

```
┌──────────────────────────────────────────────────────────────────┐
│                        BROWSER (Next.js)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Agents  │→ │  Skills  │→ │  Lobby   │→ │  Game    │        │
│  │  Page    │  │  Page    │  │  Page    │  │  Page    │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│       │              │              │              │              │
│       └──────────────┴──────────────┴──────────────┘              │
│                          │                                        │
│                    Socket.io Client                               │
│                    (use-game.ts hook)                              │
│                          │                                        │
│                    localStorage:                                  │
│                    - selectedAgent                                │
│                    - selectedModel                                │
│                    - selectedSkill                                │
│                    - apiKeys (sessionStorage)                    │
└──────────────────────────┬───────────────────────────────────────┘
                           │ WebSocket
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                     GAME SERVER (Bun + Socket.io :3001)           │
│                                                                    │
│  ┌──────────────────┐    ┌──────────────────┐                    │
│  │  Game Manager    │───→│  Poker Engine    │                    │
│  │  (game-manager)  │    │  (custom, no lib)│                    │
│  │                  │    │                  │                    │
│  │  • Hand loop     │    │  • Deck/shuffle  │                    │
│  │  • Street flow   │    │  • Deal cards    │                    │
│  │  • Betting round │    │  • Track pot     │                    │
│  │  • Settlement    │    │  • Track stacks  │                    │
│  │  • Event emit    │    │  • Hand eval     │                    │
│  └────────┬─────────┘    └──────────────────┘                    │
│           │                                                       │
│  ┌────────▼─────────┐    ┌──────────────────┐                    │
│  │  NVIDIA Agent    │    │  OWS Wallets     │                    │
│  │  (nvidia.ts)     │    │  (ows.ts)        │                    │
│  │                  │    │                  │                    │
│  │  • 4 LLM models  │    │  • Encrypted     │                    │
│  │  • Skill prompts │    │    vault (~/.ows) │                    │
│  │  • JSON parsing  │    │  • Docker exec   │                    │
│  │  • 15s timeout   │    │  • Sign tx       │                    │
│  └────────┬─────────┘    └────────┬─────────┘                    │
│           │                       │                               │
│           ▼                       ▼                               │
│  ┌──────────────────────────────────────────┐                    │
│  │            x402 Settlement (x402.ts)      │                    │
│  │                                            │                    │
│  │  Live mode (X402_LIVE=true):              │                    │
│  │  1. Build unsigned USDC transfer tx       │                    │
│  │  2. docker exec ows sign tx --json        │                    │
│  │  3. Combine signature + broadcast         │                    │
│  │  4. Return real tx hash → Etherscan link  │                    │
│  │                                            │                    │
│  │  Simulated mode (fallback):               │                    │
│  │  1. Track balances in memory              │                    │
│  │  2. Return fake tx hash                   │                    │
│  └──────────────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    DOCKER: ows-agent-poker                         │
│                                                                    │
│  OWS CLI v1.2.4 (Linux binary)                                   │
│  Encrypted vault: ~/.ows/wallets/                                 │
│  AES-256-GCM encryption — keys never in plaintext                │
│                                                                    │
│  Wallets:                                                         │
│  ├── poker-llama    → 0x51dA09aB...1284 (Ethereum Sepolia)       │
│  ├── poker-mistral  → 0x2F445DB3...Db6b                          │
│  ├── poker-deepseek → 0x765A6824...328e (used by Nemotron)       │
│  ├── poker-qwen     → 0xcA10A991...db00                          │
│  └── poker-pot      → 0xaD2390a2...e8E8                          │
│                                                                    │
│  Signing flow:                                                    │
│  request → policy check → key decrypt → sign → key wipe          │
└──────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                  ETHEREUM SEPOLIA (Chain 11155111)                 │
│                                                                    │
│  USDC Contract: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238       │
│  RPC: https://ethereum-sepolia-rpc.publicnode.com                │
│  Explorer: https://sepolia.etherscan.io                          │
│                                                                    │
│  Real USDC transfers between agent wallets after each hand.      │
│  Every transaction verifiable on Etherscan.                      │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Agent Selection Flow <a id="agent-selection-flow"></a>

```
User opens /agents
    │
    ├── Sees 4+ AI models listed
    │   ├── FREE: Llama, Mistral, Nemotron, Llama-3.1 (NVIDIA NIM)
    │   └── PREMIUM: Claude, Gemini, GPT-4o (needs API key)
    │
    ├── Clicks on ONE model → becomes "your agent"
    │   ├── Green border + "(you)" badge
    │   ├── OWS wallet address shown + copy button
    │   ├── USDC + ETH balance fetched from Sepolia RPC
    │   └── Saved to localStorage: { model, name, seat, walletAddress }
    │
    ├── Other 3 seats auto-filled from remaining models
    │
    ├── If PREMIUM model selected:
    │   ├── API key input field appears
    │   ├── Key saved to sessionStorage (cleared on tab close)
    │   └── Key sent to server via configure_agents socket event
    │
    └── Top-right corner updates:
        [Avatar] Llama (you) | 3.00 USDC | 0.018 ETH | 0x51dA...
```

**localStorage schema:**
```json
{
  "agentPoker_selectedAgent": {
    "seatIndex": 0,
    "modelId": "meta/llama-3.3-70b-instruct",
    "modelName": "Llama 3.3",
    "agentName": "Llama",
    "skillId": "tag",
    "walletAddress": "0x51dA09aB2EF760314a489D35b8207657cF471284"
  }
}
```

---

## 4. Game Flow (Texas Hold'em) <a id="game-flow"></a>

```
USER CLICKS "START GAME"
    │
    ▼
SERVER: Create OWS wallets for all 4 agents
    │
    ▼
══════════════════════════════════════════════
  HAND #N
══════════════════════════════════════════════
    │
    ├── DEAL: 2 hole cards to each agent (face-down)
    │   UI: card fly animation from dealer to each seat
    │
    ├── PRE-FLOP BETTING ROUND
    │   ├── Each agent (left of big blind first):
    │   │   ├── "thinking..." spinner (1-2s LLM call)
    │   │   ├── Action: CALL $0.20 / RAISE $0.40 / FOLD
    │   │   ├── Speech bubble: "Let's get this pot!"
    │   │   ├── Chip animation flies to pot
    │   │   ├── Pot + stacks update in real-time
    │   │   └── 5 SECOND PAUSE (user digests the action)
    │   │
    │   ├── If someone RAISES → all others must respond again
    │   ├── Re-raises capped at 4 per round
    │   └── Round ends when: all active players matched bet
    │
    ├── FLOP: Reveal 3 community cards
    │   UI: 3 cards appear face-up in center (3s pause)
    │   ├── FLOP BETTING ROUND (same rules as pre-flop)
    │
    ├── TURN: Reveal 4th community card
    │   UI: 1 more card appears (3s pause)
    │   ├── TURN BETTING ROUND
    │
    ├── RIVER: Reveal 5th community card
    │   UI: 1 more card appears (3s pause)
    │   ├── RIVER BETTING ROUND
    │
    ├── SHOWDOWN
    │   ├── All hole cards flip face-up (3D flip animation)
    │   ├── Winner: golden sparkle glow
    │   ├── Strong hand (pair+): green glow
    │   ├── Bluff (weak + raised): red pulse
    │   ├── Best 5-card hand from 7 cards wins
    │   ├── pokersolver evaluates: Royal Flush → High Card
    │   └── "Qwen wins! — Full House — pot: $2.00"
    │
    ├── P&L DISPLAY
    │   ├── Per agent: Llama: +$0.60 | Mistral: -$0.20 | ...
    │   └── Reset each hand (not cumulative)
    │
    ├── x402 SETTLEMENT (real on-chain)
    │   ├── Sonner: "⏳ Signing & broadcasting..."
    │   ├── Each loser → winner USDC transfer:
    │   │   ├── Build unsigned tx (viem)
    │   │   ├── Sign via OWS Docker (docker exec ows sign tx)
    │   │   ├── Broadcast to Sepolia RPC
    │   │   └── Sonner: "✅ USDC Transfer Confirmed [Etherscan ↗]"
    │   └── Sonner: "✅ All Settlements Complete"
    │
    ├── "DEAL NEXT HAND" BUTTON
    │   Game PAUSES here until user clicks
    │
    └── GAME OVER (when any agent's budget = $0)
        ├── Final standings shown
        ├── "Play Again" or "Lobby" buttons
        └── All transaction hashes logged in data/transactions.log
```

---

## 5. On-Chain Settlement Flow <a id="settlement-flow"></a>

```
HAND ENDS → Winner determined
    │
    ▼
GAME MANAGER calculates: who owes what to winner
    │
    ▼
For each LOSER (non-folded, lost at showdown):
    │
    ├── 1. BUILD UNSIGNED TX
    │   ├── USDC.transfer(winner_address, amount)
    │   ├── EIP-1559 transaction
    │   ├── Chain: Ethereum Sepolia (11155111)
    │   ├── Gas: estimated from RPC
    │   └── Serialized as hex with viem
    │
    ├── 2. SIGN VIA OWS (Docker)
    │   ├── Command: docker exec ows-agent-poker ows sign tx \
    │   │     --wallet poker-{agent} --chain 11155111 --tx "0x..." --json
    │   ├── OWS vault decrypts key (AES-256-GCM)
    │   ├── Policy engine checks: chain allowlist, spend limits
    │   ├── Signs transaction
    │   ├── Key wiped from memory immediately
    │   └── Returns: { signature: "hex128", recovery_id: 0|1 }
    │
    ├── 3. BROADCAST
    │   ├── Combine signature with unsigned tx
    │   ├── sendRawTransaction to Sepolia RPC
    │   └── Returns: real transaction hash (0x...)
    │
    ├── 4. EMIT TO UI
    │   ├── settlement_complete event with txHash
    │   ├── Sonner toast: "✅ Llama → Qwen: $0.50 USDC [Etherscan ↗]"
    │   └── Transaction logged to data/transactions.log
    │
    └── 5. VERIFY
        └── https://sepolia.etherscan.io/tx/{hash}

Transaction Log Format (data/transactions.log):
[2026-04-04T02:44:12] [HAND #1] [INITIATED] [on-chain] Mistral(0x2F44...) → Llama(0x51dA...) $1.00 USDC
[2026-04-04T02:44:13] [HAND #1] [SUCCESS]   [on-chain] Mistral(0x2F44...) → Llama(0x51dA...) $1.00 USDC tx:0xc886dc7a...
```

---

## 6. Data Persistence <a id="data-persistence"></a>

| Data | Storage | Lifetime |
|------|---------|----------|
| Selected agent + model | localStorage | Permanent |
| Selected skill | localStorage | Permanent |
| Premium API keys | sessionStorage | Tab close |
| OWS wallet keys | Docker volume (~/.ows) | Permanent, encrypted |
| Game logs | data/game.log | Per game (cleared on start) |
| Transaction logs | data/transactions.log | Per game (cleared on start) |
| Wallet addresses | modules/agent/ows.ts | Hardcoded from OWS vault |

---

## 7. System Components <a id="system-components"></a>

| Component | Technology | Port/Path |
|-----------|-----------|-----------|
| Frontend | Next.js 16 + Tailwind | :3000 |
| Game Server | Bun + Socket.io | :3001 |
| OWS Vault | Docker (ows-agent-poker) | docker exec |
| AI Models | NVIDIA NIM API | integrate.api.nvidia.com |
| Blockchain | Ethereum Sepolia | Chain 11155111 |
| USDC | ERC-20 | 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 |
| Card Eval | pokersolver | In-process |
| Logging | Custom (logger.ts) | data/*.log |
| Toasts | Sonner | Bottom-right |

### NVIDIA Models (Free — no API key)

| Model ID | Name | Provider | Size |
|----------|------|----------|------|
| meta/llama-3.3-70b-instruct | Llama 3.3 | Meta | 70B |
| mistralai/mistral-small-4-119b-2603 | Mistral Small 4 | Mistral AI | 119B |
| nvidia/llama-3.3-nemotron-super-49b-v1 | Nemotron Super | NVIDIA | 49B |
| meta/llama-3.1-70b-instruct | Llama 3.1 | Meta | 70B |

### Premium Models (requires API key)

| Model ID | Name | Provider | Key format |
|----------|------|----------|------------|
| claude-sonnet-4-20250514 | Claude Sonnet | Anthropic | sk-ant-... |
| gemini-2.5-flash | Gemini 2.5 Flash | Google | AIza... |
| gpt-4o | GPT-4o | OpenAI | sk-... |

### OWS Wallets (Ethereum Sepolia)

| Agent | Wallet Name | Address | Vault Status |
|-------|------------|---------|-------------|
| 🦈 Llama | poker-llama | 0x51dA09aB2EF760314a489D35b8207657cF471284 | ✓ encrypted |
| 🃏 Mistral | poker-mistral | 0x2F445DB3961E33d6500537Cd796b4812CBf7Db6b | ✓ encrypted |
| 🧮 Nemotron | poker-deepseek | 0x765A6824A400f714a59d99FbF4A04C252A5E328e | ✓ encrypted |
| 🔥 Qwen | poker-qwen | 0xcA10A9910b62979eDA09A92CB78720fF67ffdb00 | ✓ encrypted |
| 🏦 Pot | poker-pot | 0xaD2390a2C25cAF161A61d7cCD0Cd197F1130e8E8 | ✓ encrypted |
