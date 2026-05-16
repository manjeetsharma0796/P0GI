// 0g/sealed-inference/types.ts
// Type definitions for TEE-verified (Sealed Inference) AI decisions

import type { AgentAction } from "../../modules/shared/types"
import type { ZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk"

/**
 * Type alias for the broker instance returned by `createZGComputeNetworkBroker`.
 * Exposes `broker.inference` (InferenceBroker) and `broker.ledger` (LedgerBroker).
 */
export type SealedInferenceBroker = ZGComputeNetworkBroker

/**
 * An agent action that includes TEE verification metadata.
 * Even if verification fails, the action is still usable — `verified`
 * simply indicates whether the TEE attestation check passed.
 */
export interface SealedAgentAction extends AgentAction {
  /** Whether the response passed TEE signature verification */
  verified: boolean
  /** Chat ID returned by the provider (used for verification lookup) */
  chatId: string
  /** On-chain address of the provider that served this inference */
  providerAddress: string
}

/**
 * Metadata for a provider service discovered on the 0G Compute Network.
 * Mapped from the SDK's ServiceStructOutput contract query.
 */
export interface ServiceInfo {
  /** On-chain address of the provider */
  providerAddress: string
  /** Service type, e.g. "chatbot", "text-to-image" */
  serviceType: string
  /** Model identifier served by this provider */
  model: string
  /** HTTP endpoint for inference requests */
  endpoint: string
  /** Verifiability mode string from the contract (e.g. "TeeML", "OpML", "ZKML") */
  verifiability: string
  /** Whether the TEE signer has been acknowledged on-chain */
  teeAcknowledged: boolean
}

/**
 * Result of a TEE attestation check against a provider.
 */
export interface VerificationResult {
  /** The provider address that was checked */
  providerAddress: string
  /** Whether the TEE attestation is valid */
  valid: boolean
  /** Human-readable status message */
  message: string
  /** Timestamp of the check (ISO 8601) */
  checkedAt: string
}
