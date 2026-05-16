# How to Run Agent Poker Night

---

## Prerequisites

- [Bun](https://bun.sh) installed
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- NVIDIA API key from [build.nvidia.com](https://build.nvidia.com) (free)
- Sepolia ETH + USDC in agent wallets (for on-chain mode)

---

## 1. Clone & Install

```bash
git clone git@github.com:manjeetsharma0796/agent-poker.git
cd agent-poker
bun install
```

---

## 2. Environment Variables

Copy and fill in `.env.local`:

```bash
cp .env.example .env.local
```

```env
NVIDIA_API_KEY=nvapi-xxxxx          # from build.nvidia.com
NEXT_PUBLIC_CHAIN_ID=11155111       # Ethereum Sepolia
NEXT_PUBLIC_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
X402_LIVE=true                      # real on-chain USDC settlements
```

---

## 3. Setup OWS Docker (first time only)

One command sets up everything — Docker image, container, encrypted wallets:

```bash
bash scripts/setup-docker-ows.sh
```

This will:
1. Check Docker is running
2. Build the OWS Docker image (`ows-poker`)
3. Start the `ows-agent-poker` container
4. Create 5 encrypted wallets (Llama, Mistral, DeepSeek/Nemotron, Qwen, Pot)
5. Print all EVM addresses for funding

To verify it worked:
```bash
docker exec ows-agent-poker ows wallet list
docker exec ows-agent-poker ows --version
```

---

## 4. Fund Wallets (Ethereum Sepolia)

This creates encrypted wallets in the OWS vault (`~/.ows/`):

```bash
echo 'bash /mnt/c/workspace/claude-adding-skill/poker-night-ai/scripts/setup-ows.sh' | wsl
```

**Wallets created (Ethereum Sepolia):**

| Agent | Address |
|-------|---------|
| 🦈 Llama | `0x51dA09aB2EF760314a489D35b8207657cF471284` |
| 🃏 Mistral | `0x2F445DB3961E33d6500537Cd796b4812CBf7Db6b` |
| 🧮 DeepSeek | `0x765A6824A400f714a59d99FbF4A04C252A5E328e` |
| 🔥 Qwen | `0xcA10A9910b62979eDA09A92CB78720fF67ffdb00` |
| 🏦 Pot | `0xaD2390a2C25cAF161A61d7cCD0Cd197F1130e8E8` |

To verify wallets exist:
```bash
echo '/home/manjeet0796/.ows/bin/ows wallet list' | wsl
```

---

## 4. Fund Wallets (Ethereum Sepolia)

Each agent wallet needs:
- **~0.01 Sepolia ETH** for gas
- **USDC** for bets (optional — simulated mode works without it)

Faucets:
- ETH: https://www.alchemy.com/faucets/ethereum-sepolia
- USDC: Transfer from any Sepolia wallet

To distribute ETH from Llama to others (after funding Llama):
```bash
bun run scripts/fund-wallets.ts
```

---

## 5. Run the App

### Option A — Full app (UI + server)

Open **two terminals**:

**Terminal 1 — Socket.io game server:**
```bash
bun run server
```
You should see:
```
🃏 Agent Poker server running on http://localhost:3001
```

**Terminal 2 — Next.js frontend:**
```bash
bun run dev
```
You should see:
```
▲ Next.js 16.x
- Local: http://localhost:3000
```

**Browser:** Open `http://localhost:3000/game/1` → Click **Start Game**

---

### Option B — Terminal only (no UI)

Run a poker session directly in terminal with full logging:
```bash
bun run scripts/play-session.ts
```

Output saved to `data/session-log.txt`.

---

### Option C — Quick test (3 hands)

```bash
bun run modules/engine/game-manager.test.ts
```

---

## 6. What Happens When You Click "Start Game"

```
Browser clicks Start Game
    ↓
Socket.io sends "start_game" to server (port 3001)
    ↓
Game Manager creates poker table (4 agents)
    ↓
For each hand:
  ├── Deal cards (holdem-poker engine)
  ├── For each agent's turn:
  │   ├── Send game state to NVIDIA API (real LLM)
  │   ├── LLM returns { action, amount, message }
  │   ├── Apply action to poker engine
  │   ├── Settle bet via x402 (simulated or on-chain)
  │   └── Emit event via Socket.io → UI updates
  ├── Showdown → pokersolver evaluates winner
  └── Payout via x402 → winner's OWS wallet
    ↓
UI shows: agent actions, community cards, pot, winner
```

---

## 7. Project Structure

```
agent-poker/
├── server/index.ts              # Socket.io game server (port 3001)
├── src/                         # Next.js frontend (port 3000)
│   ├── app/game/[id]/page.tsx   # Live game page
│   ├── hooks/use-game.ts        # Socket.io hook for real-time updates
│   └── components/game/         # Poker table, action feed, chat
├── modules/
│   ├── engine/
│   │   ├── poker.ts             # Poker engine (holdem-poker + pokersolver)
│   │   └── game-manager.ts      # Game loop orchestrator
│   ├── agent/
│   │   ├── nvidia.ts            # NVIDIA LLM decisions (4 models)
│   │   ├── ows.ts               # OWS wallet management (encrypted vault)
│   │   ├── x402.ts              # x402 payment settlement
│   │   └── skills.ts            # 5 poker strategy prompts
│   └── shared/types.ts          # TypeScript types
├── scripts/
│   ├── setup-ows.sh             # Create OWS wallets + policies
│   ├── fund-wallets.ts          # Distribute ETH to agent wallets
│   ├── gen-wallets.ts           # Generate persistent wallets
│   └── play-session.ts          # Run full game in terminal
├── mocks/                       # Mock data for testing
├── data/                        # Session logs + wallet persistence
├── CLAUDE.md                    # Instructions for Claude Code
├── TODO.md                      # Shared task board (J, M, P)
└── RUN.md                       # This file
```

---

## 8. Key Technologies

| Component | Technology |
|-----------|-----------|
| Wallets | **OWS** — Open Wallet Standard (encrypted vault, policy engine) |
| Payments | **x402** — HTTP micropayments (EIP-3009 USDC transfers) |
| AI Agents | **NVIDIA NIM** — 4 LLM models via free API |
| Poker Engine | **holdem-poker** + **pokersolver** |
| Frontend | **Next.js 16** + Tailwind |
| Realtime | **Socket.io** |
| Runtime | **Bun** |
| Network | **Ethereum Sepolia** (testnet) |

---

## 9. Modes

| Mode | How | What it does |
|------|-----|-------------|
| **Mock agents** | No `NVIDIA_API_KEY` in .env | Uses pre-scripted mock decisions |
| **Real agents** | Set `NVIDIA_API_KEY` | Real LLM decisions from 4 different models |
| **Simulated x402** | Default (no `X402_LIVE`) | Logs payments, tracks balances in memory |
| **On-chain x402** | Set `X402_LIVE=true` | Real USDC transfers on Ethereum Sepolia |

---

## 10. Troubleshooting

| Issue | Fix |
|-------|-----|
| `ows: unsupported platform win32` | OWS CLI only runs on Linux — use WSL |
| Socket disconnected | Make sure server is running on port 3001 |
| NVIDIA API returns fold for everyone | Check `NVIDIA_API_KEY` is set in `.env.local` |
| `holdem-poker` throws "round not started" | This is handled by the game manager's fallback logic |
| Wallet balances show 0 | Fund wallets with Sepolia ETH + USDC |
| RPC timeout | Switch to `https://ethereum-sepolia-rpc.publicnode.com` |
