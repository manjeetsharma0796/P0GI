# AgentBet -- AI Poker Agents on the 0G Network

**Four AI agents. Four different LLMs. Real ERC20 token settlement. Every chip moves on-chain.**

[![0G Network](https://img.shields.io/badge/0G-Galileo%20Testnet-00D4AA?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIiBmaWxsPSIjMDBENEFBIi8+PC9zdmc+)](https://0g.ai)
[![0G Compute](https://img.shields.io/badge/0G%20Compute-AI%20Inference-7C3AED?style=for-the-badge)](https://0g.ai)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.19-363636?style=for-the-badge&logo=solidity&logoColor=white)](https://soliditylang.org)
[![NVIDIA NIM](https://img.shields.io/badge/NVIDIA-NIM%2090%2B%20Models-76B900?style=for-the-badge&logo=nvidia&logoColor=white)](https://build.nvidia.com)
[![Bun](https://img.shields.io/badge/Bun-Runtime-F9F1E1?style=for-the-badge&logo=bun&logoColor=black)](https://bun.sh)

> **0G APAC Hackathon Submission** | Built on 0G Compute, 0G Chain, 0G Storage, 0G DA, and 0G Sealed Inference

---

## What Is AgentBet?

AgentBet is a fully on-chain AI poker arena where four autonomous agents -- each running a **different large language model** through **0G Compute** -- play Texas Hold'em against each other. Every poker decision is made by a real LLM. Every bet is a real **ERC20 CHIP token transfer** on the **0G Galileo Testnet**. Every hand is recorded immutably on-chain.

You pick an agent, choose a poker strategy, set a buy-in in CHIP tokens, and watch your AI play three opponents with real on-chain settlement after every single hand.

```
User picks Mistral as their agent
  -> Mistral uses Aggressive strategy (powered by Mistral Small 4 via 0G Compute)
  -> Buy-in: 500 CHIP tokens
  -> Plays vs Llama, Nemotron, Qwen (each using a different LLM)
  -> Hand plays out -> 0G Compute returns each agent's decision
  -> Hand settles -> losers send CHIP to winners via ERC20 transfer
  -> AgentBetGame.sol emits HandSettled event (on-chain audit trail)
  -> Game history archived to 0G Storage
  -> Verify: https://chainscan-galileo.0g.ai/tx/0x...
```

---

## 0G Ecosystem Integration

AgentBet is built from the ground up on the 0G stack. Every major 0G product is integrated as a core component, not a surface-level add-on.

### 1. 0G Compute -- AI Inference Engine

> **File:** `0g/compute/0g-compute.ts`

All four AI poker agents run inference through **0G Compute**, which provides access to **NVIDIA NIM** under the hood. The system dynamically fetches **90+ available models** from the `/v1/models` endpoint and lets each agent use a different LLM.

- **Dynamic model discovery** -- models are fetched live from the 0G Compute network, not hardcoded
- **Four concurrent agents** -- each agent runs a different model (Llama 3.3 70B, Mistral Small 4 119B, Nemotron Super 49B, Qwen variants)
- **OpenAI-compatible API** -- routed through `router-api.0g.ai/v1`
- **System prompt** -- every inference call is branded: *"powered by 0G Compute on the 0G Network"*

### 2. 0G Chain -- On-Chain Settlement

> **Files:** `0g/chain/0g-settlement.ts`, `0g/chain/0g-chain.ts`

Every poker hand settles with **real ERC20 token transfers** on the 0G Galileo Testnet. Losers transfer CHIP tokens to winners. The `AgentBetGame.sol` contract records every hand with a `HandSettled` event -- creating a permanent, auditable on-chain history of every game played.

- **ERC20 CHIP token** -- custom game currency (`CHIPToken.sol`), 18 decimals, 1M total supply
- **Native A0GI for gas** -- all transactions pay gas in the native 0G token
- **On-chain recording** -- `recordHand()` emits `HandSettled` events for every hand
- **Unit mapping** -- 1 game-cent = 0.01 CHIP = 10^16 wei (whole-number display in UI)

### 3. 0G Storage -- Immutable Game History

> **File:** `0g/storage/0g-storage.ts`

Game history is archived to **0G Storage** for permanent, decentralized record-keeping. Hand logs, results, and session data are stored immutably. A **KV store** powers the leaderboard, tracking cumulative agent performance across all games.

- **Hand log archival** -- every completed hand is written to 0G Storage
- **Session data** -- full game sessions preserved for replay and audit
- **KV leaderboard** -- persistent win/loss tracking across sessions

### 4. 0G DA -- Data Availability

Data availability layer ensures game state integrity. Game state transitions are backed by 0G's DA layer, providing guarantees that the poker game state is available and verifiable.

### 5. 0G Sealed Inference -- Provably Fair AI

> **File:** `0g/sealed-inference/sealed-inference.ts`

TEE-verified inference module ensures that AI decisions are provably fair and untampered. Sealed Inference provides cryptographic guarantees that no agent's decisions have been manipulated -- critical for a betting game where fairness is non-negotiable.

---

## Deployed Contracts

All contracts are live on the **0G Galileo Testnet (Chain ID: 16602)**.

| Contract | Address | Purpose |
|----------|---------|---------|
| **AgentBetGame.sol** | [`0x99E5a8a04154B7DF6F724328C757441dCd7b262e`](https://chainscan-galileo.0g.ai/address/0x99E5a8a04154B7DF6F724328C757441dCd7b262e) | On-chain hand recording, `HandSettled` events |
| **CHIPToken.sol** | [`0xB970397578F1033a886F70A6538559117Fc828A6`](https://chainscan-galileo.0g.ai/address/0xB970397578F1033a886F70A6538559117Fc828A6) | ERC20 game token (18 decimals, 1M supply) |

**Explorer:** [https://chainscan-galileo.0g.ai](https://chainscan-galileo.0g.ai)

---

## Agent Wallets

Each agent has a dedicated wallet pre-funded with **10,000 CHIP** and **0.03 A0GI** for gas.

| Agent | Model | Wallet Address |
|-------|-------|----------------|
| **Llama** | Llama 3.3 70B Instruct | [`0x204f4516015905772B7e5c3f1ae42eA6C17Afd38`](https://chainscan-galileo.0g.ai/address/0x204f4516015905772B7e5c3f1ae42eA6C17Afd38) |
| **Mistral** | Mistral Small 4 119B | [`0x8e46aB328B2b2E35C4dC84432dfa86e273f22612`](https://chainscan-galileo.0g.ai/address/0x8e46aB328B2b2E35C4dC84432dfa86e273f22612) |
| **Nemotron** | Nemotron Super 49B | [`0x4f40B47eb826b69136f68E0D36B94229313d12A1`](https://chainscan-galileo.0g.ai/address/0x4f40B47eb826b69136f68E0D36B94229313d12A1) |
| **Qwen** | Llama 3.1 70B Instruct | [`0x4BCc33Eb36fbbf25dDcF26cf485FA08049d44fAb`](https://chainscan-galileo.0g.ai/address/0x4BCc33Eb36fbbf25dDcF26cf485FA08049d44fAb) |
| **Gas Station** | -- | [`0xc3074592310f548A7CC1BcB050ce49a438Aa5D45`](https://chainscan-galileo.0g.ai/address/0xc3074592310f548A7CC1BcB050ce49a438Aa5D45) |

---

## Architecture

```
                    +--------------------------------------------+
                    |          Next.js 16 Frontend               |
                    |   Agent Select -> Skills -> Lobby -> Game  |
                    |       Real-time updates via Socket.io      |
                    +-----------+--------------------------------+
                                |
                    +-----------v--------------------------------+
                    |        Bun Game Server (:3001)              |
                    |   Poker Engine -> AI Decisions -> Settle    |
                    +---+------------+------------+--------------+
                        |            |            |
               +--------v------+ +--v--------+ +-v---------------+
               |  0G Compute   | | 0G Chain  | |  0G Storage     |
               |  NVIDIA NIM   | | Galileo   | |  Game History   |
               |  90+ models   | | Testnet   | |  + KV Store     |
               |  dynamic API  | | CHIP ERC20| |  Leaderboard    |
               +---------------+ | A0GI gas  | +-----------------+
                                 +-----------+
```

### How It Works End-to-End

1. **Pick your agent** -- choose from Llama, Mistral, Nemotron, or Qwen
2. **Choose a strategy** -- TAG, LAG, Rock, GTO, or Maniac
3. **Set your buy-in** -- denominated in CHIP tokens (e.g., 500 CHIP)
4. **Hands play out** -- each agent's decision comes from **0G Compute** (different LLM per agent)
5. **On-chain settlement** -- after each hand, losers send CHIP tokens to winners via ERC20 transfer on 0G Chain
6. **On-chain recording** -- `AgentBetGame.sol` records the hand, emitting a `HandSettled` event
7. **Archival** -- game history is written to **0G Storage** for permanent record
8. **Verify everything** -- all transactions visible on [chainscan-galileo.0g.ai](https://chainscan-galileo.0g.ai)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Bun |
| **Frontend** | Next.js 16 + React 19 + Tailwind CSS 4 |
| **Backend** | Bun server + Socket.io |
| **AI Inference** | 0G Compute (NVIDIA NIM, 90+ models, dynamic discovery) |
| **Blockchain** | 0G Galileo Testnet (Chain ID 16602) |
| **Smart Contracts** | Solidity 0.8.19 (AgentBetGame.sol + CHIPToken.sol) |
| **Game Token** | CHIP (ERC20, 18 decimals, 1M supply) |
| **Gas Token** | A0GI (native) |
| **Storage** | 0G Storage + KV Store |
| **Poker Engine** | @chevtek/poker-engine |
| **Tooling** | Hardhat, ethers v6, OpenAI SDK |

---

## Project Structure

```
agent-bet/
|
+-- 0g/
|   +-- compute/
|   |   +-- 0g-compute.ts            # 0G Compute -- AI inference, 90+ models
|   |   +-- provider-selector.ts     # Single provider routing
|   +-- engine/
|   |   +-- 0g-game-manager.ts       # Game loop + settlement + storage
|   |   +-- logger.ts                # Game event logging
|   +-- chain/
|   |   +-- contracts/
|   |   |   +-- AgentBetGame.sol     # On-chain hand recording
|   |   |   +-- CHIPToken.sol        # ERC20 game token (CHIP)
|   |   +-- 0g-chain.ts              # Contract interaction (ethers v6)
|   |   +-- 0g-settlement.ts         # ERC20 CHIP transfer settlement
|   +-- storage/
|   |   +-- 0g-storage.ts            # 0G Storage + KV leaderboard
|   +-- sealed-inference/
|   |   +-- sealed-inference.ts       # TEE-verified inference
|   +-- server/
|   |   +-- 0g-server.ts             # Socket.io game server
|   +-- scripts/
|   |   +-- gen-wallets.ts            # Generate agent wallets
|   |   +-- fund-agents.ts           # Fund agents with CHIP + A0GI
|   +-- data/
|       +-- wallets.json              # Agent wallet keys (gitignored)
|
+-- modules/
|   +-- engine/poker.ts               # Texas Hold'em engine wrapper
|   +-- agent/skills.ts               # Poker strategy prompt definitions
|   +-- shared/types.ts               # Shared TypeScript types
|
+-- src/app/
|   +-- (dashboard)/                  # Agent select, skills, lobby UI
|   +-- game/[id]/                    # Live poker table
|   +-- api/balance/                  # On-chain balance query
|
+-- .env.local                        # Secrets (never commit)
```

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) -- package manager and runtime
- An `NVIDIA_API_KEY` (free at [build.nvidia.com](https://build.nvidia.com))
- A funded wallet on 0G Galileo Testnet ([faucet.0g.ai](https://faucet.0g.ai))

### 1. Clone and Install

```bash
git clone https://github.com/manjeetsharma0796/agent-bet.git
cd agent-bet
bun install
cd 0g/chain && bun install && cd ../..
```

### 2. Configure Environment

Copy `0g/.env.example` to `.env.local` at the project root:

```env
NVIDIA_API_KEY=nvapi-xxxxx
ZG_API_KEY=sk-xxxxx
ZG_PRIVATE_KEY=your_funded_wallet_private_key
ZG_RPC_URL=https://evmrpc-testnet.0g.ai
ZG_CONTRACT_ADDRESS=0x99E5a8a04154B7DF6F724328C757441dCd7b262e
ZG_CHIP_TOKEN_ADDRESS=0xB970397578F1033a886F70A6538559117Fc828A6
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

### 3. Deploy Contracts (or use the deployed addresses above)

```bash
cd 0g/chain
PRIVATE_KEY=xxx bunx hardhat run scripts/deploy.js --network 0g-testnet
cd ../..
```

### 4. Generate and Fund Agent Wallets

```bash
bun run 0g/scripts/gen-wallets.ts
bun run 0g/scripts/fund-agents.ts
```

### 5. Run

```bash
# Terminal 1 -- Game server
bun run server

# Terminal 2 -- Frontend
bun run dev
```

Open [http://localhost:3000](http://localhost:3000), pick your agent, choose a strategy, and play.

---

## Chain Reference

| Item | Value |
|------|-------|
| **Chain ID** | `16602` |
| **RPC** | `https://evmrpc-testnet.0g.ai` |
| **Explorer** | [chainscan-galileo.0g.ai](https://chainscan-galileo.0g.ai) |
| **Game Token** | CHIP (ERC20, 18 decimals) |
| **Gas Token** | A0GI (native) |
| **Faucet** | [faucet.0g.ai](https://faucet.0g.ai) |
| **AgentBetGame** | `0x99E5a8a04154B7DF6F724328C757441dCd7b262e` |
| **CHIPToken** | `0xB970397578F1033a886F70A6538559117Fc828A6` |

---

## License

MIT
