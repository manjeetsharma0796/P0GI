"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { io, Socket } from "socket.io-client"

/**
 * Resolve the socket.io server URL in order:
 *   1. `NEXT_PUBLIC_SOCKET_URL` env override
 *   2. GitHub Codespaces — port-subdomain swap (`-3000.app.github.dev` → `-3001.app.github.dev`)
 *   3. Generic same-host-different-port (covers Cloudflare Tunnel, local-dev,
 *      most Docker setups when client and server share a hostname)
 */
function resolveSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL
  if (typeof window === "undefined") return "http://localhost:3001"

  const host = window.location.hostname
  const proto = window.location.protocol

  // GitHub Codespaces pattern: swap the `-<port>.` subdomain segment.
  // e.g. "ominous-space-train-xxx-3000.app.github.dev"
  //   →  "ominous-space-train-xxx-3001.app.github.dev"
  const m = host.match(/^(.*)-(\d+)(\.(?:app\.github\.dev|github\.dev|githubpreview\.dev))$/)
  if (m) {
    return `${proto}//${m[1]}-3001${m[3]}`
  }

  return `${proto}//${host}:3001`
}

interface SocketContextType {
  socket: Socket | null
  connected: boolean
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false })

export function useSocket() {
  return useContext(SocketContext)
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const url = resolveSocketUrl()
    const s = io(url, { autoConnect: true, transports: ["websocket", "polling"] })
    s.on("connect", () => setConnected(true))
    s.on("disconnect", () => setConnected(false))
    setSocket(s)
    return () => { s.disconnect() }
  }, [])

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  )
}
