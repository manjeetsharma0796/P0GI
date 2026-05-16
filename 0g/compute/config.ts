export const ZG_CONFIG = {
  router: {
    url: "https://router-api.0g.ai/v1",
  },

  testnet: {
    chainId: 16602,
    rpc: "https://evmrpc-testnet.0g.ai",
    explorer: "https://chainscan-galileo.0g.ai",
    faucet: "https://faucet.0g.ai",
  },

  mainnet: {
    chainId: 16661,
    rpc: "https://evmrpc.0g.ai",
    explorer: "https://chainscan.0g.ai",
  },
} as const
