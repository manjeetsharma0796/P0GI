// 0g/sealed-inference/config.ts
// Configuration constants for the Sealed Inference (TEE verification) module

export const SEALED_CONFIG = {
  /** 0G Newton testnet RPC */
  rpc: "https://evmrpc-testnet.0g.ai",

  /** Chain ID for 0G Galileo testnet */
  chainId: 16602,

  /** Minimum ledger deposit in A0GI (the broker's on-chain escrow) */
  minLedgerDeposit: "3",

  /** Minimum per-provider fund transfer in A0GI */
  minProviderFund: "1",

  /** Request timeout in milliseconds */
  requestTimeoutMs: 20_000,

  /** Max tokens for poker decision responses */
  maxTokens: 150,

  /** Temperature for inference calls */
  temperature: 0.8,
} as const

/**
 * Known testnet provider addresses.
 * These are community/0G-operated inference providers on Newton testnet.
 * Addresses may rotate — use `listAvailableProviders()` for live discovery.
 */
export const KNOWN_PROVIDERS: Record<string, { address: string; model: string; name: string }> = {
  "qwen-7b": {
    address: "0xbE8e1C331F49e3e4baBfCe2e9ad0e56aa6b2906c",
    model: "Qwen/Qwen2.5-7B-Instruct",
    name: "Qwen 2.5 7B Instruct",
  },
  "gemma-27b": {
    address: "0x48aC98eA0bD06F261b9d228a1b70C46Bd0a3f7c5",
    model: "google/gemma-2-27b-it",
    name: "Gemma 2 27B IT",
  },
  "deepseek-7b": {
    address: "0x7F04eB21Ef1Da44bC98214a76Fe5B9E72F6b4da0",
    model: "deepseek-ai/DeepSeek-V2-Lite-Chat",
    name: "DeepSeek V2 Lite Chat",
  },
  "llama-8b": {
    address: "0x2329F5A540cf16435feaF31a2F4A1BFe0dBFd7dC",
    model: "meta-llama/Llama-3.1-8B-Instruct",
    name: "Llama 3.1 8B Instruct",
  },
} as const
