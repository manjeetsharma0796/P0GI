"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_ITEMS = [
  { href: "/agents", label: "Agents", icon: "\u{1F916}" },
  { href: "/skills", label: "Skills", icon: "\u26A1" },
  { href: "/lobby", label: "Lobby", icon: "\u{1F3AE}" },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-border bg-card flex-col h-screen sticky top-0">
        <div className="p-4 border-b border-border">
          <h1 className="text-lg font-bold text-white tracking-tight">AgentBet</h1>
          <p className="text-xs text-muted mt-0.5">AI Texas Hold&apos;em</p>
        </div>
        <nav className="flex-1 p-2 flex flex-col gap-1">
          {NAV_ITEMS.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  active
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:text-foreground hover:bg-card-hover"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-xs text-muted">agentbet-1 · Initia</span>
          </div>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-card border-t border-border flex items-center justify-around">
        {NAV_ITEMS.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-center w-12 h-12 rounded-lg text-2xl transition-colors duration-150 ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              {item.icon}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
