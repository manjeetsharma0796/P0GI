"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"

// 0G Galileo Testnet
const CHAIN_ID = 16602
const CHAIN_ID_HEX = "0x40DA"
const CHAIN_CONFIG = {
  chainId: CHAIN_ID_HEX,
  chainName: "0G Galileo Testnet",
  nativeCurrency: { name: "A0GI", symbol: "A0GI", decimals: 18 },
  rpcUrls: ["https://evmrpc-testnet.0g.ai"],
  blockExplorerUrls: ["https://chainscan-galileo.0g.ai"],
}

interface EvmWalletState {
  address: string | null
  chainId: number | null
  isConnected: boolean
  isConnecting: boolean
  chipBalance: string | null
  a0giBalance: string | null
}

interface EvmWalletContextType extends EvmWalletState {
  connect: () => Promise<void>
  disconnect: () => void
  switchToZgChain: () => Promise<void>
  isCorrectChain: boolean
}

const EvmWalletContext = createContext<EvmWalletContextType>({
  address: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  chipBalance: null,
  a0giBalance: null,
  connect: async () => {},
  disconnect: () => {},
  switchToZgChain: async () => {},
  isCorrectChain: false,
})

export function useEvmWallet() {
  return useContext(EvmWalletContext)
}

export function EvmWalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EvmWalletState>({
    address: null,
    chainId: null,
    isConnected: false,
    isConnecting: false,
    chipBalance: null,
    a0giBalance: null,
  })

  const isCorrectChain = state.chainId === CHAIN_ID

  // Fetch CHIP balance from our API
  const fetchBalance = useCallback(async (addr: string) => {
    try {
      const res = await fetch(`/api/balance?address=${addr}`)
      const data = await res.json()
      setState(prev => ({
        ...prev,
        chipBalance: data.usdc ?? "0",
        a0giBalance: data.eth ?? "0",
      }))
    } catch {
      // ignore
    }
  }, [])

  // Connect via MetaMask / browser wallet
  const connect = useCallback(async () => {
    const eth = (window as any).ethereum
    if (!eth) {
      window.open("https://metamask.io/download/", "_blank")
      return
    }

    setState(prev => ({ ...prev, isConnecting: true }))
    try {
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" })
      const chainIdHex: string = await eth.request({ method: "eth_chainId" })
      const chainId = parseInt(chainIdHex, 16)

      if (accounts[0]) {
        setState(prev => ({
          ...prev,
          address: accounts[0],
          chainId,
          isConnected: true,
          isConnecting: false,
        }))
        fetchBalance(accounts[0])
      }
    } catch {
      setState(prev => ({ ...prev, isConnecting: false }))
    }
  }, [fetchBalance])

  const disconnect = useCallback(() => {
    setState({
      address: null,
      chainId: null,
      isConnected: false,
      isConnecting: false,
      chipBalance: null,
      a0giBalance: null,
    })
  }, [])

  // Switch to 0G Galileo Testnet
  const switchToZgChain = useCallback(async () => {
    const eth = (window as any).ethereum
    if (!eth) return
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] })
    } catch (err: any) {
      // Chain not added — add it
      if (err.code === 4902) {
        await eth.request({ method: "wallet_addEthereumChain", params: [CHAIN_CONFIG] })
      }
    }
  }, [])

  // Listen for account/chain changes
  useEffect(() => {
    const eth = (window as any).ethereum
    if (!eth) return

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect()
      } else {
        setState(prev => ({ ...prev, address: accounts[0], isConnected: true }))
        fetchBalance(accounts[0])
      }
    }

    const handleChainChanged = (chainIdHex: string) => {
      setState(prev => ({ ...prev, chainId: parseInt(chainIdHex, 16) }))
    }

    eth.on("accountsChanged", handleAccountsChanged)
    eth.on("chainChanged", handleChainChanged)

    // Check if already connected
    eth.request({ method: "eth_accounts" }).then((accounts: string[]) => {
      if (accounts.length > 0) {
        eth.request({ method: "eth_chainId" }).then((chainIdHex: string) => {
          setState(prev => ({
            ...prev,
            address: accounts[0],
            chainId: parseInt(chainIdHex, 16),
            isConnected: true,
          }))
          fetchBalance(accounts[0])
        })
      }
    })

    return () => {
      eth.removeListener("accountsChanged", handleAccountsChanged)
      eth.removeListener("chainChanged", handleChainChanged)
    }
  }, [disconnect, fetchBalance])

  return (
    <EvmWalletContext.Provider value={{ ...state, connect, disconnect, switchToZgChain, isCorrectChain }}>
      {children}
    </EvmWalletContext.Provider>
  )
}
