# AgentBet

**Four AI agents play Texas Hold'em on a purpose-built Initia rollup. Every hand is settled by a Move smart contract on `agentbet-1` — a dedicated Agent Chain on Initia's Interwoven Rollup network.**

## Initia Hackathon Submission

- **Project Name**: AgentBet

### Project Overview

AgentBet is a live poker arena where four LLM-powered AI agents play Texas Hold'em against each other (and against you) with every hand settled by a Move smart contract on our purpose-built Initia rollup, `agentbet-1`. It solves a foundational problem for the AI x onchain space: AI agents can think, but until they have wallets, settlement, and verifiable records, they cannot transact. AgentBet ships a complete proof of that idea, valuable to anyone exploring autonomous agent economies, onchain games, or programmable peer-to-peer settlement.

### Implementation Detail

- **The Custom Implementation**: We designed and deployed our own Move module, `agentbet::game`, with an admin-gated `record_hand` entry function and a `HandSettled` event ([move/sources/game.move](move/sources/game.move)). The contract enforces `sum(payouts) == pot` at the protocol level, so settlement integrity is guaranteed by Move, not by the server. Around it, we built a full Bun + Next.js stack: a four-seat poker engine, NVIDIA NIM agents (Llama 3.3 70B, Mistral Small 4, Nemotron Super 49B, Llama 3.1 8B) with five strategy presets (TAG, LAG, Rock, GTO, Maniac) and stack-relative bet sizing, a live game UI with card animations and showdown reveals, and a `/tx/[hash]` proof page that parses the `HandSettled` event, transfers, and Move call into a clean human-readable view. Everything runs on `agentbet-1`, the Minimove rollup we spun up with `weave` + `minitiad`, with `CHIP` (denom `uchip`, 6 decimals) as the native token and a dedicated gas station that airdrops new connections so first-time players never hit a faucet.
- **The Native Feature**: We use **`auto-signing`** via `InterwovenKit` ([src/components/wallet-panel.tsx](src/components/wallet-panel.tsx), the `autoSign.enable(CHAIN_ID)` / `autoSign.disable(CHAIN_ID)` toggle). Poker is high-frequency: every hand has multiple bets, calls, and folds. Without auto-sign, each action would trigger a wallet popup and break the entire game flow. With auto-sign enabled for `agentbet-1`, every bet still becomes a real onchain transaction, but the player gets a continuous, lag-free poker experience. The toggle shows a live expiry timestamp, so the user always knows when their session signing window ends.

### How to Run Locally

1. Open the repo in the provided GitHub Codespace. The devcontainer auto-installs `lz4`, `weave`, `minitiad`, and the Move toolchain, then post-start runs `minitiad start` and `bun run play` so the rollup is live on first boot.
2. In a new terminal, set `NVIDIA_API_KEY` in `.env.local` (free key at [build.nvidia.com](https://build.nvidia.com)).
3. Run `bun run server` (game server on port 3001) and `bun run dev` (Next.js frontend on port 3000) in two terminals.
4. Open [http://localhost:3000](http://localhost:3000), click **Connect via InterwovenKit**, accept the auto airdrop of 500 CHIP, toggle **Auto-sign** on, pick your agent, choose a strategy, and play.

[![Initia](https://img.shields.io/badge/L1-Initia%20(initiation--2)-2D5BFF)](https://initia.xyz)
[![Rollup](https://img.shields.io/badge/Rollup-agentbet--1%20(minitia)-7C3AED)](https://initia.xyz)
[![Move](https://img.shields.io/badge/Smart%20Contracts-Move-1F2937)](https://github.com/initia-labs/movevm)
[![NVIDIA NIM](https://img.shields.io/badge/AI-NVIDIA%20NIM-76b900)](https://build.nvidia.com)

---

## What Is This?

Four AI agents — each powered by a different LLM — sit at a poker table and play Texas Hold'em. Every decision is made by a real language model. Every hand is **settled on-chain** by a Move contract running on `agentbet-1`, our own application-specific rollup spun up with `minitiad` on Initia.

You pick one agent as your character, choose a poker strategy, set a buy-in, and watch your AI play three opponents — with each settlement going through the rollup as a verifiable Move transaction.

```
User picks Mistral as their agent
  → Mistral uses Tight Aggressive strategy
  → Mistral's wallet: init10x482x50c9je2frtqvhree8yxtx2793k4r4tvc
  → Buy-in: 4.00 CHIP (rollup native token)
  → Plays vs Llama, Nemotron, Qwen
  → Mistral wins → Move module records HandSettled event
  → Real tx on agentbet-1: 0xED2A6B57...
```

---

## Initia Hackathon — Track & Criteria

Built for the **Initia Hackathon**.

> **Track: Agent Chains / Interwoven Rollups (Move).**
> The criteria: ship a purpose-built application rollup ("minitia") on Initia's Interwoven Rollup network, with on-chain logic written in Move using `InitiaStdlib`.

How AgentBet meets it:

| Criterion | How we ship it |
|-----------|----------------|
| **Purpose-built Agent Chain** | `agentbet-1` — a dedicated `minitiad` rollup whose only job is settling AI poker hands |
| **Move smart contract** | `agentbet::game` module with `record_hand` entry fn + `HandSettled` event ([move/sources/game.move](move/sources/game.move)) |
| **Initia Stdlib** | Imports `initia_std::event` for native event emission |
| **Interwoven liquidity** | Funded from Initia testnet `initiation-2` via the gas station address into rollup wallets |
| **Codespace-native deploy** | One-shot devcontainer setup auto-runs `weave init` + `minitiad start` + Move publish |
| **Real agents, real chain** | NVIDIA NIM agents make decisions → server builds a Move tx → submitted to the rollup → indexed for the UI |

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
              ┌────────▼──┐  ┌──────▼──────┐  ┌────▼───────────────┐
              │ NVIDIA NIM │  │   Initia    │  │  agentbet-1        │
              │ Free LLM   │  │   L1        │  │  Minitia Rollup    │
              │ API        │  │ initiation-2│  │  (Move VM)         │
              │            │  │ Funding +   │  │  • record_hand     │
              │            │  │ Gas Station │  │  • HandSettled evt │
              └────────────┘  └─────────────┘  └────────────────────┘
                                                          │
                                                          ▼
                                              ┌────────────────────┐
                                              │   /tx/[hash]       │
                                              │   On-chain proof   │
                                              │   page (Cosmos REST)│
                                              └────────────────────┘
```

**Layers**

- **L1 — Initia (`initiation-2`)**: source of liquidity, gas-station funding, and the security anchor for the rollup.
- **L2 — `agentbet-1` (minitia)**: app-specific rollup running `minitiad`. Native token: `CHIP` (denom `uchip`, 6 decimals). Bech32 prefix: `init`.
- **Move module — `agentbet::game`**: only the module publisher (gas station / admin) can call `record_hand`. Validates `sum(payouts) == pot`, then emits `HandSettled`.

---

## Move Module — `agentbet::game`

```move
module agentbet::game {
    use initia_std::event;

    #[event]
    struct HandSettled has drop, store {
        hand_id: u64,
        table_id: u64,
        winners: vector<address>,
        payouts: vector<u64>,
        losers:  vector<address>,
        pot:     u64,
    }

    public entry fun record_hand(
        admin: &signer,
        hand_id: u64, table_id: u64,
        winners: vector<address>, payouts: vector<u64>,
        losers:  vector<address>, pot: u64,
    ) { /* asserts admin + sum(payouts) == pot, emits HandSettled */ }
}
```

- **Address**: `0x4a1a95fc8b1d51c709a4cfdda7c7112a3748ed97`
- **Module**: `agentbet::game`
- **Entry fn**: `record_hand`
- **Deploy tx**: `ED2A6B5700D7FB05F648C66FCD1C32967C8E27B48E57CB1BDFCEACF21F493EF7`
- **Source**: [move/sources/game.move](move/sources/game.move) · [move/Move.toml](move/Move.toml)

The frontend's `/tx/[hash]` page parses the `HandSettled` event + transfers + Move call into a clean proof view.

---

## NVIDIA NIM — Free LLM API

Four different models compete, each with unique poker intelligence:

| Agent | Model | Style | Rollup Address |
|-------|-------|-------|----------------|
| Llama | Llama 3.3 70B | Calculated, patient | `init1kz6huu8t95wuvgjvzwjrgd7dddtmcg6n0qkf8v` |
| Mistral | Mistral Small 4 119B | Aggressive bluffer | `init10x482x50c9je2frtqvhree8yxtx2793k4r4tvc` |
| Nemotron | Nemotron Super 49B | Mathematical, precise | `init14m3a8z6ycv9vfv90pkfg8jtkwth2ttxjqtpf6k` |
| Qwen | Llama 3.1 8B | Conservative, tight | `init1jlvnync70ufllq08945zzsxfqfrxd7dc20u3lj` |

Each agent receives a strategy prompt (TAG, LAG, Rock, GTO, Maniac) that shapes its decisions. The LLM outputs structured JSON: `{ action, amount, message }` — the message becomes in-game trash talk. Bet sizing is **stack-relative**, so agents scale aggression to their actual chip stack.

---

## Features

- **Single-select agent picker** — choose your AI character from 4 LLM-powered agents
- **Live rollup balances** — CHIP balances queried from the rollup REST endpoint
- **Buy-in slider** — set how much your agent risks per session; opponents are matched to your buy-in
- **5 poker strategies** — Tight Aggressive, Loose Aggressive, Rock, GTO Grinder, Maniac
- **Premium model support** — bring your own key for Gemini 2.5 Flash, Claude Sonnet, GPT-4o
- **Live game table** — card animations, speech bubbles, chip-flying, showdown reveals
- **On-chain settlement** — every hand's outcome is recorded by the `record_hand` Move entry fn
- **Tx proof page** — `/tx/[hash]` parses Move call + `HandSettled` event + transfers into a clean view
- **Re-buy + recovery flow** — 30-second countdown when an agent busts; refund script for zero-balance recovery

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) (package manager + runtime)
- An `NVIDIA_API_KEY` (free at [build.nvidia.com](https://build.nvidia.com))
- The provided **devcontainer** / Codespace, which auto-installs `lz4`, `weave`, `minitiad`, and the Move toolchain

### 1. Open in Codespaces (recommended)

```bash
# Devcontainer post-start auto-resumes minitiad + bun run play.
# Agent addresses + the deploy tx are codespace-generated on first launch.
```

### 2. Or run locally

```bash
git clone https://github.com/manjeetsharma0796/agentbet.git
cd agentbet
bun install
```

### 3. Configure environment

```env
NVIDIA_API_KEY=nvapi-xxxxx
ROLLUP_RPC=http://localhost:26657
ROLLUP_REST=http://localhost:1317
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

### 4. Bring up the rollup + game

```bash
# Terminal 1 — rollup node (auto on Codespaces)
minitiad start

# Terminal 2 — game server
bun run server

# Terminal 3 — frontend
bun run dev
```

Open [http://localhost:3000](http://localhost:3000), pick your agent, choose a strategy, and play.

---

## On-Chain Settlement Flow

```
Hand #3: Llama wins with Full House

  Server (game-manager.ts)
       │
       │ 1. Compute winners + payouts from showdown
       │ 2. Build Move tx → agentbet::game::record_hand(
       │       hand_id, table_id, winners[], payouts[], losers[], pot
       │    )
       │ 3. Sign with admin / gas-station key
       │ 4. Broadcast to agentbet-1 via REST /cosmos/tx
       │
       ▼
  ┌────────────────────────────────────────┐
  │ agentbet-1 (minitia rollup)           │
  │   • record_hand asserts sum == pot    │
  │   • emits HandSettled event           │
  │   • tx hash → indexer + UI            │
  └────────────────────────────────────────┘
       │
       ▼
  UI shows: "Hand Settled" + link to /tx/[hash]
```

Every settlement is a real Move transaction on the rollup — verifiable, immutable, queryable via Cosmos REST.

---

## Project Structure

```
agentbet/
├── move/
│   ├── Move.toml                  # InitiaStdlib dep, agentbet address
│   └── sources/game.move          # agentbet::game module (record_hand + HandSettled)
├── modules/
│   ├── engine/
│   │   ├── poker.ts               # Texas Hold'em engine
│   │   └── game-manager.ts        # Game loop, AI decisions, on-chain settlement
│   ├── chain/
│   │   ├── initia.ts              # minitiad RPC/REST client + Move tx builder
│   │   └── settlement.ts          # record_hand call + HandSettled parser
│   ├── agent/
│   │   ├── nvidia.ts              # NVIDIA NIM LLM integration
│   │   └── skills.ts              # Poker strategy prompts
│   └── shared/
│       ├── chain.ts               # Chain config, agent wallets, GAME_MODULE
│       └── types.ts               # Shared TypeScript types
├── server/
│   └── index.ts                   # Socket.io game server (:3001)
├── src/app/
│   ├── (dashboard)/
│   │   ├── agents/                # Agent selection (single-select picker)
│   │   ├── skills/                # Strategy selection
│   │   └── lobby/                 # Game browser + Quick Play
│   ├── game/[id]/                 # Live poker table
│   ├── tx/[hash]/                 # Move tx proof page (HandSettled + transfers)
│   └── api/balance/               # On-chain CHIP balance query
├── scripts/
│   ├── refund-agents.sh           # Zero-balance recovery flow
│   └── fund-and-deploy.ts         # Fund agents + publish Move module
└── .devcontainer/                 # Codespace bootstrap (lz4, weave, minitiad)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 |
| Backend | Bun server + Socket.io |
| AI | NVIDIA NIM (free, OpenAI-compatible) |
| L1 | Initia (`initiation-2`) |
| Rollup | `agentbet-1` minitia rollup (`minitiad`) |
| Smart contracts | Move + `InitiaStdlib` |
| Wallet kit | InterwovenKit |
| Tx interface | Cosmos REST (`/cosmos/tx`) |
| Setup | `weave init` (Initia rollup scaffolder) |

---

## Chain Reference

| Item | Value |
|------|-------|
| L1 chain id | `initiation-2` |
| L1 RPC | `https://rpc.testnet.initia.xyz` |
| L1 REST | `https://rest.testnet.initia.xyz` |
| L1 faucet | `https://faucet.testnet.initia.xyz` |
| Rollup chain id | `agentbet-1` |
| Rollup denom | `uchip` (display: `CHIP`, 6 decimals) |
| Rollup gas price | `0.15uchip` |
| Bech32 prefix | `init` |
| Gas station | `init1fgdftlytr4guwzdyelw603c39gm53mvhj0l6kn` |
| Move module | `0x4a1a95fc8b1d51c709a4cfdda7c7112a3748ed97::game` |

---

## Team

Built for the **Initia Hackathon**.

| Member | Module |
|--------|--------|
| **M** | Poker Engine, Game Loop, UI/Frontend, Server, Initia Port (Move + minitiad + REST) |
| **J** | UI Components |
| **P** | AI Agent Decisions (NVIDIA), Wallets, Settlement Integration |

---

## License

MIT
