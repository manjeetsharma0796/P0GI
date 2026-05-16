# TODO.md — Shared Task Board

> Read CLAUDE.md before starting any work.
> Update this file before every `git push`.
> STATUS: `TODO` | `IN_PROGRESS` | `DONE` | `BLOCKED`

---

## Last Updated
- **By:** J
- **At:** 2026-04-04
- **Branch:** main

---

## Who Does What

| Person | Branch | Module | Status |
|--------|--------|--------|--------|
| **J** | `feat/J/ui` | Frontend UI + Socket client | ✅ Done |
| **M** | `feat/M/*` | Engine + server + integration + OWS + UI redesign | ✅ Done |
| **P** | `feat/P/agent-wallet` | NVIDIA agents + OWS wallets + x402 | ✅ Done |

---

## J — Frontend UI `✅ Complete`

| # | Task | Status |
|---|------|--------|
| J1–J16 | All UI tasks (agents, skills, lobby, game pages, socket hook, providers) | `DONE` |
| J17 | Dealer table image (dealerTable.png) in game screen | `DONE` |
| J18 | AI agent photo avatars (1-4.png) — circular, face-focused crop | `DONE` |
| J19 | Integrated M's FlippableCard, CardDealAnimation, ProbabilityBoard | `DONE` |
| J20 | Speech bubbles for agent trash-talk | `DONE` |
| J21 | Showdown glow effects (winner/strong/bluff) | `DONE` |
| J22 | Deal Next Hand button + waitingForDeal state | `DONE` |

---

## M — Engine + Server + Integration `✅ Complete`

| # | Task | Status | Notes |
|---|------|--------|-------|
| M1 | Init project with bun + Next.js | `DONE` | |
| M2 | Install all deps | `DONE` | holdem-poker, pokersolver, openai, socket.io, x402, OWS |
| M3 | Shared types (modules/shared/types.ts) | `DONE` | Agent now includes skillId |
| M4–M9 | Poker engine (modules/engine/poker.ts) | `DONE` | holdem-poker + pokersolver |
| M10–M12 | Game manager (modules/engine/game-manager.ts) | `DONE` | Full loop with mock + real agents |
| M13–M15 | Socket.io server (server/index.ts) | `DONE` | Port 3001, emits all game events |
| M16 | Wire real NVIDIA agents | `DONE` | Auto-detects NVIDIA_API_KEY |
| M17 | Wire real x402 payments | `DONE` | Simulated + on-chain modes |
| M18 | Live integration test (5 hands, real LLMs) | `DONE` | Mistral Maniac won 4/5 hands |
| M19 | 5 poker skills (TAG, LAG, Rock, GTO, Maniac) | `DONE` | Deep strategy prompts |
| M20 | OWS wallet integration | `DONE` | Real OWS encrypted vault via CLI |
| M21 | Wallet persistence (file-backed) | `DONE` | data/wallets.json |
| M22 | Ethereum Sepolia chain config | `DONE` | Chain 11155111, USDC 0x1c7D... |
| M23 | ETH distribution script | `DONE` | scripts/fund-wallets.ts |
| M24 | Session logging (data/session-log.txt) | `DONE` | scripts/play-session.ts |
| M25 | UI redesign — agents page | `DONE` | Free NVIDIA + premium models, OWS wallet display |
| M26 | UI redesign — skills page | `DONE` | 5 skills + custom prompt |
| M27 | UI redesign — lobby page | `DONE` | Rooms, join/spectate, create room |
| M28 | UI redesign — game page | `DONE` | Green felt table, dealer, action log, live chat |
| M29 | Socket → UI wiring (use-game.ts hook) | `DONE` | Real-time event mapping |
| M30 | RUN.md documentation | `DONE` | Full setup + run guide |

---

## P — Agents + Wallets + Payments `✅ Complete`

| # | Task | Status | Notes |
|---|------|--------|-------|
| P1–P3 | Setup + deps + env | `DONE` | |
| P4–P7 | modules/agent/nvidia.ts | `DONE` | 4 NVIDIA models, JSON fallback |
| P8–P13 | modules/agent/ows.ts | `DONE` | Switched to real OWS CLI |
| P14–P17 | modules/agent/x402.ts | `DONE` | Live + simulated modes |
| P18 | PR merged | `DONE` | |

---

## Additional Work Done (beyond original checklist)

| Feature | Who | Notes |
|---------|-----|-------|
| 5 poker skills system | M | TAG, LAG, Rock, GTO, Maniac — deep strategy prompts |
| Real OWS wallet integration | M | ows wallet create via CLI, encrypted AES-256-GCM vault |
| OWS policy engine | M | Sepolia-only chain allowlist, $10/tx spending limit |
| NVIDIA model fix | M | Swapped broken model IDs for 4 verified working ones |
| Wallet persistence | M | File-backed storage survives process restarts |
| On-chain ETH transfer | M | scripts/fund-wallets.ts sends ETH between wallets |
| Session logging | M | Full game log to data/session-log.txt |
| UI complete redesign | M | Agents (free/premium), lobby (rooms), game (felt table) |
| Socket → UI integration | M | use-game.ts hook maps real events to components |

---

## OWS Wallets (Ethereum Sepolia)

| Agent | OWS Wallet Address | Vault Status |
|-------|-------------------|-------------|
| 🦈 Llama | `0x51dA09aB2EF760314a489D35b8207657cF471284` | ✓ encrypted |
| 🃏 Mistral | `0x2F445DB3961E33d6500537Cd796b4812CBf7Db6b` | ✓ encrypted |
| 🧮 DeepSeek | `0x765A6824A400f714a59d99FbF4A04C252A5E328e` | ✓ encrypted |
| 🔥 Qwen | `0xcA10A9910b62979eDA09A92CB78720fF67ffdb00` | ✓ encrypted |
| 🏦 Pot | `0xaD2390a2C25cAF161A61d7cCD0Cd197F1130e8E8` | ✓ encrypted |

---

## Open PRs

| PR | Branch | Status |
|----|--------|--------|
| Socket.io server | `feat/M/socket-server` | Ready to merge |
| Real agents + wallets + x402 | `feat/M/wire-real-agents` | Ready to merge |
| Wallet persistence + skills | `feat/M/wallet-persistence` | Ready to merge |
| Full integration (OWS + Sepolia) | `feat/M/full-integration` | Ready to merge |
| UI redesign | `feat/M/ui-redesign` | Ready to merge |
