# P0GI Demo Script (3-4 min)

## PART 1: Pitch + App Walkthrough (0:00 - 1:30)

### Opening Hook (0:00 - 0:15)

> "What if AI agents could gamble with real tokens on-chain — and every single decision, every bluff, every bet was powered by decentralized AI and settled on a real blockchain?"
>
> "That's P0GI — four AI agents playing Texas Hold'em, powered entirely by the 0G stack."

### The Problem (0:15 - 0:30)

> "Today, AI gaming is either fully off-chain with no transparency, or it's on-chain but the AI is just random number generation pretending to be smart."
>
> "There's no system where real LLMs make real decisions AND every chip moves on a real chain. Until now."

### The Solution — Show the App (0:30 - 1:00)

**[Screen: localhost:3000/agents — Agent Selection page]**

> "P0GI gives you four AI poker agents. Each one runs a different large language model through 0G Compute — the decentralized AI inference network."
>
> "You pick your agent..."

**[Click an agent, show the model + wallet address + CHIP balance]**

> "Each agent has its own on-chain wallet, pre-funded with CHIP tokens — our custom ERC20 on 0G Chain."

**[Click Choose Skills]**

> "You assign a poker strategy — Tight Aggressive, Loose Aggressive, GTO, Maniac, or Rock. This gets injected into the AI's system prompt, so each agent actually plays differently."

**[Click through to Lobby, show buy-in slider]**

> "Set your buy-in in CHIP tokens. This is real ERC20 value — not play money."

### 0G Integration Summary (1:00 - 1:30)

> "Under the hood, we're using five 0G products:"
>
> "**0G Compute** — every poker decision is a real-time LLM inference call through the 0G router API. Four agents, four different models, 90+ models available."
>
> "**0G Chain** — every hand settles with real ERC20 token transfers. Losers send CHIP to winners. P0GI's AgentBetGame contract emits HandSettled events — permanent on-chain audit trail."
>
> "**0G Storage** — every hand is archived immutably. Log layer for game history, KV layer for the leaderboard."
>
> "**0G DA** — ensures all that archived data stays available and verifiable."
>
> "**0G Sealed Inference** — TEE-verified AI decisions so nobody can tamper with the results. Critical for a betting game."

---

## PART 2: Live Game Demo (1:30 - 3:30)

### Start the Game (1:30 - 1:45)

**[Screen: Game page — poker table]**

> "Let's play. I'm Nemotron — bought in 500 CHIP. My three opponents are Llama, Mistral, and Qwen."

**[Click Start Game]**

> "Watch — each agent is now thinking. That loading state means a real LLM call is hitting 0G Compute right now."

### First Hand Plays Out (1:45 - 2:30)

**[Let the hand play — agents fold/call/raise with chat messages]**

> "See the Live Chat on the right — those aren't scripted responses. Each agent is trash-talking based on its poker personality and the actual cards it's holding."
>
> "Llama folds... Mistral raises... Qwen calls..."

**[Point to the action log on the left]**

> "Every action logged in real-time. And look at the pot — that's real CHIP tokens being wagered."

### Settlement (2:30 - 3:00)

**[Winner announced — settlement toasts appear]**

> "And there it is — [Winner] wins the pot."
>
> "Now watch the bottom right — those green toasts are real on-chain transactions happening right now."

**[Point to the toast: "CHIP transfer confirmed" with tx hash]**

> "Each loser's wallet is calling chip.transfer() to the winner. Click 'View on 0G Explorer' — that's a real transaction on chainscan-galileo."

**[If time: click the explorer link to show the tx]**

> "And P0GI's AgentBetGame contract just emitted a HandSettled event — that's the permanent on-chain record of this hand."

### Show the Connected Wallet (3:00 - 3:15)

**[Point to Connect Wallet button in top right]**

> "Players can connect their MetaMask, auto-switch to 0G Galileo Testnet, and see their CHIP balance. Everything is on the real 0G testnet."

---

## PART 3: Closing (3:15 - 3:45)

> "So to recap — P0GI is a fully on-chain AI poker arena. Real AI making real decisions through 0G Compute. Real tokens moving on 0G Chain. Real game history on 0G Storage. All verifiable, all transparent, all decentralized."
>
> "We built this on five 0G products — Compute, Chain, Storage, DA, and Sealed Inference. Not surface-level integrations — these are core to every hand that plays."
>
> "This is what AI gaming looks like when it's actually on-chain. Thank you."

---

## Tips

- **Keep the game running** during the pitch so settlement happens naturally
- **Pre-fund wallets** before recording so balances look healthy
- **Have the explorer tab ready** to quickly show a real tx if needed
- **Energy matters** — the hook and close should hit hard, the demo should feel live and real
- If a hand takes too long, just narrate over it — "while the agents think, let me show you..."
- Total runtime target: **3:30** (leaves buffer under 4 min)
