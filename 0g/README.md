# AgentBet — AI Poker on 0G Network

> 4 AI agents play Texas Hold'em with real on-chain settlements on the 0G Network.
> Every chip move, every bluff, every showdown — recorded immutably on 0G.

**0G APAC Hackathon 2026 Submission**

---

## 0G Integration Depth

AgentBet uses **5 core 0G products** end-to-end:

| 0G Product | Usage | Module |
|---|---|---|
| **0G Chain** | On-chain settlements in native A0GI tokens + HandSettled event audit trail | `0g/chain/` |
| **0G Compute** | AI inference via Router API (DeepSeek V3, Qwen 3.6, 0GM 35B, DeepSeek R1) | `0g/compute/` |
| **0G Storage (Log)** | Immutable game history — every hand archived permanently | `0g/storage/` |
| **0G Storage (KV)** | Mutable leaderboard — live win/loss stats per agent | `0g/storage/` |
| **0G Sealed Inference** | TEE-verified AI decisions — cryptographic proof of fair play | `0g/sealed-inference/` |

### Smart Contract

- **Contract**: `AgentBetGame.sol` — records settled hands with `HandSettled` events
- **Network**: 0G Galileo Testnet (Chain ID: 16602)
- **Explorer**: https://chainscan-galileo.0g.ai

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                        │
│                  (React 19 + Tailwind CSS)                   │
└──────────────────────────┬───────────────────────────────────┘
                           │ Socket.io
┌──────────────────────────▼───────────────────────────────────┐
│                    0G Game Server                             │
│                  (0g/server/0g-server.ts)                     │
├──────────────┬──────────────┬──────────────┬─────────────────┤
│  0G Compute  │  0G Chain    │  0G Storage  │ 0G Sealed       │
│  (AI brain)  │  ($$$ moves) │  (history)   │ (TEE verify)    │
│              │              │              │                 │
│ Router API   │ AgentBetGame │ Log: archive │ Broker auth     │
│ 4 LLM models│ .sol contract│ KV: leaders  │ Proof of fair   │
│ + NVIDIA opt │ A0GI native  │              │ play            │
└──────────────┴──────────────┴──────────────┴─────────────────┘
```

### AI Provider Switching

Users choose their AI provider at runtime:

- **`nvidia`** — NVIDIA NIM (Llama 3.1, Mistral, Nemotron, Qwen)
- **`0g`** — 0G Compute Network (DeepSeek V3, Qwen 3.6+, 0GM 35B, DeepSeek R1)
- **`0g-sealed`** — 0G Sealed Inference with TEE verification badges

---

## Agent Wallets (0G Galileo Testnet)

| Agent | Address |
|---|---|
| Llama | `0x204f4516015905772B7e5c3f1ae42eA6C17Afd38` |
| Mistral | `0x8e46aB328B2b2E35C4dC84432dfa86e273f22612` |
| Nemotron | `0x4f40B47eb826b69136f68E0D36B94229313d12A1` |
| Qwen | `0x4BCc33Eb36fbbf25dDcF26cf485FA08049d44fAb` |
| Gas Station | `0xc3074592310f548A7CC1BcB050ce49a438Aa5D45` |

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) runtime
- 0G testnet tokens from [faucet.0g.ai](https://faucet.0g.ai)
- 0G Compute API key from [pc.0g.ai](https://pc.0g.ai)

### 1. Install Dependencies

```bash
bun install
cd 0g/chain && bun install && cd ../..
```

### 2. Configure Environment

```bash
cp 0g/.env.example .env.local
# Edit .env.local — fill in:
#   ZG_API_KEY=        (from pc.0g.ai)
#   ZG_PRIVATE_KEY=    (your funded wallet)
#   FUNDER_PRIVATE_KEY= (same as ZG_PRIVATE_KEY)
```

### 3. Fund Agent Wallets

```bash
bun run 0g/scripts/fund-agents.ts
```

### 4. Deploy Smart Contract

```bash
cd 0g/chain
PRIVATE_KEY=<your-key> bunx hardhat run scripts/deploy.js --network 0g-testnet
# Copy the deployed address → set ZG_CONTRACT_ADDRESS in .env.local
cd ../..
```

### 5. Start the Server

```bash
bun run 0g/server/0g-server.ts
```

### 6. Start the Frontend

```bash
bun run dev
```

---

## File Structure

```
0g/
├── chain/                     # 0G Chain integration
│   ├── contracts/
│   │   └── AgentBetGame.sol   # On-chain hand settlement contract
│   ├── 0g-chain.ts            # Contract interaction (ethers v6)
│   ├── 0g-settlement.ts       # Settlement layer (native A0GI tokens)
│   ├── hardhat.config.js      # Hardhat config for 0G testnet/mainnet
│   └── scripts/deploy.js      # Deploy + auto-verify on explorer
│
├── compute/                   # 0G Compute integration
│   ├── 0g-compute.ts          # AI provider (Router API, 4 models)
│   ├── config.ts              # Network constants
│   └── provider-selector.ts   # Unified NVIDIA / 0G / Sealed routing
│
├── storage/                   # 0G Storage integration
│   ├── 0g-storage.ts          # Log layer (game history) + KV (leaderboard)
│   └── config.ts              # Storage endpoints
│
├── sealed-inference/          # 0G Sealed Inference (TEE)
│   ├── sealed-inference.ts    # Broker init, verified inference, TEE check
│   ├── config.ts              # TEE provider config
│   └── types.ts               # SealedAgentAction, VerificationResult
│
├── engine/
│   └── 0g-game-manager.ts     # Full game loop wired to all 0G modules
│
├── server/
│   └── 0g-server.ts           # Socket.io server with provider switching
│
├── shared/
│   └── 0g-config.ts           # Central config, unit conversion, wallets
│
├── scripts/
│   ├── gen-wallets.ts          # Generate EVM wallets for agents
│   └── fund-agents.ts         # Fund agent wallets from faucet
│
├── data/
│   └── wallets.json           # Generated agent wallet addresses
│
└── .env.example               # Environment variable template
```

---

## Unit Economics

```
1 game-cent   = 0.0001 A0GI  = 10^14 wei
1 game-dollar = 0.01 A0GI    = 10^16 wei
$100 game     = 1.0 A0GI
```

Agents start with ~0.05 A0GI each ($50 game-dollars).

---

## Tech Stack

- **Runtime**: Bun
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS
- **Backend**: Socket.io on Bun
- **Chain**: 0G Galileo Testnet (EVM, Chain ID 16602)
- **AI**: 0G Compute (Router API) + NVIDIA NIM (optional)
- **Contracts**: Solidity 0.8.19 + Hardhat 2
- **SDKs**: `@0gfoundation/0g-ts-sdk`, `@0gfoundation/0g-compute-ts-sdk`, `ethers` v6

---

## Team

Built for the 0G APAC Hackathon 2026.

---

## License

MIT
