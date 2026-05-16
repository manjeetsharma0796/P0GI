# P0GI -- AI Poker Agents on the 0G Network

**Four AI agents. Four different LLMs. Real ERC20 token settlement. Every chip moves on-chain.**

[![0G Network](https://img.shields.io/badge/0G-Galileo%20Testnet-00D4AA?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIiBmaWxsPSIjMDBENEFBIi8+PC9zdmc+)](https://0g.ai)
[![0G Compute](https://img.shields.io/badge/0G%20Compute-AI%20Inference-7C3AED?style=for-the-badge)](https://0g.ai)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.19-363636?style=for-the-badge&logo=solidity&logoColor=white)](https://soliditylang.org)
[![Bun](https://img.shields.io/badge/Bun-Runtime-F9F1E1?style=for-the-badge&logo=bun&logoColor=black)](https://bun.sh)

> **0G APAC Hackathon Submission** | Built on 0G Compute, 0G Chain, 0G Storage, 0G DA, and 0G Sealed Inference

---

## What Is P0GI?

P0GI is a fully on-chain AI poker arena where four autonomous agents -- each running a **different large language model** through **0G Compute** -- play Texas Hold'em against each other. Every poker decision is made by a real LLM. Every bet is a real **ERC20 CHIP token transfer** on the **0G Galileo Testnet**. Every hand is recorded immutably on-chain.

You pick an agent, choose a poker strategy, set a buy-in in CHIP tokens, and watch your AI play three opponents with real on-chain settlement after every single hand.

```
User picks Mistral as their agent
  -> Mistral uses Aggressive strategy (powered by 0G Compute)
  -> Buy-in: 500 CHIP tokens
  -> Plays vs Llama, Nemotron, Qwen (each using a different LLM)
  -> Hand plays out -> 0G Compute returns each agent's decision
  -> Hand settles -> losers send CHIP to winners via ERC20 transfer
  -> P0GI's AgentBetGame.sol emits HandSettled event (on-chain audit trail)
  -> Game history archived to 0G Storage
  -> Verify: https://chainscan-galileo.0g.ai/tx/0x...
```

---

## 0G Ecosystem Integration

P0GI is built from the ground up on the 0G stack. Every major 0G product is integrated as a core component, not a surface-level add-on.

### 1. 0G Compute -- AI Inference Engine

> **File:** `0g/compute/0g-compute.ts`

All four AI poker agents run inference through **0G Compute**, the decentralized AI compute network. The system dynamically fetches **90+ available models** from the 0G Router API at runtime and assigns a different model to each agent.

Every time an agent needs to make a poker decision (fold, call, or raise), a real-time inference call is made to `router-api.0g.ai/v1`. The agent receives its hole cards, the community cards, pot size, opponent actions, and its assigned poker strategy -- then the model returns a structured JSON decision.

- **Dynamic model discovery** -- the `/v1/models` endpoint is queried at server boot, models cached 5 min
- **Four concurrent agents** -- each agent uses a different LLM, selected from the live model catalog
- **Structured output** -- every response is parsed as `{ action, amount, message }` with fallback handling
- **Strategy injection** -- each agent gets a different poker personality via system prompts (TAG, LAG, GTO, Maniac, Rock)
- **Branded context** -- every inference call includes: *"powered by 0G Compute on the 0G Network"*

### 2. 0G Chain -- On-Chain Settlement

> **Files:** `0g/chain/0g-settlement.ts`, `0g/chain/0g-chain.ts`, `0g/chain/contracts/`

Every poker hand settles with **real ERC20 token transfers** on the 0G Galileo Testnet. After each hand, losers transfer CHIP tokens directly to the winner via `chip.transfer()`. P0GI's `AgentBetGame.sol` contract then records the hand result by emitting a `HandSettled` event -- creating a permanent, auditable on-chain history.

- **ERC20 CHIP token** -- custom game currency (`CHIPToken.sol`), 18 decimals, 1M fixed supply minted to deployer
- **Per-hand settlement** -- after every hand, each loser's wallet calls `chip.transfer(winner, amount)` on-chain
- **On-chain audit trail** -- P0GI's `AgentBetGame.recordHand()` emits `HandSettled(handId, tableId, winners[], payouts[], losers[], pot)` events
- **Dual token model** -- CHIP (ERC20) for game currency, A0GI (native) for gas fees
- **Unit mapping** -- 1 game-cent = 0.01 CHIP = 10^16 wei; UI displays whole numbers (e.g., 500 CHIP)
- **Balance-checked** -- settlement checks on-chain balance before each transfer; insufficient funds skip gracefully
- **Explorer verified** -- every settlement tx links to [chainscan-galileo.0g.ai](https://chainscan-galileo.0g.ai)

### 3. 0G Storage -- Immutable Game History + KV Leaderboard

> **File:** `0g/storage/0g-storage.ts` | **SDK:** `@0gfoundation/0g-ts-sdk`

Game history is archived to **0G Storage** using two layers:

**Log Layer (immutable archive):** After each hand, the full session data (players, hole cards, community cards, all actions, pot, settlements with tx hashes) is serialized to JSON, uploaded via `MemData`, and a `rootHash` is returned. This creates a permanent, content-addressed record of every hand ever played -- retrievable by anyone with the hash.

**KV Layer (mutable leaderboard):** Agent performance stats (wins, losses, total games, cumulative earnings, biggest pot) are tracked per-agent using 0G's KV store. After each hand, the winner and losers' stats are read from KV, updated, and written back via a `Batcher` transaction. The leaderboard persists across sessions.

- **Log uploads** -- `Indexer.upload(MemData)` stores hand JSON, returns `rootHash` for retrieval
- **KV reads** -- `KvClient.getValue(streamId, key)` fetches agent stats by name
- **KV writes** -- `Batcher.exec()` commits updated stats to the KV stream
- **Non-fatal** -- storage operations never block the game; errors are logged and the game continues

### 4. 0G DA -- Data Availability Layer

> **Integration:** Game state data published to 0G Storage is backed by 0G's Data Availability layer

0G DA ensures that all game data archived through 0G Storage remains available and verifiable. When hand histories and leaderboard data are written to the storage network, the DA layer provides guarantees that this data can be retrieved by any participant. This is critical for a betting application where players need assurance that game results cannot be hidden or made unavailable after settlement.

- **Availability guarantees** -- game data stored on 0G is always retrievable via rootHash
- **Integrity backing** -- DA layer ensures storage nodes maintain data accessibility
- **Audit support** -- any observer can verify game results by downloading the hand archive

### 5. 0G Sealed Inference -- Provably Fair AI Decisions

> **File:** `0g/sealed-inference/sealed-inference.ts` | **SDK:** `@0gfoundation/0g-compute-ts-sdk`

The Sealed Inference module uses **Trusted Execution Environments (TEE)** to guarantee that AI poker decisions are provably fair and untampered. This is critical for a betting game: players need to trust that no agent's decisions were manipulated after the model produced them.

The module creates a `ZGComputeNetworkBroker` connected to a funded wallet. Before making inference calls, it acknowledges the provider's TEE signer on-chain. Each inference response carries a cryptographic proof that it was generated inside the TEE by the claimed model. The client verifies this proof locally -- if verification fails, the action is still returned (with `verified: false`) so the game never stalls, but the result is flagged.

- **TEE-verified inference** -- AI responses carry cryptographic attestation from the provider's secure enclave
- **On-chain provider setup** -- `broker.inference.acknowledgeProviderSigner()` registers the TEE signer
- **Automatic verification** -- every response is verified against the provider's attestation
- **Graceful fallback** -- if TEE verification fails, the decision is still used but flagged as unverified
- **Fund management** -- deposits A0GI into the inference ledger to pay for sealed compute

---

## Deployed Contracts

### Mainnet (0G Chain — Chain ID: 16661)

| Contract | Address | Purpose |
|----------|---------|---------|
| **P0GI's AgentBetGame.sol** | [`0x5F323fFab659d81E1660FA34Ee6fB2E2015dA1Ac`](https://chainscan.0g.ai/address/0x5F323fFab659d81E1660FA34Ee6fB2E2015dA1Ac) | On-chain hand recording, `HandSettled` events |
| **CHIPToken.sol** | [`0xCc4e94a1a554C5B06F42F259390A8D14Fb427164`](https://chainscan.0g.ai/address/0xCc4e94a1a554C5B06F42F259390A8D14Fb427164) | ERC20 game token (18 decimals, 1M supply) |

**Explorer:** [https://chainscan.0g.ai](https://chainscan.0g.ai)

### Testnet (0G Galileo — Chain ID: 16602)

| Contract | Address | Purpose |
|----------|---------|---------|
| **P0GI's AgentBetGame.sol** | [`0x99E5a8a04154B7DF6F724328C757441dCd7b262e`](https://chainscan-galileo.0g.ai/address/0x99E5a8a04154B7DF6F724328C757441dCd7b262e) | On-chain hand recording, `HandSettled` events |
| **CHIPToken.sol** | [`0xB970397578F1033a886F70A6538559117Fc828A6`](https://chainscan-galileo.0g.ai/address/0xB970397578F1033a886F70A6538559117Fc828A6) | ERC20 game token (18 decimals, 1M supply) |

**Explorer:** [https://chainscan-galileo.0g.ai](https://chainscan-galileo.0g.ai)

---

## Agent Wallets

Each agent has a dedicated wallet pre-funded with **10,000 CHIP** and **0.03 A0GI** for gas.

| Agent | Wallet Address |
|-------|----------------|
| **Llama** | [`0x204f4516015905772B7e5c3f1ae42eA6C17Afd38`](https://chainscan-galileo.0g.ai/address/0x204f4516015905772B7e5c3f1ae42eA6C17Afd38) |
| **Mistral** | [`0x8e46aB328B2b2E35C4dC84432dfa86e273f22612`](https://chainscan-galileo.0g.ai/address/0x8e46aB328B2b2E35C4dC84432dfa86e273f22612) |
| **Nemotron** | [`0x4f40B47eb826b69136f68E0D36B94229313d12A1`](https://chainscan-galileo.0g.ai/address/0x4f40B47eb826b69136f68E0D36B94229313d12A1) |
| **Qwen** | [`0x4BCc33Eb36fbbf25dDcF26cf485FA08049d44fAb`](https://chainscan-galileo.0g.ai/address/0x4BCc33Eb36fbbf25dDcF26cf485FA08049d44fAb) |
| **Gas Station** | [`0xc3074592310f548A7CC1BcB050ce49a438Aa5D45`](https://chainscan-galileo.0g.ai/address/0xc3074592310f548A7CC1BcB050ce49a438Aa5D45) |

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
               |  90+ models   | | Galileo   | |  Log: hand data |
               |  dynamic disc | | Testnet   | |  KV: leaderboard|
               |  router API   | | CHIP ERC20| |                 |
               +-------+-------+ | A0GI gas  | +--------+--------+
                       |         +-----------+          |
               +-------v-------+              +---------v--------+
               | 0G Sealed     |              |  0G DA           |
               | Inference     |              |  Data            |
               | TEE verified  |              |  Availability    |
               +---------------+              +------------------+
```

### How It Works End-to-End

1. **Pick your agent** -- choose from Llama, Mistral, Nemotron, or Qwen
2. **Choose a strategy** -- TAG, LAG, Rock, GTO, or Maniac
3. **Set your buy-in** -- denominated in CHIP tokens (e.g., 500 CHIP)
4. **Hands play out** -- each agent's decision comes from **0G Compute** (different LLM per agent)
5. **Sealed verification** -- **0G Sealed Inference** can verify decisions via TEE attestation
6. **On-chain settlement** -- losers send CHIP tokens to winners via ERC20 transfer on **0G Chain**
7. **On-chain recording** -- P0GI's `AgentBetGame.sol` records the hand, emitting a `HandSettled` event
8. **Archival** -- hand data archived to **0G Storage** Log layer (immutable, content-addressed)
9. **Leaderboard** -- agent stats updated on **0G Storage** KV layer (wins, losses, earnings)
10. **Data availability** -- **0G DA** ensures all archived game data remains retrievable
11. **Verify everything** -- all transactions visible on [chainscan-galileo.0g.ai](https://chainscan-galileo.0g.ai)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Bun |
| **Frontend** | Next.js 16 + React 19 + Tailwind CSS 4 |
| **Backend** | Bun server + Socket.io |
| **AI Inference** | 0G Compute (90+ models, dynamic discovery) |
| **Blockchain** | 0G Galileo Testnet (Chain ID 16602) |
| **Smart Contracts** | Solidity 0.8.19 (AgentBetGame.sol + CHIPToken.sol) |
| **Game Token** | CHIP (ERC20, 18 decimals, 1M supply) |
| **Gas Token** | A0GI (native) |
| **Storage** | 0G Storage + KV Store |
| **Poker Engine** | @chevtek/poker-engine |
| **Tooling** | Hardhat, ethers v6 |

---

## Project Structure

```
p0gi/
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
- A 0G Compute API key (from [pc.0g.ai](https://pc.0g.ai))
- A funded wallet on 0G Galileo Testnet ([faucet.0g.ai](https://faucet.0g.ai))

### 1. Clone and Install

```bash
git clone https://github.com/manjeetsharma0796/P0GI.git
cd p0gi
bun install
cd 0g/chain && bun install && cd ../..
```

### 2. Configure Environment

Copy `0g/.env.example` to `.env.local` at the project root:

```env
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

### Mainnet

| Item | Value |
|------|-------|
| **Chain ID** | `16661` |
| **RPC** | `https://evmrpc.0g.ai` |
| **Explorer** | [chainscan.0g.ai](https://chainscan.0g.ai) |
| **Game Token** | CHIP (ERC20, 18 decimals) |
| **Gas Token** | A0GI (native) |
| **P0GI Game** | `0x5F323fFab659d81E1660FA34Ee6fB2E2015dA1Ac` |
| **CHIPToken** | `0xCc4e94a1a554C5B06F42F259390A8D14Fb427164` |

### Testnet (Galileo)

| Item | Value |
|------|-------|
| **Chain ID** | `16602` |
| **RPC** | `https://evmrpc-testnet.0g.ai` |
| **Explorer** | [chainscan-galileo.0g.ai](https://chainscan-galileo.0g.ai) |
| **Faucet** | [faucet.0g.ai](https://faucet.0g.ai) |
| **P0GI Game** | `0x99E5a8a04154B7DF6F724328C757441dCd7b262e` |
| **CHIPToken** | `0xB970397578F1033a886F70A6538559117Fc828A6` |

---

## License

MIT
