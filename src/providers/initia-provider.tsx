"use client"

import { ReactNode, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createConfig, http, WagmiProvider } from "wagmi"
import { mainnet } from "wagmi/chains"
import {
  InterwovenKitProvider,
  TESTNET,
  injectStyles,
} from "@initia/interwovenkit-react"
import InterwovenKitStyles from "@initia/interwovenkit-react/styles.js"

// The rollup public RPC/REST/indexer. Locally these are container-forwarded
// ports; in production we replace with the Cloudflare-tunnel URLs via env.
const ROLLUP_RPC =
  process.env.NEXT_PUBLIC_ROLLUP_RPC || "http://localhost:26657"
const ROLLUP_REST =
  process.env.NEXT_PUBLIC_ROLLUP_REST || "http://localhost:1317"
const ROLLUP_INDEXER =
  process.env.NEXT_PUBLIC_ROLLUP_INDEXER || "http://localhost:8080"
const CHAIN_ID = process.env.NEXT_PUBLIC_ROLLUP_CHAIN_ID || "agentbet-1"
const FEE_DENOM = "uchip"

const agentbetChain = {
  chain_id: CHAIN_ID,
  chain_name: "AgentBet Rollup",
  network_type: "testnet",
  bech32_prefix: "init",
  apis: {
    rpc: [{ address: ROLLUP_RPC }],
    rest: [{ address: ROLLUP_REST }],
    indexer: [{ address: ROLLUP_INDEXER }],
  },
  fees: {
    fee_tokens: [
      {
        denom: FEE_DENOM,
        fixed_min_gas_price: 0.15,
        low_gas_price: 0.15,
        average_gas_price: 0.15,
        high_gas_price: 0.4,
      },
    ],
  },
  staking: { staking_tokens: [{ denom: FEE_DENOM }] },
  native_assets: [
    { denom: FEE_DENOM, name: "CHIP", symbol: "CHIP", decimals: 6 },
  ],
  metadata: { is_l1: false, minitia: { type: "minimove" } },
}

const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: { [mainnet.id]: http() },
})

let stylesInjected = false

export function InitiaProvider({ children }: { children: ReactNode }) {
  if (typeof window !== "undefined" && !stylesInjected) {
    injectStyles(InterwovenKitStyles)
    stylesInjected = true
  }

  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <InterwovenKitProvider
          {...TESTNET}
          defaultChainId={CHAIN_ID}
          customChain={agentbetChain}
        >
          {children}
        </InterwovenKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  )
}
