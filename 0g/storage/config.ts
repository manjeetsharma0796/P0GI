// 0g/storage/config.ts
// 0G Storage configuration — endpoints for Log layer (immutable) and KV layer (mutable)

export const ZG_STORAGE_CONFIG = {
  testnet: {
    indexerRpc: "https://indexer-storage-testnet-turbo.0g.ai",
    evmRpc: "https://evmrpc-testnet.0g.ai",
    chainId: 16600,
    explorer: "https://chainscan-galileo.0g.ai",
    kvNodeRpc: "https://kv-testnet.0g.ai",
  },

  mainnet: {
    indexerRpc: "https://indexer-storage.0g.ai",
    evmRpc: "https://evmrpc.0g.ai",
    chainId: 21000,
    explorer: "https://chainscan.0g.ai",
    kvNodeRpc: "https://kv.0g.ai",
  },
} as const

/** Resolve runtime config from env vars, falling back to testnet defaults. */
export function getStorageConfig() {
  const cfg = ZG_STORAGE_CONFIG.testnet

  return {
    privateKey: process.env.ZG_PRIVATE_KEY ?? "",
    evmRpc: process.env.ZG_STORAGE_RPC ?? cfg.evmRpc,
    indexerRpc: process.env.ZG_INDEXER_RPC ?? cfg.indexerRpc,
    kvNodeRpc: process.env.ZG_KV_NODE_RPC ?? cfg.kvNodeRpc,
    streamId: process.env.ZG_STREAM_ID ?? "",
  }
}
