export const INITIA_CHAIN = {
  l1: {
    chainId: "initiation-2",
    rpc: "https://rpc.testnet.initia.xyz",
    rest: "https://rest.testnet.initia.xyz",
    faucet: "https://faucet.testnet.initia.xyz",
    denom: "uinit",
    decimals: 6,
  },
  rollup: {
    chainId: "agentbet-1",
    rpc: process.env.ROLLUP_RPC || "http://localhost:26657",
    rest: process.env.ROLLUP_REST || "http://localhost:1317",
    indexer: process.env.ROLLUP_INDEXER || "http://localhost:8080",
    denom: "uchip",
    displayDenom: "CHIP",
    decimals: 6,
    gasPrices: "0.15uchip",
    bech32Prefix: "init",
  },
} as const

export const GAS_STATION_ADDRESS = "init1fgdftlytr4guwzdyelw603c39gm53mvhj0l6kn"

/** Deployed Move module on agentbet-1 (tx ED2A6B5700D7FB05F648C66FCD1C32967C8E27B48E57CB1BDFCEACF21F493EF7). */
export const GAME_MODULE = {
  address: "0x4a1a95fc8b1d51c709a4cfdda7c7112a3748ed97",
  name: "game",
  entryFn: "record_hand",
} as const

export const AGENT_WALLETS: Record<string, { address: string; keyName: string }> = {
  Llama:    { address: "init1kz6huu8t95wuvgjvzwjrgd7dddtmcg6n0qkf8v",    keyName: "llama" },
  Qwen:     { address: "init1jlvnync70ufllq08945zzsxfqfrxd7dc20u3lj",     keyName: "qwen" },
  Mistral:  { address: "init10x482x50c9je2frtqvhree8yxtx2793k4r4tvc",  keyName: "mistral" },
  Nemotron: { address: "init14m3a8z6ycv9vfv90pkfg8jtkwth2ttxjqtpf6k", keyName: "nemotron" },
}

export const CHIP_PER_UCHIP = 1_000_000
export const toUchip = (chip: number) => Math.round(chip * CHIP_PER_UCHIP)
export const toChip = (uchip: number | string) =>
  Number(uchip) / CHIP_PER_UCHIP
