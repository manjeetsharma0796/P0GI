"use client"

import { useState } from "react"
import Link from "next/link"

interface Room {
  id: string
  name: string
  host: string
  players: number
  maxPlayers: number
  blinds: string
  status: "waiting" | "playing"
  isPrivate: boolean
}

const MOCK_ROOMS: Room[] = [
  { id: "1", name: "Maniac's Den", host: "Llama", players: 3, maxPlayers: 4, blinds: "10/20", status: "waiting", isPrivate: false },
  { id: "2", name: "GTO Training", host: "DeepSeek", players: 4, maxPlayers: 4, blinds: "20/40", status: "playing", isPrivate: false },
  { id: "3", name: "High Rollers", host: "Mistral", players: 2, maxPlayers: 4, blinds: "50/100", status: "waiting", isPrivate: false },
]

export default function LobbyPage() {
  const [rooms] = useState<Room[]>(MOCK_ROOMS)
  const [showCreate, setShowCreate] = useState(false)
  const [newRoom, setNewRoom] = useState({ name: "", isPrivate: false, blinds: "10/20" })

  return (
    <div className="min-h-screen bg-[#060a10]">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Game Lobby</h1>
            <p className="text-sm text-[#666] mt-1">Join a table, spectate a game, or create your own room.</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="px-5 py-2.5 bg-gradient-to-r from-[#76b900] to-[#5a9400] hover:from-[#8dd100] hover:to-[#76b900] text-black text-sm font-bold rounded-xl transition-all duration-200 shadow-lg shadow-[#76b900]/20">
            + Create Room
          </button>
        </div>

        {showCreate && (
          <div className="bg-[#0c1018] border border-[#1a2236] rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">New Room</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] text-[#555] uppercase tracking-[0.12em] font-semibold mb-1 block">Room Name</label>
                <input value={newRoom.name} onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })} placeholder="My Poker Room" className="w-full bg-[#060a10] border border-[#1a2236] rounded-lg h-9 px-3 text-sm text-white placeholder:text-[#333] outline-none focus:border-[#2a3a56]" />
              </div>
              <div>
                <label className="text-[10px] text-[#555] uppercase tracking-[0.12em] font-semibold mb-1 block">Blinds</label>
                <select value={newRoom.blinds} onChange={(e) => setNewRoom({ ...newRoom, blinds: e.target.value })} className="w-full bg-[#060a10] border border-[#1a2236] rounded-lg h-9 px-3 text-sm text-white appearance-none cursor-pointer outline-none">
                  <option value="10/20">10/20 (Micro)</option>
                  <option value="20/40">20/40 (Low)</option>
                  <option value="50/100">50/100 (Medium)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[#555] uppercase tracking-[0.12em] font-semibold mb-1 block">Visibility</label>
                <div className="flex gap-2 h-9">
                  <button onClick={() => setNewRoom({ ...newRoom, isPrivate: false })} className={`flex-1 rounded-lg text-xs font-semibold transition-all ${!newRoom.isPrivate ? "bg-[#76b900]/20 text-[#76b900] border border-[#76b900]/30" : "bg-[#060a10] border border-[#1a2236] text-[#555]"}`}>Public</button>
                  <button onClick={() => setNewRoom({ ...newRoom, isPrivate: true })} className={`flex-1 rounded-lg text-xs font-semibold transition-all ${newRoom.isPrivate ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-[#060a10] border border-[#1a2236] text-[#555]"}`}>Private</button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-xs text-[#666] hover:text-white transition-colors">Cancel</button>
              <Link href="/game/new" className="px-6 py-2 bg-[#76b900] hover:bg-[#8dd100] text-black text-xs font-bold rounded-lg transition-colors">Create &amp; Enter</Link>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {rooms.map((room) => {
            const hasVacancy = room.players < room.maxPlayers
            const isPlaying = room.status === "playing"
            return (
              <div key={room.id} className="bg-[#0c1018] border border-[#1a2236] rounded-2xl p-5 hover:border-[#2a3a56] transition-all duration-200">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg shrink-0 ${isPlaying ? "bg-red-500/10 text-red-400" : "bg-[#76b900]/10 text-[#76b900]"}`}>
                    {room.isPrivate ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{room.name}</h3>
                      {room.isPrivate && <span className="text-[9px] uppercase tracking-wider text-amber-400 bg-amber-500/10 rounded px-1.5 py-0.5 font-bold">Private</span>}
                    </div>
                    <p className="text-xs text-[#555] mt-0.5">Host: {room.host} &middot; Blinds: {room.blinds}</p>
                  </div>
                  <div className="text-center shrink-0 mr-4">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: room.maxPlayers }).map((_, i) => (
                        <div key={i} className={`w-3 h-3 rounded-full ${i < room.players ? "bg-[#76b900]" : "bg-[#1a2236] border border-[#2a3a56]"}`} />
                      ))}
                    </div>
                    <p className="text-[10px] text-[#555] mt-1">{room.players}/{room.maxPlayers}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isPlaying ? (
                      <>
                        <span className="text-[10px] font-bold uppercase text-red-400 bg-red-500/10 rounded-full px-3 py-1 tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> Live
                        </span>
                        <Link href={`/game/${room.id}`} className="px-4 py-2 bg-[#1a2236] hover:bg-[#223050] border border-[#2a3a56] rounded-lg text-xs font-semibold text-white/70 hover:text-white transition-all">Spectate</Link>
                      </>
                    ) : hasVacancy ? (
                      <Link href={`/game/${room.id}`} className="px-5 py-2 bg-[#76b900] hover:bg-[#8dd100] text-black text-xs font-bold rounded-lg transition-colors">Join</Link>
                    ) : (
                      <Link href={`/game/${room.id}`} className="px-4 py-2 bg-[#1a2236] hover:bg-[#223050] border border-[#2a3a56] rounded-lg text-xs font-semibold text-white/70 hover:text-white transition-all">Spectate</Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-gradient-to-r from-[#76b900]/5 to-transparent border border-[#76b900]/10 rounded-2xl p-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Quick Play</h3>
            <p className="text-xs text-[#666] mt-0.5">Jump straight into a game with 4 AI agents and default settings.</p>
          </div>
          <Link href="/game/1" className="px-8 py-3 bg-gradient-to-r from-[#76b900] to-[#5a9400] hover:from-[#8dd100] hover:to-[#76b900] text-black text-sm font-bold rounded-xl transition-all duration-200 shadow-lg shadow-[#76b900]/20">Play Now</Link>
        </div>
      </div>
    </div>
  )
}
