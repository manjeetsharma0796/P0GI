"use client"

import { createContext, useContext, useState, ReactNode } from "react"

interface Transaction {
  hash: string
  amount: number
  type: "deposit" | "bet" | "payout"
  timestamp: number
}

interface WalletState {
  address: string
  balanceCents: number
  transactions: Transaction[]
}

interface WalletContextType {
  wallet: WalletState
  deposit: (amountCents: number) => void
  debit: (amountCents: number) => void
  credit: (amountCents: number) => void
}

const defaultWallet: WalletState = {
  address: "0xUSER000000000000000000000000000000000099",
  balanceCents: 5000,
  transactions: [],
}

const WalletContext = createContext<WalletContextType>({
  wallet: defaultWallet,
  deposit: () => {},
  debit: () => {},
  credit: () => {},
})

export function useWallet() {
  return useContext(WalletContext)
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>(defaultWallet)

  function deposit(amountCents: number) {
    setWallet(prev => ({
      ...prev,
      balanceCents: prev.balanceCents + amountCents,
      transactions: [
        { hash: `0xMOCK_DEP_${Date.now().toString(16)}`, amount: amountCents, type: "deposit", timestamp: Date.now() },
        ...prev.transactions,
      ],
    }))
  }

  function debit(amountCents: number) {
    setWallet(prev => ({
      ...prev,
      balanceCents: prev.balanceCents - amountCents,
      transactions: [
        { hash: `0xMOCK_BET_${Date.now().toString(16)}`, amount: amountCents, type: "bet", timestamp: Date.now() },
        ...prev.transactions,
      ],
    }))
  }

  function credit(amountCents: number) {
    setWallet(prev => ({
      ...prev,
      balanceCents: prev.balanceCents + amountCents,
      transactions: [
        { hash: `0xMOCK_PAY_${Date.now().toString(16)}`, amount: amountCents, type: "payout", timestamp: Date.now() },
        ...prev.transactions,
      ],
    }))
  }

  return (
    <WalletContext.Provider value={{ wallet, deposit, debit, credit }}>
      {children}
    </WalletContext.Provider>
  )
}
