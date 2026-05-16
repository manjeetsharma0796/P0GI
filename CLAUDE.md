# CLAUDE.md — Agent Poker Project Instructions

> Every Claude Code session on this project MUST read this file first.

---

## Package Manager — BUN ONLY

**Always use `bun`, never npm or yarn.**

```bash
bun install              # install deps
bun add <package>        # add a package
bun run dev              # start dev server
bun run build            # build
bunx <tool>              # run a binary (replaces npx)
```

If you see `npm install` anywhere — replace it with `bun add`.

---

## Network — TESTNET ONLY

**Always use Base Sepolia. Never mainnet.**

```
Chain ID:  84532
RPC:       https://sepolia.base.org
Explorer:  https://sepolia.basescan.org
USDC:      0x036CbD53842c5426634e7929541eC2318f3dCF7e  (Base Sepolia)
Faucet:    https://portal.cdp.coinbase.com/products/faucet
```

No real money. Test USDC only.

---

## First Thing Every Session

1. `git pull origin main` — sync latest
2. Read `TODO.md` — check your assigned tasks and their status
3. Check if any task is marked `BLOCKED` — unblock before starting new work
4. After finishing any task — update `TODO.md` status immediately
5. Before every `git push` — update `TODO.md` with current status

---

## Module Ownership (no conflicts)

| Module | Owner | Directory |
|--------|-------|-----------|
| Poker Engine + Game Loop | **M** | `modules/engine/` |
| UI + Frontend | **J** | `src/app/` |
| AI Agent Decisions (NVIDIA) | **P** | `modules/agent/` |
| OWS Wallets + x402 Payments | **P** | `modules/agent/` |
| Shared Types + Mock Data | **Everyone** | `modules/shared/` + `mocks/` |
| Server | **M** | `server/` |

---

## Mock Data for Integration

When your module is not ready, **always use mocks** so other modules don't get blocked.

Mock files live in `mocks/`. Every real function must have a corresponding mock.

```ts
// Use mock until real implementation is ready:
import { getMockAgentAction } from "../../mocks/agents"
// import { getAgentAction } from "../agent/nvidia"  // swap when P merges
```

When you replace a mock → update `TODO.md` MOCK column to `REAL`.

---

## When Stuck (3+ attempts on same issue)

Use **Context7** MCP to get up-to-date docs:
```
/context7
```

Use it for: OWS SDK, x402 payment flow, @chevtek/poker-engine, NVIDIA API quirks.
After resolving — add a comment in the code explaining the fix.

---

## Git Workflow

```bash
git checkout -b feat/<person>/<feature>
# e.g. feat/M/engine  |  feat/J/ui  |  feat/P/agent-wallet

# Commit format
git commit -m "feat(engine): poker table init with 4 agents"
git commit -m "mock(wallets): add testnet wallet addresses"
git commit -m "fix(nvidia): fallback to fold on invalid JSON"

# Update TODO.md before pushing
git push origin feat/<person>/<feature>
# Open PR → main
```

---

## Project Stack

```
Runtime:    Bun
Frontend:   Next.js 16 + Tailwind + TypeScript
Backend:    Bun server + Socket.io
Network:    Base Sepolia testnet (chain 84532)
LLM:        NVIDIA free API (OpenAI-compatible)
Wallets:    OWS SDK
Payments:   x402 (@x402/core @x402/evm @x402/fetch)
Types:      modules/shared/types.ts (source of truth)
```

---

## Env Variables

`.env.local` (never commit):
```env
NVIDIA_API_KEY=
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```
