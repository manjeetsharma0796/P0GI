// modules/shared/types.ts
// SOURCE OF TRUTH — all shared types live here
// Do NOT change function signatures without coordinating with the full team

export type AgentName = "Llama" | "Mistral" | "Nemotron" | "Qwen"

export type ActionType = "fold" | "call" | "raise"

export interface AgentAction {
  action: ActionType
  amount: number      // chips (cents), 0 if fold or call
  message: string     // in-character message shown in UI (max 15 words)
}

export interface GameState {
  agentName: AgentName
  holeCards: string[]        // e.g. ["Ad", "Ks"]
  communityCards: string[]   // e.g. ["7h", "2c", "Jd"] — empty pre-flop
  pot: number                // in cents
  myStack: number            // in cents
  callAmount: number         // in cents, 0 = free check
  otherActions: string[]     // e.g. ["Llama raised 50", "Qwen folded"]
}

export interface Agent {
  name: AgentName
  model: string              // NVIDIA model ID string
  personality: string        // injected into system prompt
  skillId: string            // poker skill ID from skills.ts
  walletAddress: string      // OWS wallet address — set after wallet creation
}

export interface Wallet {
  address: string
  agentName: AgentName
}

export type TxHash = string

export interface GameEvent {
  type: "action" | "deal" | "showdown" | "payout" | "game_over"
  handNumber: number
  agentName?: AgentName
  action?: AgentAction
  txHash?: TxHash
  winnerName?: AgentName
  winnerHand?: string
  potAmount?: number
  communityCards?: string[]
  stacks?: Record<AgentName, number>   // current stack per agent in cents
  holeCards?: Record<string, string[]> // agent name → [card1, card2] — sent at showdown
  message?: string
}
