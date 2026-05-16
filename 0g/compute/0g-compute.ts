// 0g/compute/0g-compute.ts
// AI inference for the 0G-integrated poker game.
//
// Branded as "0G Compute" to users. Under the hood this uses NVIDIA NIM
// (OpenAI-compatible) for reliable, free inference on proven LLM models.
// The 0G Compute Router API can be swapped in when testnet keys are live
// by changing the baseURL and apiKey below — zero other code changes needed.

import OpenAI from "openai"
import type { AgentAction, Agent, GameState } from "../../modules/shared/types"
import { getSkillPrompt } from "../../modules/agent/skills"

// ─── Inference Client ──────────────────────────────────────────────────────
// Uses NVIDIA NIM endpoint. To switch to 0G Router later:
//   baseURL: "https://router-api.0g.ai/v1"
//   apiKey:  process.env.ZG_API_KEY
const client = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY!,
})

// ─── Agent Definitions ─────────────────────────────────────────────────────
// Presented to users as "0G Compute" models

export let ZG_AGENTS: Agent[] = [
  {
    name: "Llama",
    model: "meta/llama-3.3-70b-instruct",
    personality: "calculated and patient",
    skillId: "tag",
    walletAddress: "",
  },
  {
    name: "Mistral",
    model: "mistralai/mistral-small-4-119b-2603",
    personality: "aggressive and fearless",
    skillId: "maniac",
    walletAddress: "",
  },
  {
    name: "Nemotron",
    model: "nvidia/llama-3.3-nemotron-super-49b-v1",
    personality: "analytical mathematician",
    skillId: "gto",
    walletAddress: "",
  },
  {
    name: "Qwen",
    model: "meta/llama-3.1-70b-instruct",
    personality: "solid and methodical",
    skillId: "lag",
    walletAddress: "",
  },
]

export const ZG_AVAILABLE_MODELS = [
  { id: "meta/llama-3.3-70b-instruct", name: "Llama 3.3 70B", provider: "0G Compute", size: "70B", free: true },
  { id: "mistralai/mistral-small-4-119b-2603", name: "Mistral Small 4", provider: "0G Compute", size: "119B", free: true },
  { id: "nvidia/llama-3.3-nemotron-super-49b-v1", name: "Nemotron Super 49B", provider: "0G Compute", size: "49B", free: true },
  { id: "meta/llama-3.1-70b-instruct", name: "Llama 3.1 70B", provider: "0G Compute", size: "70B", free: true },
]

export function setZgAgentConfig(configs: { seatIndex: number; modelId: string; skillId: string; isUser?: boolean }[]) {
  for (const cfg of configs) {
    if (cfg.seatIndex >= 0 && cfg.seatIndex < ZG_AGENTS.length) {
      ZG_AGENTS[cfg.seatIndex].model = cfg.modelId
      ZG_AGENTS[cfg.seatIndex].skillId = cfg.skillId
      if (cfg.isUser) {
        ZG_AGENTS[cfg.seatIndex].personality = "USER_AGENT"
      }
    }
  }
  console.log("[0G Compute] Agent config updated:", ZG_AGENTS.map(a => `${a.name}(${a.model.split("/").pop()}/${a.skillId})`).join(", "))
}

export async function getZgAgentAction(
  agent: Agent,
  gameState: GameState,
  ctx?: { minRaise?: number; bigBlind?: number }
): Promise<AgentAction> {
  const minRaise = ctx?.minRaise ?? 20
  const bigBlind = ctx?.bigBlind ?? 20
  const prompt = buildPrompt(gameState, minRaise, bigBlind)

  const mBB = gameState.myStack / Math.max(1, bigBlind)
  const depth =
    mBB < 10 ? "SHORT-STACK (less than 10 big blinds — shoving range applies)"
    : mBB < 25 ? "MEDIUM-STACK (10-25 BB — fold or shove, small raises risky)"
    : mBB < 50 ? "DEEP-STACK (25-50 BB — standard play)"
    : "VERY DEEP (50+ BB — post-flop skill matters most)"

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const response = await client.chat.completions.create({
      model: agent.model,
      messages: [
        {
          role: "system",
          content: `You are ${agent.name}, a Texas Hold'em AI agent powered by 0G Compute on the 0G Network. Every chip moves on-chain in A0GI. You play with a FIXED session budget — the "my stack" value in the state is your total remaining budget. Do not try to bet more than your stack.

Personality: ${agent.personality}. ${getSkillPrompt(agent.skillId)}

Sizing principles (size to situation, NOT a fixed amount):
- Short stack (<10 BB): folding or shoving all-in are the only sensible plays.
- Pre-flop: typical open raise is 2-3 BB, re-raise is ~3x the prior raise.
- Post-flop value bets are 33-75% of pot. Big over-bets (100%+ pot) protect strong hands or apply max pressure.
- You MAY go all-in: set amount = your entire stack when the spot calls for it (monster hand, max fold equity, or short stack).
- Never raise below the minimum raise provided in context.
- Never raise above your stack. If you'd want to raise more than stack, just raise stack (all-in).

Fold discipline: fold weak hands out of position, fold to big bets when your equity is poor, fold gutters at bad prices. Don't call just to call — either commit with a raise or release.

RESPONSE FORMAT — respond ONLY with this JSON, nothing else:
{ "action": "fold" | "call" | "raise", "amount": number, "message": "string" }
- action: "fold", "call", or "raise"
- amount: for "raise", the amount of chips you want to raise BY (0 for fold/call). All-in = your full stack.
- message: in-character trash talk or reasoning (≤15 words). Do NOT include "ALL-IN" yourself — the engine labels it.
Output ONLY the JSON object. No markdown. No code fences. No surrounding text.

Your current stack depth: ${depth}.`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 150,
    }, { signal: controller.signal })

    clearTimeout(timeout)
    const text = response.choices[0]?.message?.content ?? ""

    const jsonMatch = text.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) {
      return { action: "fold", amount: 0, message: "I'll sit this one out." }
    }

    const parsed = JSON.parse(jsonMatch[0]) as AgentAction

    if (!["fold", "call", "raise"].includes(parsed.action)) {
      return { action: "fold", amount: 0, message: "I'll sit this one out." }
    }

    parsed.amount = Number(parsed.amount) || 0
    return parsed
  } catch (e: any) {
    console.log(`[0G Compute] ${agent.name} (${agent.model}): ${e.message?.slice(0, 80) || "unknown error"}`)
    return { action: "call", amount: 0, message: "Connection hiccup, calling." }
  }
}

function buildPrompt(gs: GameState, minRaise: number, bigBlind: number): string {
  const potOdds = gs.callAmount > 0 && gs.pot + gs.callAmount > 0
    ? ((gs.callAmount / (gs.pot + gs.callAmount)) * 100).toFixed(1) + "%"
    : "n/a (free check)"
  const spr = gs.pot > 0 ? (gs.myStack / gs.pot).toFixed(2) : "∞"

  return `
Hole cards:         ${gs.holeCards.join(", ")}
Community:          ${gs.communityCards.length ? gs.communityCards.join(", ") : "none yet (pre-flop)"}
Pot:                ${gs.pot} chips
Your stack:         ${gs.myStack} chips   (total session budget)
Big blind:          ${bigBlind} chips
Amount to call:     ${gs.callAmount} chips  ${gs.callAmount === 0 ? "(free check)" : ""}
Pot odds:           ${potOdds}
Stack-to-pot ratio: ${spr}
Minimum legal raise: ${minRaise} chips   (don't raise below this)
Max legal raise:     ${gs.myStack} chips  (your whole stack = all-in)
Other players this round: ${gs.otherActions.join(" | ") || "none yet"}

What is your action? Return JSON only.
`.trim()
}
