# Single Agent Selection — Design Spec

**Date:** 2026-04-04
**Branch:** feat/M/ui-redesign
**Owner:** M (UI + Engine)

---

## Problem

The agents page currently allows multi-select (min 2 agents). The intended UX is: the user picks **one agent as their character**, the other 3 auto-fill as AI opponents.

## Solution Overview

- Refactor agents page from multi-select to single-select character picker
- Add a `SelectedAgentProvider` React context for persistent state across all dashboard pages
- Add a persistent `AgentStatusBar` in the top-right corner showing the selected agent's model, wallet address, and balances
- Provide a full chat modal for test-chatting the selected agent before committing

---

## 1. Data Model & Context

### AgentIdentity

```ts
interface AgentIdentity {
  index: number                    // 0-3
  name: AgentName                  // "Llama" | "Mistral" | "Nemotron" | "Qwen"
  modelId: string                  // default free model, switchable
  apiKey?: string                  // required for premium models
  walletAddress: string            // hardcoded OWS wallet
  balances: { usdc: string; eth: string } | null
}
```

### SelectedAgentContext

```ts
interface SelectedAgentContext {
  selectedAgent: AgentIdentity | null
  selectAgent: (index: number) => void
  updateModel: (modelId: string, apiKey?: string) => void
  clearAgent: () => void
}
```

### Predefined Agents

| Index | Name     | Default Model                              | Wallet Address                             |
|-------|----------|--------------------------------------------|--------------------------------------------|
| 0     | Llama    | meta/llama-3.3-70b-instruct                | 0x51dA09aB2EF760314a489D35b8207657cF471284 |
| 1     | Mistral  | mistralai/mistral-small-4-119b-2603        | 0x2F445DB3961E33d6500537Cd796b4812CBf7Db6b |
| 2     | Nemotron | nvidia/llama-3.3-nemotron-super-49b-v1     | 0x765A6824A400f714a59d99FbF4A04C252A5E328e |
| 3     | Qwen     | meta/llama-3.1-8b-instruct                 | 0xcA10A9910b62979eDA09A92CB78720fF67ffdb00 |

- Each agent starts with its default free model
- User can switch to any free or premium model (Gemini 2.5 Flash, Claude Sonnet, GPT-4o) via dropdown
- Premium models require API key input
- Balances fetched from `/api/balance?address={wallet}`, polled every 30s in the provider

---

## 2. Agents Page UI

### Character Selection Cards

- 4 cards in a row, each representing a character
- Each card displays:
  - Agent name + avatar/color
  - Default model name + provider
  - Wallet address (truncated) with copy button
  - USDC + ETH balances (live-fetched)
- **Single-click to select** — selected card gets highlighted border/glow, others dim
- Clicking already-selected card deselects it

### Expanded Controls (selected card only)

- Model dropdown (Free + Premium optgroups)
- API key input (shown only for premium models)
- "Test Chat" button — opens full chat modal

### Chat Modal

- Full back-and-forth conversation with the agent's model
- Shows response time per message
- User can gauge intelligence/speed before committing
- Uses existing `/api/test-agent` endpoint (extended for multi-turn)

---

## 3. Persistent AgentStatusBar

### Position

Top-right corner of dashboard layout, visible on all pages (agents, skills, lobby, game).

### Content — Agent Selected

- Agent name + colored dot/avatar
- Model name (e.g. "Llama 3.3" or "Gemini 2.5 Flash")
- Wallet address (truncated, e.g. `0x51dA...1284`) + copy icon
- USDC balance + ETH balance (live from provider)

### Content — No Agent Selected

- Muted text: "No agent selected"

### Behavior

- Clicking navigates back to `/agents` for quick switch
- Balances shared with provider (no duplicate polling)
- Sonner toast on first selection: "Wallet allocated for [Agent Name]"

---

## 4. Navigation & Integration

### Skills Page

- Shows context: "Choose strategy for **[Agent Name]**"
- Strategy assignment tied to selected agent in context

### Navigation Guard

- Soft guard — user can navigate freely
- If user reaches skills/lobby without agent selected: sonner toast "Pick your agent first"

### Opponent Auto-Fill

- The 3 unselected agents auto-fill as AI opponents
- They use their default free models
- They get a random strategy from predefined skills (or default to TAG)

### Game Page Integration

- Selected agent gets `isUser: true` flag via `configureAgents` socket emit
- Other 3 are AI opponents with `isUser: false`

---

## 5. Component Tree

```
(dashboard)/layout.tsx
  SelectedAgentProvider          <-- NEW
    Sidebar
    AgentStatusBar               <-- NEW (top-right)
    {children}
      agents/page.tsx            <-- REFACTORED (single-select)
      skills/page.tsx            <-- UPDATED (reads context)
      lobby/page.tsx             <-- UPDATED (reads context)
```

### New Files

- `src/providers/selected-agent-provider.tsx` — context + provider
- `src/components/agent-status-bar.tsx` — persistent top-right display

### Modified Files

- `src/app/(dashboard)/layout.tsx` — wrap with provider, add status bar
- `src/app/(dashboard)/agents/page.tsx` — single-select refactor
- `src/app/(dashboard)/skills/page.tsx` — read selected agent for context
- `src/components/chat-modal.tsx` — support multi-turn test chat

---

## 6. Non-Goals

- No changes to the poker engine or server
- No changes to the game page agent rendering (uses existing AgentState)
- No new wallet creation flow (hardcoded wallets persist)
- No premium model billing or validation beyond API key input
