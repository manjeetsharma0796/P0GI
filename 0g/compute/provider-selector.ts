// 0g/compute/provider-selector.ts
// Single AI provider: "0G Compute"
// All inference is routed through 0g-compute.ts which handles the actual API calls.

import type { AgentAction, Agent, GameState } from "../../modules/shared/types"
import { ZG_AGENTS, ZG_AVAILABLE_MODELS, getZgAgentAction, fetchAvailableModels } from "./0g-compute"
import type { ModelInfo } from "./0g-compute"

/**
 * Get an agent's poker action via 0G Compute.
 */
export function getAgentActionFromProvider(
  agent: Agent,
  gameState: GameState,
  ctx?: { minRaise?: number; bigBlind?: number }
): Promise<AgentAction> {
  return getZgAgentAction(agent, gameState, ctx)
}

/**
 * Return the static fallback model list (sync).
 */
export function getAvailableModels() {
  return ZG_AVAILABLE_MODELS
}

/**
 * Fetch all available models dynamically from NVIDIA NIM.
 * Cached for 5 minutes. Falls back to static list on error.
 */
export async function getAvailableModelsDynamic(): Promise<ModelInfo[]> {
  return fetchAvailableModels()
}

/**
 * Return the default agent configuration.
 */
export function getDefaultAgents(): Agent[] {
  return ZG_AGENTS
}
