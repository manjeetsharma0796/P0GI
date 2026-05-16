# CLAUDE.md — P0GI (0G Network)

> Every Claude Code session on this project MUST read this file first.

---

## Package Manager — BUN ONLY

**Always use `bun`, never npm or yarn.**

```bash
bun install              # install deps
bun add <package>        # add a package
bun run dev              # start Next.js frontend
bun run server           # start 0G game server
bun run build            # build
bunx <tool>              # run a binary (replaces npx)
```

---

## Network — 0G GALILEO TESTNET ONLY

```
Chain ID:  16602
RPC:       https://evmrpc-testnet.0g.ai
Explorer:  https://chainscan-galileo.0g.ai
Token:     A0GI (native)
Faucet:    https://faucet.0g.ai
```

No real money. Testnet A0GI only.

---

## Architecture

```
src/app/          → Next.js frontend (UI, game page, API routes)
0g/server/        → Socket.io game server (bun run server)
0g/compute/       → AI inference via 0G Compute
0g/engine/        → Game loop + hand management
0g/chain/         → On-chain settlement (AgentBetGame.sol on 0G testnet)
0g/storage/       → Game history logging to 0G Storage
0g/sealed-inference/ → TEE-verified inference module
modules/engine/   → Poker engine (@chevtek/poker-engine wrapper)
modules/agent/    → Agent skill definitions
modules/shared/   → Shared TypeScript types
```

---

## Running the Project

Two terminals needed:

```bash
# Terminal 1 — Game server (AI + chain)
bun run server

# Terminal 2 — Frontend
bun run dev
```

Open http://localhost:3000

---

## Key Files

| File | Purpose |
|------|---------|
| `0g/compute/0g-compute.ts` | AI inference via 0G Compute |
| `0g/engine/0g-game-manager.ts` | Full game loop, settlement, storage |
| `0g/chain/0g-settlement.ts` | ERC20 CHIP token transfers on-chain |
| `0g/chain/0g-chain.ts` | AgentBetGame contract interaction |
| `0g/server/0g-server.ts` | Socket.io server entry point |
| `.env.local` | All secrets (never commit) |

---

## Env Variables

`.env.local` (never commit):
```env
NVIDIA_API_KEY=              # 0G Compute inference API key
ZG_API_KEY=                  # 0G Compute API key
ZG_PRIVATE_KEY=              # Funded wallet for gas + settlement
ZG_RPC_URL=https://evmrpc-testnet.0g.ai
ZG_CONTRACT_ADDRESS=         # Deployed AgentBetGame.sol
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

---

## Git Workflow

```bash
# Commit format
git commit -m "feat(0g-compute): dynamic model discovery"
git commit -m "fix(settlement): handle insufficient gas"
git commit -m "chore: remove stale Base Sepolia artifacts"
```
