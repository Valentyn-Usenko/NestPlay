import React, {
  useEffect,
  useRef,
  useState
} from 'react'

import '../achievements.css'

import {
  getAchievementToasts,
  markAchievementToastDelivered
} from '../api'

export default function AchievementToastHost({
  session
}) {
  const [queue, setQueue] =
    useState([])

  const knownIdsRef =
    useRef(new Set())

  useEffect(() => {
    if (!session) {
      setQueue([])
      knownIdsRef.current =
        new Set()

      return
    }

    let active = true

    async function loadToasts() {
      try {
        const result =
          await getAchievementToasts()

        if (!active) {
          return
        }

        const fresh =
          (result || []).filter(
            toast =>
              !knownIdsRef.current.has(
                String(toast.id)
              )
          )

        if (fresh.length === 0) {
          return
        }

        for (const toast of fresh) {
          knownIdsRef.current.add(
            String(toast.id)
          )
        }

        setQueue(prev => [
          ...prev,
          ...fresh
        ])
      } catch (error) {
        console.error(
          'Could not load achievement notifications:',
          error
        )
      }
    }

    loadToasts()

    const interval =
      setInterval(
        loadToasts,
        12000
      )

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [session?.user?.id])

  const current =
    queue[0] || null

  useEffect(() => {
    if (!current) {
      return
    }

    const timer =
      setTimeout(
        async () => {
          try {
            await markAchievementToastDelivered(
              current.id
            )
          } catch (error) {
            console.error(
              'Could not dismiss achievement notification:',
              error
            )
          } finally {
            setQueue(prev =>
              prev.filter(
                item =>
                  item.id !==
                  current.id
              )
            )
          }
        },
        5200
      )

    return () => {
      clearTimeout(timer)
    }
  }, [current])

  if (!current) {
    return null
  }

  return (
    <div
      className={`achievement-toast achievement-rarity-${current.rarity}`}
      role="status"
      aria-live="polite"
    >
      <div
        className="achievement-toast-icon"
        aria-hidden="true"
      >
        {current.icon || '◆'}
      </div>

      <div className="achievement-toast-copy">
        <span>
          Achievement Unlocked
        </span>

        <strong>
          {current.name}
        </strong>

        <p>
          {current.description}
        </p>
      </div>
    </div>
  )
}
