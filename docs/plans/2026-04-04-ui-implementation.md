# Agent Poker UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 4-screen poker UI where spectators watch AI agents play, chat, and bet on winners.

**Architecture:** Next.js App Router with two layout groups — `(dashboard)` with sidebar for Agents/Skills/Lobby, and full-width for Game. All data from mocks initially. Socket.io context for real-time. Dark theme throughout.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Socket.io Client, TypeScript. Path alias `@/*` = `./src/*`.

---

### Task 1: Dark Theme + Global Styles

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Replace globals.css with dark-first theme**

```css
@import "tailwindcss";

:root {
  --background: #0a0a0a;
  --foreground: #ededed;
  --card: #141414;
  --card-hover: #1a1a1a;
  --border: #262626;
  --accent: #22c55e;
  --accent-hover: #16a34a;
  --danger: #ef4444;
  --warning: #f59e0b;
  --muted: #737373;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-hover: var(--card-hover);
  --color-border: var(--border);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-danger: var(--danger);
  --color-warning: var(--warning);
  --color-muted: var(--muted);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), Arial, Helvetica, sans-serif;
}

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--background); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--muted); }
```

**Step 2: Update root layout metadata**

Modify `src/app/layout.tsx`:
- Change title to `"Agent Poker"`
- Change description to `"AI agents play Texas Hold'em — watch, chat, and bet"`
- Add `dark` class to `<html>` tag

**Step 3: Verify**

Run: `bun run dev`
Expected: Dark background page loads at localhost:3000

**Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat(ui): dark theme + global styles"
```

---

### Task 2: Providers — Socket.io + Wallet Context

**Files:**
- Create: `src/providers/socket-provider.tsx`
- Create: `src/providers/wallet-provider.tsx`
- Modify: `src/app/layout.tsx` — wrap children in providers

**Step 1: Create SocketProvider**

```tsx
// src/providers/socket-provider.tsx
"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { io, Socket } from "socket.io-client"

interface SocketContextType {
  socket: Socket | null
  connected: boolean
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false })

export function useSocket() {
  return useContext(SocketContext)
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"
    const s = io(url, { autoConnect: true, transports: ["websocket", "polling"] })
    s.on("connect", () => setConnected(true))
    s.on("disconnect", () => setConnected(false))
    setSocket(s)
    return () => { s.disconnect() }
  }, [])

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  )
}
```

**Step 2: Create WalletProvider**

```tsx
// src/providers/wallet-provider.tsx
"use client"

import { createContext, useContext, useState, ReactNode } from "react"

interface WalletState {
  address: string
  balanceCents: number
  transactions: { hash: string; amount: number; type: "deposit" | "bet" | "payout"; timestamp: number }[]
}

interface WalletContextType {
  wallet: WalletState
  deposit: (amountCents: number) => void
  debit: (amountCents: number) => void
  credit: (amountCents: number) => void
}

const defaultWallet: WalletState = {
  address: "0xUSER000000000000000000000000000000000099",
  balanceCents: 5000, // $50.00 test USDC
  transactions: [],
}

const WalletContext = createContext<WalletContextType>({
  wallet: defaultWallet,
  deposit: () => {},
  debit: () => {},
  credit: () => {},
})

export function useWallet() {
  return useContext(WalletContext)
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>(defaultWallet)

  function deposit(amountCents: number) {
    setWallet(prev => ({
      ...prev,
      balanceCents: prev.balanceCents + amountCents,
      transactions: [
        { hash: `0xMOCK_DEP_${Date.now()}`, amount: amountCents, type: "deposit", timestamp: Date.now() },
        ...prev.transactions,
      ],
    }))
  }

  function debit(amountCents: number) {
    setWallet(prev => ({ ...prev, balanceCents: prev.balanceCents - amountCents }))
  }

  function credit(amountCents: number) {
    setWallet(prev => ({ ...prev, balanceCents: prev.balanceCents + amountCents }))
  }

  return (
    <WalletContext.Provider value={{ wallet, deposit, debit, credit }}>
      {children}
    </WalletContext.Provider>
  )
}
```

**Step 3: Wire providers into root layout**

In `src/app/layout.tsx`, import and wrap `{children}` with:
```tsx
<SocketProvider>
  <WalletProvider>
    {children}
  </WalletProvider>
</SocketProvider>
```

**Step 4: Verify**

Run: `bun run dev`
Expected: Page loads without errors. Console may show socket connection attempt to localhost:3001 (expected to fail — server not running yet).

**Step 5: Commit**

```bash
git add src/providers/ src/app/layout.tsx
git commit -m "feat(ui): add Socket.io + Wallet context providers"
```

---

### Task 3: Dashboard Sidebar Layout

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/components/sidebar.tsx`

**Step 1: Create Sidebar component**

```tsx
// src/components/sidebar.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_ITEMS = [
  { href: "/agents", label: "Agents", icon: "🤖" },
  { href: "/skills", label: "Skills", icon: "⚡" },
  { href: "/lobby", label: "Lobby", icon: "🎮" },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold tracking-tight">Agent Poker</h1>
        <p className="text-xs text-muted mt-0.5">AI Texas Hold'em</p>
      </div>
      <nav className="flex-1 p-2 flex flex-col gap-1">
        {NAV_ITEMS.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:text-foreground hover:bg-card-hover"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs text-muted">Base Sepolia</span>
        </div>
      </div>
    </aside>
  )
}
```

**Step 2: Create dashboard layout**

```tsx
// src/app/(dashboard)/layout.tsx
import { Sidebar } from "@/components/sidebar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
```

**Step 3: Create placeholder pages for routing**

Create minimal placeholder pages:
- `src/app/(dashboard)/agents/page.tsx` — returns `<div>Agents</div>`
- `src/app/(dashboard)/skills/page.tsx` — returns `<div>Skills</div>`
- `src/app/(dashboard)/lobby/page.tsx` — returns `<div>Lobby</div>`

**Step 4: Update root page.tsx to redirect**

Replace `src/app/page.tsx` with a redirect to `/agents`:
```tsx
import { redirect } from "next/navigation"
export default function Home() { redirect("/agents") }
```

**Step 5: Verify**

Run: `bun run dev`
Expected: Sidebar visible on left. Clicking Agents/Skills/Lobby switches the content area. Active nav item highlighted in green.

**Step 6: Commit**

```bash
git add src/components/sidebar.tsx src/app/(dashboard)/ src/app/page.tsx
git commit -m "feat(ui): dashboard sidebar layout + routing"
```

---

### Task 4: Agents Screen — Agent Cards

**Files:**
- Create: `src/app/(dashboard)/agents/page.tsx`
- Create: `src/components/agent-card.tsx`

**Step 1: Define agent config data**

In the agents page file, define the preset agents:

```ts
const PRESET_AGENTS = [
  { id: "claude", name: "Claude", provider: "Anthropic", baseUrl: "https://api.anthropic.com", logo: "C" },
  { id: "gemini", name: "Gemini", provider: "Google", baseUrl: "https://generativelanguage.googleapis.com", logo: "G" },
  { id: "chatgpt", name: "ChatGPT", provider: "OpenAI", baseUrl: "https://api.openai.com", logo: "O" },
  { id: "custom", name: "Custom", provider: "Custom", baseUrl: "", logo: "?" },
]
```

**Step 2: Build AgentCard component**

Each card shows:
- Large letter avatar (logo) with colored background
- Agent name + provider
- API key input (masked, with show/hide toggle)
- For custom: additional Base URL input
- "Test" button — opens chat modal (built in Task 5)
- Green checkmark badge if key is validated
- Wallet balance from mock

**Step 3: Build Agents page layout**

Two-column layout:
- Left (2/3): Grid of 4 AgentCards
- Right (1/3): WalletPanel component (Task 6)

**Step 4: Verify**

Run: `bun run dev`, navigate to `/agents`
Expected: 4 agent cards displayed. API key inputs work. Custom card has extra URL field.

**Step 5: Commit**

```bash
git add src/app/(dashboard)/agents/page.tsx src/components/agent-card.tsx
git commit -m "feat(ui): agents screen with preset agent cards"
```

---

### Task 5: Chat Modal (Reusable)

**Files:**
- Create: `src/components/chat-modal.tsx`
- Modify: `src/components/agent-card.tsx` — wire "Test" button

**Step 1: Build ChatModal component**

Props: `{ open, onClose, title, subtitle }`

- Centered modal with dark backdrop
- Header: title + subtitle + X close button
- Scrollable message area
- Messages: user (right-aligned, green bg) and agent (left-aligned, card bg with avatar)
- Input bar: text input + send button
- For now, mock agent responses using `getMockAgentAction()` message field — the actual API integration comes later when keys are validated

**Step 2: Wire Test button in AgentCard**

Click "Test" → opens ChatModal with that agent's name/provider.

**Step 3: Verify**

Run: `bun run dev`, click "Test" on any agent card
Expected: Modal opens. Can type messages. Mock responses appear.

**Step 4: Commit**

```bash
git add src/components/chat-modal.tsx src/components/agent-card.tsx
git commit -m "feat(ui): reusable chat modal + agent test integration"
```

---

### Task 6: Wallet Panel

**Files:**
- Create: `src/components/wallet-panel.tsx`
- Modify: `src/app/(dashboard)/agents/page.tsx` — add WalletPanel to right column

**Step 1: Build WalletPanel**

- Wallet address display: truncated with **copy-to-clipboard** button (uses `navigator.clipboard`)
- Address is a clickable link to `https://sepolia.basescan.org/address/{address}`
- Balance display: format cents to USD (e.g., 5000 → "$50.00")
- Deposit button: opens inline amount input, calls `useWallet().deposit()`
- Transaction history list: each tx hash is a clickable link to `https://sepolia.basescan.org/tx/{hash}`

**Step 2: Wire into Agents page**

Add WalletPanel to the right column of the agents page.

**Step 3: Verify**

Run: `bun run dev`, navigate to `/agents`
Expected: Wallet panel shows address (clickable to explorer), balance, deposit works, copy button works.

**Step 4: Commit**

```bash
git add src/components/wallet-panel.tsx src/app/(dashboard)/agents/page.tsx
git commit -m "feat(ui): wallet panel with copy address + explorer links"
```

---

### Task 7: Skills Screen

**Files:**
- Create: `src/app/(dashboard)/skills/page.tsx`
- Create: `src/components/skill-card.tsx`

**Step 1: Define prebuilt skills**

```ts
const PREBUILT_SKILLS = [
  { id: "aggressive", name: "Aggressive Bluffer", description: "Raises frequently, bets big on weak hands to pressure opponents into folding.", prompt: "You are an aggressive poker player. Bluff often, raise big, and pressure opponents." },
  { id: "conservative", name: "Tight Conservative", description: "Only plays strong hands. Folds early and often. Patience is the strategy.", prompt: "You are a tight conservative player. Only play premium hands. Fold anything marginal." },
  { id: "gto", name: "GTO Balanced", description: "Game-theory optimal. Mixes bluffs and value bets at mathematically correct frequencies.", prompt: "You play GTO poker. Balance your bluffs and value bets. Use pot odds and implied odds." },
  { id: "chaos", name: "Random Chaos", description: "Unpredictable. Random raises, bizarre bet sizes. Nobody knows what you'll do next.", prompt: "You are chaotic and unpredictable. Make random decisions. Bet weird amounts. Confuse everyone." },
]
```

**Step 2: Build SkillCard**

Shows name, description, select button. Selected card gets green border + checkmark.

**Step 3: Build Skills page layout**

- Left (2/3): Grid of SkillCards
- Right (1/3): Custom Skill Editor — textarea for custom prompt, char count, "Use Custom" button
- Bottom: Deposit check gate — if `useWallet().wallet.balanceCents >= 100` show green "Go to Lobby" link, else show warning + "Deposit" link to `/agents`

**Step 4: Verify**

Run: `bun run dev`, navigate to `/skills`
Expected: 4 skill cards selectable. Custom editor works. Deposit gate shows correct state.

**Step 5: Commit**

```bash
git add src/app/(dashboard)/skills/page.tsx src/components/skill-card.tsx
git commit -m "feat(ui): skills screen with prebuilt strategies + custom editor"
```

---

### Task 8: Lobby Screen

**Files:**
- Create: `src/app/(dashboard)/lobby/page.tsx`
- Create: `src/components/table-card.tsx`

**Step 1: Define mock tables data**

```ts
const MOCK_TABLES = [
  { id: "1", name: "Table #1", agents: ["Claude", "Gemini", "ChatGPT", "Custom"], seated: 4, max: 4, hand: 7, pot: 450, status: "in_progress" as const },
  { id: "2", name: "Table #2", agents: ["Claude", "Gemini"], seated: 2, max: 4, hand: 0, pot: 0, status: "waiting" as const },
  { id: "3", name: "Table #3", agents: ["ChatGPT", "Gemini", "Claude", "Custom"], seated: 4, max: 4, hand: 15, pot: 0, status: "finished" as const },
]
```

**Step 2: Build TableCard**

Shows: table name, agent avatars, seated count, hand number, pot size, status badge (waiting=yellow, in_progress=green, finished=muted). "Join as Spectator" button links to `/game/{id}`.

**Step 3: Build Lobby page**

- Top bar: "Create Table" button + filter by status dropdown
- Grid of TableCards (3-column on desktop, 1-column mobile)

**Step 4: Verify**

Run: `bun run dev`, navigate to `/lobby`
Expected: 3 mock tables shown. Status badges correct. "Join as Spectator" links to /game/1 etc.

**Step 5: Commit**

```bash
git add src/app/(dashboard)/lobby/page.tsx src/components/table-card.tsx
git commit -m "feat(ui): lobby screen with game table cards"
```

---

### Task 9: Game Screen — Layout + Poker Table

**Files:**
- Create: `src/app/game/[id]/page.tsx`
- Create: `src/app/game/[id]/layout.tsx`
- Create: `src/components/game/poker-table.tsx`
- Create: `src/components/game/agent-seat.tsx`

**Step 1: Create game layout (full-width, no sidebar)**

```tsx
// src/app/game/[id]/layout.tsx
export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>
}
```

**Step 2: Build AgentSeat component**

Props: agent name, stack, hole cards (2 strings or hidden), last action, isActive, isThinking

Shows:
- Circular avatar with agent initial letter
- Name label below
- Stack amount
- Two card slots (face down or showing card text like "Ad")
- Last action badge ("Raised $1.00" / "Folded" / "Called")
- Pulse animation when isActive
- Spinner overlay when isThinking

**Step 3: Build PokerTable component**

- Oval/rounded-rect green felt table in center
- 4 AgentSeats positioned: top, right, bottom, left (using absolute positioning within relative container)
- 5 community card slots in the center (empty slots as gray rectangles, filled slots show card text)
- Pot display centered above community cards
- Hand number top-left

Mock data for initial render: use `MOCK_FLOP_STATE` community cards, mock agent names, random stacks.

**Step 4: Build Game page — three-panel skeleton**

```tsx
// src/app/game/[id]/page.tsx
// Left panel: action feed (placeholder)
// Center: PokerTable
// Right panel: chat + betting (placeholder)
```

Three columns: `grid grid-cols-[280px_1fr_320px]`

**Step 5: Verify**

Run: `bun run dev`, navigate to `/game/1`
Expected: Full-width page. Poker table in center with 4 agent seats. Community cards visible. Pot displayed.

**Step 6: Commit**

```bash
git add src/app/game/ src/components/game/
git commit -m "feat(ui): game screen layout + poker table with agent seats"
```

---

### Task 10: Game Screen — Action Feed (Left Panel)

**Files:**
- Create: `src/components/game/action-feed.tsx`
- Modify: `src/app/game/[id]/page.tsx` — wire into left panel

**Step 1: Build ActionFeed component**

- Scrollable vertical list, auto-scrolls to bottom on new entries
- Each entry: timestamp (HH:MM:SS), agent avatar circle, action text
- Color-coded: fold=red text, call=blue text, raise=green text, deal=muted
- Hand number separator: dark horizontal line with "Hand #N" label
- Uses `GameEvent` type from `modules/shared/types.ts`

Mock initial data: array of sample GameEvents showing a partial hand (deal, raise, call, fold).

**Step 2: Wire into game page left panel**

**Step 3: Verify**

Run: `bun run dev`, navigate to `/game/1`
Expected: Left panel shows scrollable action feed with color-coded entries.

**Step 4: Commit**

```bash
git add src/components/game/action-feed.tsx src/app/game/[id]/page.tsx
git commit -m "feat(ui): action feed panel with color-coded game events"
```

---

### Task 11: Game Screen — Live Chat (Right Panel Top)

**Files:**
- Create: `src/components/game/live-chat.tsx`
- Modify: `src/app/game/[id]/page.tsx` — wire into right panel

**Step 1: Build LiveChat component**

Reuses visual style from ChatModal but embedded (not modal):
- Scrollable message area
- Two message types:
  - Agent trash-talk: left-aligned, italic, with agent name badge + colored dot
  - Spectator messages: right-aligned, normal style, with "You" or username label
- Input bar at bottom: text input + send button
- On send: adds message to local state. In future, emits via Socket.io.

Mock data: a few sample agent trash-talk messages from `mocks/agents.ts` message fields.

**Step 2: Wire into right panel (top half)**

Right panel uses `flex flex-col`, chat takes `flex-1` with `overflow-auto`.

**Step 3: Verify**

Run: `bun run dev`, navigate to `/game/1`
Expected: Chat panel on right shows mock messages. Can type and send (appears locally).

**Step 4: Commit**

```bash
git add src/components/game/live-chat.tsx src/app/game/[id]/page.tsx
git commit -m "feat(ui): live chat panel with agent + spectator messages"
```

---

### Task 12: Game Screen — Spectator Betting (Right Panel Bottom)

**Files:**
- Create: `src/components/game/spectator-betting.tsx`
- Modify: `src/app/game/[id]/page.tsx` — wire into right panel

**Step 1: Build SpectatorBetting component**

- Amount input: number input with "$" prefix, step 0.10
- 4 bet buttons in a 2x2 grid: "BET ON A", "BET ON B", "BET ON C", "BET ON D"
  - Each shows agent name + current bet percentage (width of filled bar inside button)
  - On click: calls `useWallet().debit()` with entered amount, updates local bet state
  - Disabled if balance insufficient or no amount entered
- Total pool display at top

Mock percentages: distribute bets proportionally as user bets.

**Step 2: Wire into right panel (bottom section)**

Below the chat, with a border-t separator. Fixed height ~200px.

**Step 3: Verify**

Run: `bun run dev`, navigate to `/game/1`
Expected: Betting panel at bottom right. Can enter amount and click bet buttons. Percentages update. Wallet balance decreases.

**Step 4: Commit**

```bash
git add src/components/game/spectator-betting.tsx src/app/game/[id]/page.tsx
git commit -m "feat(ui): spectator betting panel with percentage indicators"
```

---

### Task 13: Game Over Overlay

**Files:**
- Create: `src/components/game/game-over.tsx`
- Modify: `src/app/game/[id]/page.tsx` — conditional render

**Step 1: Build GameOver component**

- Full-screen semi-transparent overlay
- Centered card showing:
  - "Game Over" heading
  - Winner name + avatar with crown/trophy icon
  - Final stacks table (all 4 agents with their ending balance)
  - Payout breakdown: list of tx hashes as clickable explorer links
  - "Back to Lobby" button → links to `/lobby`

**Step 2: Wire into game page**

Add a `gameOver` state boolean. When true, render GameOver overlay on top of the table. Add a temporary "Simulate Game Over" button for testing.

**Step 3: Verify**

Run: `bun run dev`, click "Simulate Game Over"
Expected: Overlay appears with winner info, stacks, and explorer links.

**Step 4: Commit**

```bash
git add src/components/game/game-over.tsx src/app/game/[id]/page.tsx
git commit -m "feat(ui): game over overlay with winner + payout display"
```

---

### Task 14: Socket.io Game Hook

**Files:**
- Create: `src/hooks/use-game.ts`
- Modify: `src/app/game/[id]/page.tsx` — replace mock data with hook

**Step 1: Build useGame hook**

```ts
// src/hooks/use-game.ts
// Listens to socket events and manages game state for the UI
// Events: game_event (GameEvent), agent_thinking, agent_done

export function useGame(gameId: string) {
  // Returns:
  // - events: GameEvent[] — full action log
  // - agents: { name, stack, holeCards, lastAction, isActive, isThinking }[]
  // - communityCards: string[]
  // - pot: number
  // - handNumber: number
  // - gameOver: boolean
  // - winner: { name, potAmount } | null
}
```

Listens to socket for `game_event` and updates state. Falls back to mock data when socket not connected.

**Step 2: Wire into game page**

Replace all hardcoded mock data in `game/[id]/page.tsx` with `useGame(id)` return values.

**Step 3: Verify**

Run: `bun run dev`, navigate to `/game/1`
Expected: Page loads with mock fallback data (socket not running). No errors.

**Step 4: Commit**

```bash
git add src/hooks/use-game.ts src/app/game/[id]/page.tsx
git commit -m "feat(ui): useGame socket hook with mock fallback"
```

---

### Task 15: Polish + Responsive + Final Cleanup

**Files:**
- Modify: `src/components/sidebar.tsx` — mobile bottom bar
- Modify: various components — responsive tweaks

**Step 1: Mobile sidebar**

On screens < 768px, sidebar becomes a fixed bottom nav bar with icons only (no labels). Use `md:` breakpoint prefix.

**Step 2: Game screen responsive**

On screens < 1024px, game switches from 3-column to stacked layout:
- Poker table full width
- Action feed + chat/betting in tabs below

**Step 3: Add loading states**

Add skeleton/loading states to agent cards, lobby cards.

**Step 4: Verify**

Run: `bun run dev`, resize browser
Expected: Sidebar collapses to bottom bar on mobile. Game layout stacks on tablet.

**Step 5: Commit**

```bash
git add src/
git commit -m "feat(ui): responsive layout + mobile nav + loading states"
```

---

### Task 16: Update TODO.md + Push

**Files:**
- Modify: `TODO.md` — update J's task statuses

**Step 1: Update TODO.md**

Mark completed J tasks:
- J1-J16: Update status based on what's been built
- J3 (useGame hook) → DONE
- J4 (game layout) → DONE
- J5 (agent card) → DONE
- J6 (community cards) → DONE
- J7 (pot counter) → DONE
- J8 (action log) → DONE
- J9 (agent message) → DONE
- J10 (start game button) → DONE
- J11 (hand number) → DONE
- J12 (active turn indicator) → DONE
- J13 (thinking spinner) → DONE
- J14 (wallet balance) → DONE (mock)
- J15 (game over) → DONE

**Step 2: Commit + Push**

```bash
git add TODO.md
git commit -m "docs: update TODO.md with J task progress"
git push origin feat/J/ui
```
