# AgentBet — AI Poker on 0G Network

**Four AI agents play Texas Hold'em with every chip moving on-chain as native A0GI on the 0G Galileo Testnet. Built for the 0G APAC Hackathon.**

[![0G Network](https://img.shields.io/badge/Chain-0G%20Galileo%20Testnet-00D4AA)](https://0g.ai)
[![0G Compute](https://img.shields.io/badge/AI-0G%20Compute-7C3AED)](https://0g.ai)
[![Solidity](https://img.shields.io/badge/Contracts-Solidity%200.8.19-1F2937)](https://soliditylang.org)

---

## What Is This?

Four AI agents — each powered by a different LLM via **0G Compute** — sit at a poker table and play Texas Hold'em. Every decision is made by a real language model. Every hand is **settled on-chain** with native A0GI transfers and an `AgentBetGame` smart contract on the 0G Galileo Testnet.

You pick one agent as your character, choose a poker strategy, set a buy-in, and watch your AI play three opponents — with real on-chain settlement for every hand.

```
User picks Mistral as their agent
  → Mistral uses Aggressive strategy
  → Mistral's wallet: 0x8e46aB328B2b2E35C4dC84432dfa86e273f22612
  → Buy-in: 0.50 A0GI
  → Plays vs Llama, Nemotron, Qwen
  → Mistral wins → A0GI transfers on-chain + HandSettled event emitted
  → Tx on 0G: https://chainscan-galileo.0g.ai/tx/0x...
```

---

## 0G Products Used

| # | 0G Product | How We Use It |
|---|-----------|---------------|
| 1 | **0G Compute** | AI inference for all 4 poker agents (90+ models available dynamically) |
| 2 | **0G Chain** | On-chain settlement — native A0GI transfers + AgentBetGame.sol contract |
| 3 | **0G Storage** | Immutable game history archival (hand logs + results) |
| 4 | **0G DA** | Data availability layer for game state integrity |
| 5 | **0G Sealed Inference** | TEE-verified inference module for provably fair AI decisions |

---

## Architecture

```
                    ┌──────────────────────────────────────────┐
                    │           Next.js 16 Frontend            │
                    │  Agent Select → Skills → Lobby → Game    │
                    │     Real-time via Socket.io              │
                    └───────────────┬──────────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────────┐
                    │         Bun Game Server (:3001)           │
                    │  Poker Engine → AI Decisions → Settlement │
                    └──┬─────────────┬──────────────┬──────────┘
                       │             │              │
              ┌────────▼──────┐  ┌──▼────────┐  ┌──▼──────────────┐
              │  0G Compute   │  │ 0G Chain  │  │  0G Storage     │
              │  (NVIDIA NIM) │  │ Galileo   │  │  Game History   │
              │  90+ models   │  │ Testnet   │  │  + KV Store     │
              │  dynamic list │  │ A0GI txs  │  │  Leaderboard    │
              └───────────────┘  └───────────┘  └─────────────────┘
```

---

## AI Agents

| Agent | Default Model | Personality | Wallet |
|-------|--------------|-------------|--------|
| Llama | Llama 3.3 70B Instruct | Calculated, patient | `0x204f...fd38` |
| Mistral | Mistral Small 4 119B | Aggressive bluffer | `0x8e46...2612` |
| Nemotron | Nemotron Super 49B | Mathematical, precise | `0x4f40...12A1` |
| Qwen | Llama 3.1 70B Instruct | Solid, methodical | `0x4BCc...4fAb` |

Models are fetched dynamically from the 0G Compute network — 90+ chat models available in the dropdown. Each agent can use a different model and strategy (TAG, LAG, Rock, GTO, Maniac).

---

## On-Chain Settlement

```
Hand ends → settleBet()     → Native A0GI transfer (loser → winner)
         → recordHandOnChain() → AgentBetGame.sol emits HandSettled event
         → archiveToStorage()  → Game log saved to 0G Storage
```

- **Contract**: `AgentBetGame.sol` at `0x960151387D9661eE84bacfffdea886ADF1911338`
- **Unit mapping**: 1 game-cent = 10^14 wei = 0.0001 A0GI
- **Explorer**: https://chainscan-galileo.0g.ai

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (package manager + runtime)
- An `NVIDIA_API_KEY` (free at [build.nvidia.com](https://build.nvidia.com))
- A funded wallet on 0G Galileo Testnet ([faucet.0g.ai](https://faucet.0g.ai))

### 1. Clone and install

```bash
git clone https://github.com/manjeetsharma0796/agent-bet.git
cd agent-bet
bun install
cd 0g/chain && bun install && cd ../..
```

### 2. Configure environment

Copy `0g/.env.example` to `.env.local` at the project root:

```env
NVIDIA_API_KEY=nvapi-xxxxx
ZG_API_KEY=sk-xxxxx
ZG_PRIVATE_KEY=your_funded_wallet_private_key
ZG_RPC_URL=https://evmrpc-testnet.0g.ai
ZG_CONTRACT_ADDRESS=0x960151387D9661eE84bacfffdea886ADF1911338
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

### 3. Generate agent wallets (first time only)

```bash
bun run 0g/scripts/gen-wallets.ts
bun run 0g/scripts/fund-agents.ts
```

### 4. Run

```bash
# Terminal 1 — Game server
bun run server

# Terminal 2 — Frontend
bun run dev
```

Open [http://localhost:3000](http://localhost:3000), pick your agent, choose a strategy, and play.

---

## Project Structure

```
agent-bet/
├── 0g/
│   ├── compute/
│   │   ├── 0g-compute.ts          # AI inference (dynamic model discovery)
│   │   └── provider-selector.ts   # Single provider routing
│   ├── engine/
│   │   └── 0g-game-manager.ts     # Game loop + settlement + storage
│   ├── chain/
│   │   ├── contracts/AgentBetGame.sol  # On-chain settlement contract
│   │   ├── 0g-chain.ts            # Contract interaction (ethers v6)
│   │   └── 0g-settlement.ts       # Native A0GI transfer layer
│   ├── storage/
│   │   └── 0g-storage.ts          # Game history + KV leaderboard
│   ├── sealed-inference/
│   │   └── sealed-inference.ts     # TEE-verified inference
│   ├── server/
│   │   └── 0g-server.ts           # Socket.io game server
│   └── scripts/
│       ├── gen-wallets.ts          # Generate agent wallets
│       └── fund-agents.ts         # Fund wallets from faucet
├── modules/
│   ├── engine/poker.ts             # Texas Hold'em engine
│   ├── agent/skills.ts             # Poker strategy prompts
│   └── shared/types.ts             # Shared TypeScript types
├── src/app/
│   ├── (dashboard)/                # Agent select, skills, lobby
│   ├── game/[id]/                  # Live poker table
│   └── api/balance/                # On-chain balance query
└── .env.local                      # Secrets (never commit)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 |
| Backend | Bun server + Socket.io |
| AI Inference | 0G Compute (NVIDIA NIM, 90+ models) |
| Blockchain | 0G Galileo Testnet (chain 16602) |
| Smart Contract | Solidity 0.8.19 (AgentBetGame.sol) |
| Token | A0GI (native, 18 decimals) |
| Storage | 0G Storage + KV Store |
| Tooling | Hardhat, ethers v6 |

---

## Chain Reference

| Item | Value |
|------|-------|
| Chain ID | `16602` |
| RPC | `https://evmrpc-testnet.0g.ai` |
| Explorer | `https://chainscan-galileo.0g.ai` |
| Token | A0GI (native, 18 decimals) |
| Faucet | `https://faucet.0g.ai` |
| Contract | `0x960151387D9661eE84bacfffdea886ADF1911338` |

---

## License

MIT
