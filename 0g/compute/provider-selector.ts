import type { AgentAction, Agent, GameState } from "../../modules/shared/types"
import { AGENTS, AVAILABLE_MODELS, getAgentAction } from "../../modules/agent/nvidia"
import { ZG_AGENTS, ZG_AVAILABLE_MODELS, getZgAgentAction } from "./0g-compute"

export type AIProvider = "nvidia" | "0g"

export function getAgentActionFromProvider(
  provider: AIProvider,
  agent: Agent,
  gameState: GameState,
  ctx?: { minRaise?: number; bigBlind?: number }
): Promise<AgentAction> {
  switch (provider) {
    case "nvidia":
      return getAgentAction(agent, gameState, ctx)
    case "0g":
      return getZgAgentAction(agent, gameState, ctx)
  }
}

export function getAvailableModels(provider: AIProvider) {
  switch (provider) {
    case "nvidia":
      return AVAILABLE_MODELS
    case "0g":
      return ZG_AVAILABLE_MODELS
  }
}

export function getDefaultAgents(provider: AIProvider): Agent[] {
  switch (provider) {
    case "nvidia":
      return AGENTS
    case "0g":
      return ZG_AGENTS
  }
}
