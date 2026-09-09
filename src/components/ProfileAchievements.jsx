import React, {
  useEffect,
  useState
} from 'react'

import '../achievements.css'

import {
  getUserAchievements
} from '../api'

import FeaturedBadges from './FeaturedBadges'
import AchievementsModal from './AchievementsModal'

export default function ProfileAchievements({
  userId,
  editable = false
}) {
  const [data, setData] =
    useState(null)

  const [loading, setLoading] =
    useState(true)

  const [open, setOpen] =
    useState(false)

  useEffect(() => {
    let active = true

    async function load() {
      if (!userId) {
        return
      }

      setLoading(true)

      try {
        const result =
          await getUserAchievements(
            userId
          )

        if (active) {
          setData(result)
        }
      } catch (error) {
        console.error(
          'Could not load achievements:',
          error
        )

        if (active) {
          setData(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [userId])

  if (
    !userId ||
    data?.private
  ) {
    return null
  }

  return (
    <div className="profile-achievements-summary">
      {!loading && (
        <FeaturedBadges
          badges={
            data?.featured || []
          }
          onOpen={() =>
            setOpen(true)
          }
        />
      )}

      <button
        type="button"
        className="profile-achievements-btn"
        onClick={() =>
          setOpen(true)
        }
        disabled={loading || !data}
      >
        <span>
          Achievements
        </span>

        <strong>
          {loading
            ? '…'
            : data?.totalUnlocked || 0}
        </strong>
      </button>

      {open && data && (
        <AchievementsModal
          data={data}
          editable={editable}
          onClose={() =>
            setOpen(false)
          }
          onDataChange={
            setData
          }
        />
      )}
    </div>
  )
}
