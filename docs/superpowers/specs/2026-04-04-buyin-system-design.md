# Buy-in System — Design Spec

**Date:** 2026-04-04
**Branch:** feat/M/ui-redesign
**Owner:** M (UI + Engine)

---

## Problem

Agents currently buy in with their full USDC wallet balance. Users have no control over how much their agent risks per session. When an agent runs out mid-game, settlements fail on-chain.

## Solution Overview

- Show a buy-in slider modal when entering the game page, before the game can start
- User sets how much USDC their agent brings to the table (min = big blind $0.20, max = wallet balance)
- AI opponents auto buy-in with their full wallet balance
- When user's agent runs out, show a re-buy modal with 30s timeout
- If timeout expires, agent force-folds every remaining hand

---

## 1. Buy-in Modal

**`BuyInModal`** appears automatically on game page entry.

- Overlay modal, dark theme matching project style
- Shows selected agent's name, avatar, current USDC wallet balance
- Slider: min = $0.20 (big blind), max = agent's real USDC balance, step = $0.10
- Numeric display updates live with slider
- "Confirm Buy-in" button sends amount and enables game start
- "Start Game" button hidden until buy-in confirmed
- Zero balance state: "Your agent has no funds. Fund wallet first." with copyable wallet address

---

## 2. Re-buy Modal

**`RebuyModal`** appears when user's agent stack hits 0 during gameplay.

- Same overlay style as BuyInModal
- Header: "Your agent is out of chips!"
- 30-second countdown timer, visible and ticking
- Options:
  - **"Fund & Re-buy"**: shows wallet address with copy, "Check Balance" button refreshes balance and re-enables slider if funds arrived
  - **"Leave Game"**: navigates to lobby
- Timer hits 0: modal auto-closes, agent enters force-fold state
- Force-fold persists until game ends (no second chances after timeout)

---

## 3. Game Flow Integration

### Socket/Server

- `start_game` event payload: `{ buyInCents: number }`
- Game manager uses `buyInCents` as user's agent stack
- Other 3 agents use full USDC wallet balance as stack
- Server emits `"buyin_depleted"` event when user's agent stack reaches 0
- Client sends `"rebuy"` with `{ amount: number }` on re-buy; server updates stack
- Client sends `"rebuy_timeout"` on timeout; server marks agent as force-fold only

### Display

- Agent seat card: "Buy-in: $X.XX" below current stack
- Status bar: buy-in amount after balances (e.g. "6.01 USDC | Buy-in: $2.00")
- Force-fold state: seat card shows "Folding" in red

### Game Page State

- `buyInConfirmed: boolean` — gates "Start Game" visibility
- `buyInAmount: number` — confirmed buy-in cents
- `needsRebuy: boolean` — triggers RebuyModal
- `forceFolding: boolean` — post-timeout, agent auto-folds

---

## 4. Files

### New Files

- `src/components/game/buyin-modal.tsx` — Buy-in slider modal
- `src/components/game/rebuy-modal.tsx` — Re-buy with countdown

### Modified Files

- `src/app/game/[id]/page.tsx` — Modal states, gate Start Game, buy-in in seat cards
- `src/hooks/use-game.ts` — Pass buyInCents on start, handle buyin_depleted/rebuy events, forceFolding state
- `src/components/agent-status-bar.tsx` — Show buy-in amount
- `server/index.ts` — Accept buyInCents in start_game, emit buyin_depleted, handle rebuy/rebuy_timeout
- `modules/engine/game-manager.ts` — Custom stack for user agent, detect zero stack, support rebuy

---

## 5. Non-Goals

- No buy-in selection for AI opponents (they use full balance)
- No multi-rebuy (one timeout = permanent force-fold)
- No changes to x402 settlement logic (balance guard already exists)
