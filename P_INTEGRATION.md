# P Module — Integration Guide for M and J

> **Branch:** `feat/P/agent-wallet`
> **Module:** `modules/agent/`
> **Status:** All P tasks (P1–P17) complete. Ready to wire.

---

## Files Delivered

```
modules/agent/
├── nvidia.ts    ← AI agent decisions (NVIDIA LLM API)
├── ows.ts       ← Wallet creation + balance reading (viem on Base)
└── x402.ts      ← Bet settlement + payout (x402 SDK + simulated mode)
```

---

## For M — Wiring into `game-manager.ts`

### 1. Import P's modules (replaces mocks)

```ts
// ❌ OLD (mocks)
import { getMockAgentAction } from "../../mocks/agents"
import { mockSettleBet, mockDistributeWinnings } from "../../mocks/transactions"

// ✅ NEW (real)
import { AGENTS, getAgentAction } from "../agent/nvidia"
import { setupAllWallets, getBalance, createPotWallet } from "../agent/ows"
import { settleBet, distributeWinnings, initSimulatedBalances } from "../agent/x402"
```

### 2. Game start — create wallets

```ts
// At game init, create wallets for all agents + pot
const wallets = await setupAllWallets(["Llama", "Mistral", "DeepSeek", "Qwen"], 10.0)
const potWallet = await createPotWallet()

// Assign wallet addresses to AGENTS array
for (const agent of AGENTS) {
  agent.walletAddress = wallets[agent.name].address
}

// Init simulated balances for demo mode (skip if X402_LIVE=true)
const allAddresses = Object.values(wallets).map(w => w.address)
allAddresses.push(potWallet.address)
initSimulatedBalances(allAddresses, 1000) // 1000 cents = $10.00
```

### 3. Agent's turn — get decision

```ts
// Build gameState from your engine's current state
const gameState: GameState = {
  agentName: currentAgent.name,
  holeCards: ["Ad", "Ks"],           // from your engine
  communityCards: ["7h", "2c", "Jd"], // from your engine
  pot: currentPot,                    // in cents
  myStack: agentStack,               // in cents
  callAmount: amountToCall,           // in cents
  otherActions: ["Llama raised 100"], // from your action log
}

const action = await getAgentAction(currentAgent, gameState)
// Returns: { action: "call"|"raise"|"fold", amount: number, message: string }
```

### 4. Agent bets — settle payment

```ts
// After a valid call/raise action
if (action.action === "call" || action.action === "raise") {
  const betAmount = action.action === "call" ? callAmount : action.amount
  const txHash = await settleBet(
    currentAgent.walletAddress,  // from
    potWallet.address,           // to (pot)
    betAmount                    // cents
  )
  // txHash is a string — emit it in GameEvent for UI
}
```

### 5. Hand ends — distribute winnings

```ts
// After showdown, pay the winner
const txHash = await distributeWinnings(
  potWallet.address,       // from (pot)
  winnerAgent.walletAddress, // to (winner)
  totalPotCents              // total pot in cents
)
```

---

## For J — Wallet Balances in UI

### Replace mock wallet data

```ts
// ❌ OLD
import { getMockBalance, MOCK_WALLETS } from "../../mocks/wallets"

// ✅ NEW — get real wallet addresses from socket events
// M will emit wallet addresses + balances in GameEvent.stacks
```

### What you'll receive via Socket

M will emit `GameEvent` objects. The relevant fields for you:

```ts
interface GameEvent {
  type: "action" | "deal" | "showdown" | "payout" | "game_over"
  stacks?: Record<AgentName, number>  // current balance per agent (cents)
  agentName?: AgentName
  action?: AgentAction                // includes .message for trash talk bubble
  txHash?: TxHash                     // show this in the UI for transparency
  // ... other fields
}
```

You don't need to import P's modules directly — M pipes everything through socket events.

---

## Function Signatures (contract)

These signatures are stable. Do not change without coordinating.

### nvidia.ts

```ts
getAgentAction(agent: Agent, gameState: GameState): Promise<AgentAction>
// - Calls NVIDIA LLM API for the agent's model
// - Returns { action, amount, message }
// - Falls back to fold on any error

AGENTS: Agent[]
// - Array of 4 agents with name, model, personality
// - walletAddress is "" until setupAllWallets() is called
```

### ows.ts

```ts
createAgentWallet(agentName: AgentName): Promise<Wallet>
// - Generates a real ETH keypair (EOA on Base)
// - Returns { address, agentName }

fundWallet(address: string, amountUsdc: number): Promise<void>
// - Placeholder for now (logs funding)
// - In production: transfers USDC from master wallet

getBalance(address: string): Promise<number>
// - Reads USDC balance on Base chain (in cents)
// - Returns 0 if RPC fails (safe fallback)

setupAllWallets(agentNames: AgentName[], startingBalanceUsdc: number): Promise<Record<AgentName, Wallet>>
// - Creates + funds wallets for all agents
// - Returns a map: { Llama: Wallet, Mistral: Wallet, ... }

createPotWallet(): Promise<Wallet>
// - Creates a separate wallet for the game pot

getAgentPrivateKey(address: string): `0x${string}` | undefined
// - Returns stored private key for an address (used internally by x402.ts)
```

### x402.ts

```ts
settleBet(fromAddress: string, toAddress: string, amountCents: number): Promise<TxHash>
// - Transfers USDC between wallets
// - Live mode (X402_LIVE=true): on-chain USDC transfer via viem
// - Demo mode (default): simulated in-memory transfer

distributeWinnings(potAddress: string, winnerAddress: string, totalPotCents: number): Promise<TxHash>
// - Pays out the pot to the winner (delegates to settleBet)

initSimulatedBalances(addresses: string[], startingCents: number): void
// - Call at game start in demo mode to set starting balances

getSimulatedBalance(address: string): number
// - Returns simulated balance (demo mode only)
```

---

## Modes

| Mode | Env Var | Behavior |
|------|---------|----------|
| **Demo** (default) | — | Wallets are real addresses, balances tracked in memory, no gas needed |
| **Live** | `X402_LIVE=true` | On-chain USDC transfers on Base, requires funded wallets with gas ETH |

For the hackathon demo, use **demo mode**. Switch to live once wallets are funded.

---

## Dependencies Installed

```
openai          — NVIDIA API (OpenAI-compatible)
viem            — Ethereum wallet + contract interaction
@x402/core      — x402 payment protocol core
@x402/evm       — x402 EVM implementation (EIP-3009 signing)
@x402/fetch     — x402-enabled fetch wrapper
dotenv          — env var loading
```

---

## Quick Test Commands

```bash
bun run modules/agent/nvidia.ts    # test agent decisions (needs NVIDIA_API_KEY)
bun run modules/agent/ows.ts       # test wallet creation (works offline)
bun run modules/agent/x402.ts      # test bet settlement (works offline, demo mode)
```

---

## Checklist for M After Merge

- [ ] Import `AGENTS`, `getAgentAction` from `modules/agent/nvidia`
- [ ] Import `setupAllWallets`, `createPotWallet` from `modules/agent/ows`
- [ ] Import `settleBet`, `distributeWinnings`, `initSimulatedBalances` from `modules/agent/x402`
- [ ] Call `setupAllWallets()` at game start
- [ ] Call `getAgentAction()` on each agent's turn (replaces `getMockAgentAction`)
- [ ] Call `settleBet()` after each valid bet/call/raise
- [ ] Call `distributeWinnings()` after showdown
- [ ] Emit `txHash` in `GameEvent` so J can display it
- [ ] Remove mock imports from `game-manager.ts`
- [ ] Update `TODO.md` — mark M16, M17 as `DONE`
