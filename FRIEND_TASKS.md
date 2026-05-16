# Agent Poker — Friend's Tasks

> Hey! This file is for you. Read this fully before starting.
> Your Claude Code should read this file + PROJECT.md + CHECKLIST.md for full context.

---

## What We're Building

**AI Poker Night** — 6 AI agents (different LLM models) each hold a real crypto wallet (OWS) and play Texas Hold'em poker. Bets settle via x402 micropayments on-chain. It's for the OWS Hackathon (April 3, 2026, deadline midnight EST).

**Your job:** Build the agent brain + wallet + payment layer.
**My job:** Build the poker engine + game loop + UI.

We meet in the middle at `server/game-manager.ts` where everything gets wired together.

---

## Your Branch

```bash
git clone git@github.com:manjeetsharma0796/agent-poker.git
cd agent-poker
git checkout -b feat/agent-wallet
```

---

## Your Files (only touch these)

```
lib/nvidia.ts     ← AI agent decisions via NVIDIA free API
lib/ows.ts        ← OWS wallet creation + balance reading
lib/x402.ts       ← x402 bet settlement (pay from wallet to pot)
lib/types.ts      ← shared TypeScript types (create this first)
.env.local        ← add your keys here (do not commit)
```

**Do not touch:**
- `lib/poker.ts` — that's mine
- `server/game-manager.ts` — we build this together after merge
- `app/` — UI is mine

---

## Step 1 — Create Shared Types First `[FRIEND]`

Create `lib/types.ts` with these exact types so both sides connect cleanly:

```ts
// lib/types.ts

export type AgentName = "Llama" | "Mistral" | "DeepSeek" | "Qwen"

export type ActionType = "fold" | "call" | "raise"

export interface AgentAction {
  action: ActionType
  amount: number      // in cents (e.g. 50 = $0.50). 0 if fold or call
  message: string     // trash talk / reasoning — shown in UI
}

export interface GameState {
  agentName: AgentName
  holeCards: string[]        // e.g. ["Ad", "Ks"]
  communityCards: string[]   // e.g. ["7h", "2c", "Jd"]
  pot: number                // in cents
  myStack: number            // in cents
  callAmount: number         // in cents, 0 if check is free
  otherActions: string[]     // e.g. ["Llama raised 50", "Qwen folded"]
}

export interface Agent {
  name: AgentName
  model: string              // NVIDIA model ID
  personality: string        // injected into system prompt
  walletAddress: string      // OWS wallet address
}

export interface Wallet {
  address: string
  agentName: AgentName
}

export type TxHash = string
```

---

## Step 2 — NVIDIA Agent Decisions `[FRIEND]`

Create `lib/nvidia.ts`:

**What it does:** Takes a game state, calls the right LLM model via NVIDIA free API, returns a poker decision.

**NVIDIA API is OpenAI-compatible** — same SDK, different base URL.

```ts
// lib/nvidia.ts
import OpenAI from "openai"
import { AgentAction, Agent, GameState } from "./types"

const nvidia = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY!,
})

// Define agents here
export const AGENTS: Agent[] = [
  {
    name: "Llama",
    model: "meta/llama-3.3-70b-instruct",
    personality: "calculated and patient, rarely bluffs, waits for strong hands",
    walletAddress: "",   // filled in after OWS wallet creation
  },
  {
    name: "Mistral",
    model: "mistralai/mistral-large-2-instruct",
    personality: "aggressive, raises often, loves to bluff",
    walletAddress: "",
  },
  {
    name: "DeepSeek",
    model: "deepseek-ai/deepseek-r1",
    personality: "slow deep thinker, rarely folds, plays the long game",
    walletAddress: "",
  },
  {
    name: "Qwen",
    model: "qwen/qwen2.5-72b-instruct",
    personality: "conservative and tight, only plays premium hands",
    walletAddress: "",
  },
]

export async function getAgentAction(
  agent: Agent,
  gameState: GameState
): Promise<AgentAction> {
  const prompt = buildPrompt(gameState)

  try {
    const response = await nvidia.chat.completions.create({
      model: agent.model,
      messages: [
        {
          role: "system",
          content: `You are ${agent.name}, playing Texas Hold'em poker with real money at stake.
Your personality: ${agent.personality}
Respond ONLY with valid JSON in this exact format, nothing else:
{ "action": "fold" | "call" | "raise", "amount": number, "message": "string" }
- amount: chips to raise by (0 if fold or call)
- message: your in-character reaction (max 15 words)`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 100,
    })

    const text = response.choices[0].message.content ?? ""
    return JSON.parse(text) as AgentAction

  } catch {
    // fallback — always safe to fold
    return { action: "fold", amount: 0, message: "I'll sit this one out." }
  }
}

function buildPrompt(gs: GameState): string {
  return `
Your hole cards: ${gs.holeCards.join(", ")}
Community cards: ${gs.communityCards.length ? gs.communityCards.join(", ") : "none yet"}
Pot: ${gs.pot} chips
Your stack: ${gs.myStack} chips
Amount to call: ${gs.callAmount} chips (0 = free check)
Other players this round: ${gs.otherActions.join(" | ") || "none yet"}

What is your action?
`.trim()
}
```

**Test it works:**
```ts
// add a test call at the bottom, run with: npx tsx lib/nvidia.ts
const testState: GameState = {
  agentName: "Llama",
  holeCards: ["Ad", "Ks"],
  communityCards: ["7h", "2c", "Jd"],
  pot: 300,
  myStack: 9700,
  callAmount: 100,
  otherActions: ["Mistral raised 100"],
}

getAgentAction(AGENTS[0], testState).then(console.log)
// expected: { action: "call", amount: 0, message: "..." }
```

---

## Step 3 — OWS Wallets `[FRIEND]`

Create `lib/ows.ts`:

**What it does:** Creates one OWS wallet per agent at game start. Reads balances. OWS is mandatory for judging.

```ts
// lib/ows.ts
// Install: npm install @open-wallet-standard/core
import { AgentName, Wallet } from "./types"

// TODO: replace with actual OWS SDK calls once you check the docs at:
// https://github.com/open-wallet-standard  (npm: @open-wallet-standard/core)

export async function createAgentWallet(agentName: AgentName): Promise<Wallet> {
  // OWS SDK: create a new wallet
  // const wallet = await ows.createWallet({ label: agentName })
  // return { address: wallet.address, agentName }

  // placeholder until OWS SDK is confirmed:
  return {
    address: `0x${agentName.toLowerCase()}${Date.now()}`,
    agentName,
  }
}

export async function fundWallet(address: string, amountUsdc: number): Promise<void> {
  // OWS SDK: fund wallet with USDC
  // await ows.fund({ address, amount: amountUsdc, token: "USDC" })
  console.log(`Funded ${address} with $${amountUsdc}`)
}

export async function getBalance(address: string): Promise<number> {
  // OWS SDK: read wallet balance
  // const balance = await ows.getBalance({ address, token: "USDC" })
  // return balance
  return 10.00  // placeholder
}

export async function setupAllWallets(
  agentNames: AgentName[],
  startingBalanceUsdc: number
): Promise<Record<AgentName, Wallet>> {
  const wallets: Partial<Record<AgentName, Wallet>> = {}

  for (const name of agentNames) {
    const wallet = await createAgentWallet(name)
    await fundWallet(wallet.address, startingBalanceUsdc)
    wallets[name] = wallet
    console.log(`Wallet created for ${name}: ${wallet.address}`)
  }

  return wallets as Record<AgentName, Wallet>
}
```

**Note:** OWS SDK docs may differ — check `@open-wallet-standard/core` on npm and fill in real calls. The function signatures must stay the same so my side doesn't break.

---

## Step 4 — x402 Bet Settlement `[FRIEND]`

Create `lib/x402.ts`:

**What it does:** Moves USDC between wallets when agents bet. Called after every valid poker action.

```ts
// lib/x402.ts
// x402 is a payment protocol — each bet is an HTTP micropayment
// Docs: https://x402.org  or check the OWS hackathon resources

import { TxHash } from "./types"

export async function settleBet(
  fromAddress: string,
  toAddress: string,
  amountCents: number     // in cents, e.g. 50 = $0.50
): Promise<TxHash> {
  // x402 payment: fromAddress pays toAddress
  // const tx = await x402.pay({
  //   from: fromAddress,
  //   to: toAddress,
  //   amount: amountCents / 100,
  //   token: "USDC",
  // })
  // return tx.hash

  // placeholder log until x402 SDK is wired:
  const hash = `0xtx_${Date.now()}`
  console.log(`x402: ${fromAddress} → ${toAddress} | $${amountCents / 100} | ${hash}`)
  return hash
}

export async function distributeWinnings(
  potAddress: string,
  winnerAddress: string,
  totalPotCents: number
): Promise<TxHash> {
  return settleBet(potAddress, winnerAddress, totalPotCents)
}
```

---

## How Our Code Connects

When both branches are ready, we merge and I wire it in `game-manager.ts` like this:

```ts
import { AGENTS, getAgentAction } from "./lib/nvidia"    // your file
import { setupAllWallets, getBalance } from "./lib/ows"  // your file
import { settleBet, distributeWinnings } from "./lib/x402" // your file
import { createTable, applyAction } from "./lib/poker"    // my file

// This is how your functions get called:
// 1. Game starts → setupAllWallets(agentNames, 10.00)
// 2. Agent's turn → getAgentAction(agent, gameState)
// 3. Agent bets   → settleBet(agentWallet, potWallet, amount)
// 4. Hand ends    → distributeWinnings(potWallet, winnerWallet, pot)
```

---

## When You're Done

1. Push your branch:
```bash
git add lib/types.ts lib/nvidia.ts lib/ows.ts lib/x402.ts
git commit -m "feat: agent decisions, OWS wallets, x402 settlement"
git push origin feat/agent-wallet
```

2. Open a PR → `main`
3. Message me — I'll merge and wire the game loop

---

## Your Checklist

- [ ] Clone repo + checkout `feat/agent-wallet`
- [ ] `npm install openai @open-wallet-standard/core`
- [ ] Add `NVIDIA_API_KEY` to `.env.local`
- [ ] Create `lib/types.ts` with shared types
- [ ] Create `lib/nvidia.ts` — test one agent decision works
- [ ] Create `lib/ows.ts` — test wallet creation + balance read
- [ ] Create `lib/x402.ts` — test one bet settlement logs correctly
- [ ] Push branch + open PR

---

## Questions?

Check `PROJECT.md` for full architecture and `CHECKLIST.md` for the overall build plan.
The function signatures in `lib/types.ts` are the contract between our code — don't change them without telling me.
