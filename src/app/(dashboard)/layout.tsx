import { Sidebar } from "@/components/sidebar"
import { AgentStatusBar } from "@/components/agent-status-bar"
import { ConnectWalletButton } from "@/components/connect-wallet-button"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Top bar with agent status + wallet */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 bg-[#060a10]/80 backdrop-blur-sm border-b border-[#1a2236]/50">
          <AgentStatusBar />
          <ConnectWalletButton />
        </header>
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
      </div>
    </div>
  )
}
