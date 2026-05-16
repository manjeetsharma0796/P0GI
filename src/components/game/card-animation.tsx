"use client"

import { useState, useEffect, useCallback } from "react"
import { CardBack } from "./playing-card"

const SEAT_TARGETS = [
  { x: 12, y: 72 },   // front-left
  { x: 36, y: 82 },   // front center-left
  { x: 64, y: 82 },   // front center-right
  { x: 88, y: 72 },   // front-right
]

const DEALER_POS = { x: 50, y: 30 }

interface FlyingCard {
  id: number
  seatIndex: number
  cardIndex: number
  startTime: number
}

interface CardDealAnimationProps {
  agentCount: number
  handNumber: number
  onDealComplete?: () => void
}

export function CardDealAnimation({
  agentCount,
  handNumber,
  onDealComplete,
}: CardDealAnimationProps) {
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([])
  const [animating, setAnimating] = useState(false)

  const startDeal = useCallback(() => {
    const cards: FlyingCard[] = []
    let id = 0
    const seatCount = Math.min(agentCount, SEAT_TARGETS.length)

    for (let round = 0; round < 2; round++) {
      for (let seat = 0; seat < seatCount; seat++) {
        cards.push({
          id: id++,
          seatIndex: seat,
          cardIndex: round,
          startTime: (round * seatCount + seat) * 150,
        })
      }
    }

    setFlyingCards(cards)
    setAnimating(true)

    const totalTime = cards.length * 150 + 400
    setTimeout(() => {
      setAnimating(false)
      setFlyingCards([])
      onDealComplete?.()
    }, totalTime)
  }, [agentCount, onDealComplete])

  useEffect(() => {
    if (handNumber > 0) {
      startDeal()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handNumber])

  if (!animating || flyingCards.length === 0) return null

  return (
    <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
      {flyingCards.map((fc) => {
        const target = SEAT_TARGETS[fc.seatIndex]
        const offsetX = fc.cardIndex === 1 ? 3 : -3

        return (
          <div
            key={fc.id}
            className="absolute"
            style={{
              left: `${DEALER_POS.x}%`,
              top: `${DEALER_POS.y}%`,
              transform: "translate(-50%, -50%)",
              animation: `deal-fly ${400}ms ease-out ${fc.startTime}ms forwards`,
              ["--deal-tx" as string]: `${target.x + offsetX - DEALER_POS.x}vmin`,
              ["--deal-ty" as string]: `${target.y - DEALER_POS.y}vmin`,
            }}
          >
            <CardBack className="opacity-0 animate-[deal-card-appear_100ms_ease-out_forwards]" />
          </div>
        )
      })}
    </div>
  )
}
