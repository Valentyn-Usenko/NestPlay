import React, {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  deleteCommunityRating,
  getCommunityRating,
  setCommunityRating
} from '../api'

import './CommunityRating.css'


const STAR_VALUES = [
  1,
  2,
  3,
  4,
  5
]


function formatRatingCount(
  count
) {
  const safeCount =
    Number.isFinite(
      Number(count)
    )
      ? Number(count)
      : 0

  if (safeCount === 0) {
    return 'No ratings yet'
  }

  return `${safeCount.toLocaleString()} ${
    safeCount === 1
      ? 'rating'
      : 'ratings'
  }`
}


export default function CommunityRating({
  gameId,
  session,
  onRequireAuth,
  className = ''
}) {
  const normalizedGameId =
    String(
      gameId || ''
    ).trim()

  const canLoadRating =
    normalizedGameId
      .startsWith(
        'igdb:'
      )

  const sessionUserId =
    session?.user?.id ||
    null

  const [summary, setSummary] =
    useState({
      gameId:
        null,

      average:
        null,

      count:
        0,

      myRating:
        null
    })

  const [loading, setLoading] =
    useState(false)

  const [saving, setSaving] =
    useState(false)

  const [error, setError] =
    useState('')

  const [hoveredRating, setHoveredRating] =
    useState(null)


  useEffect(() => {
    let cancelled =
      false

    if (!canLoadRating) {
      setLoading(false)
      setError('')

      setSummary({
        gameId:
          normalizedGameId ||
          null,

        average:
          null,

        count:
          0,

        myRating:
          null
      })

      return () => {
        cancelled =
          true
      }
    }

    setLoading(true)
    setError('')

    getCommunityRating(
      normalizedGameId
    )
      .then(data => {
        if (cancelled) {
          return
        }

        setSummary({
          gameId:
            normalizedGameId,

          average:
            data?.average ??
            null,

          count:
            Number(
              data?.count || 0
            ),

          myRating:
            data?.myRating ??
            null
        })
      })
      .catch(fetchError => {
        console.error(
          'Community Rating failed:',
          fetchError
        )

        if (!cancelled) {
          setError(
            'Community Rating temporarily unavailable.'
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled =
        true
    }
  }, [
    canLoadRating,
    normalizedGameId,
    sessionUserId
  ])


  const average =
    summary.gameId ===
      normalizedGameId
      ? summary.average
      : null

  const count =
    summary.gameId ===
      normalizedGameId
      ? summary.count
      : 0

  const myRating =
    summary.gameId ===
      normalizedGameId
      ? summary.myRating
      : null

  const averageNumber =
    average === null ||
    average === undefined
      ? null
      : Number(average)

  const averageLabel =
    averageNumber === null ||
    Number.isNaN(
      averageNumber
    )
      ? '—'
      : averageNumber
          .toFixed(1)

  const averageFill =
    averageNumber === null ||
    Number.isNaN(
      averageNumber
    )
      ? 0
      : Math.min(
          100,
          Math.max(
            0,
            averageNumber /
              5 * 100
          )
        )

  const previewRating =
    hoveredRating ??
    myRating ??
    0

  const countLabel =
    useMemo(
      () =>
        formatRatingCount(
          count
        ),
      [count]
    )


  const requestAuth = () => {
    if (
      typeof onRequireAuth ===
      'function'
    ) {
      onRequireAuth()
    }
  }


  const chooseRating =
    async rating => {
      if (
        saving ||
        !canLoadRating
      ) {
        return
      }

      if (!session) {
        requestAuth()
        return
      }

      if (
        myRating === rating
      ) {
        return
      }

      setSaving(true)
      setError('')

      try {
        const data =
          await setCommunityRating(
            normalizedGameId,
            rating
          )

        setSummary({
          gameId:
            normalizedGameId,

          average:
            data?.average ??
            null,

          count:
            Number(
              data?.count || 0
            ),

          myRating:
            data?.myRating ??
            rating
        })
      } catch (saveError) {
        console.error(
          'Community Rating save failed:',
          saveError
        )

        setError(
          'Could not save your rating. Please try again.'
        )
      } finally {
        setSaving(false)
      }
    }


  const removeRating =
    async () => {
      if (
        saving ||
        !myRating ||
        !canLoadRating
      ) {
        return
      }

      if (!session) {
        requestAuth()
        return
      }

      setSaving(true)
      setError('')

      try {
        const data =
          await deleteCommunityRating(
            normalizedGameId
          )

        setSummary({
          gameId:
            normalizedGameId,

          average:
            data?.average ??
            null,

          count:
            Number(
              data?.count || 0
            ),

          myRating:
            null
        })
      } catch (deleteError) {
        console.error(
          'Community Rating delete failed:',
          deleteError
        )

        setError(
          'Could not remove your rating. Please try again.'
        )
      } finally {
        setSaving(false)
      }
    }


  if (!canLoadRating) {
    return null
  }


  return (
    <section
      className={`community-rating ${className}`.trim()}
      aria-label="Community Rating"
    >
      <div className="community-rating-summary">
        <div className="community-rating-heading">
          Community Rating
        </div>

        <div className="community-rating-score-row">
          <div
            className="community-rating-average-stars"
            aria-hidden="true"
          >
            <span className="community-rating-average-stars-base">
              ★★★★★
            </span>

            <span
              className="community-rating-average-stars-fill"
              style={{
                width:
                  `${averageFill}%`
              }}
            >
              ★★★★★
            </span>
          </div>

          <div className="community-rating-score-copy">
            <span className="community-rating-score-value">
              {loading
                ? '…'
                : averageLabel}
            </span>

            <span className="community-rating-score-scale">
              /5
            </span>
          </div>
        </div>

        <div className="community-rating-count">
          {loading
            ? 'Loading rating…'
            : countLabel}
        </div>
      </div>

      <div className="community-rating-user">
        <div className="community-rating-user-heading-row">
          <span className="community-rating-user-heading">
            Your Rating
          </span>

          {session &&
            myRating && (
            <button
              type="button"
              className="community-rating-remove"
              onClick={removeRating}
              disabled={saving}
            >
              Remove
            </button>
          )}
        </div>

        <div
          className="community-rating-input"
          onMouseLeave={() =>
            setHoveredRating(
              null
            )
          }
        >
          {STAR_VALUES.map(
            value => {
              const filled =
                value <=
                previewRating

              return (
                <button
                  key={value}
                  type="button"
                  className={`community-rating-star ${
                    filled
                      ? 'is-filled'
                      : ''
                  } ${
                    myRating ===
                      value
                      ? 'is-selected'
                      : ''
                  }`}
                  aria-label={`Rate ${value} out of 5 stars`}
                  aria-pressed={
                    myRating ===
                    value
                  }
                  disabled={saving}
                  onMouseEnter={() =>
                    setHoveredRating(
                      value
                    )
                  }
                  onFocus={() =>
                    setHoveredRating(
                      value
                    )
                  }
                  onBlur={() =>
                    setHoveredRating(
                      null
                    )
                  }
                  onClick={() =>
                    chooseRating(
                      value
                    )
                  }
                >
                  ★
                </button>
              )
            }
          )}
        </div>

        <div
          className="community-rating-user-status"
          role="status"
          aria-live="polite"
        >
          {saving
            ? 'Saving…'
            : session && myRating
              ? `You rated this ${myRating}/5`
              : session
                ? 'Select 1–5 stars'
                : 'Log in to rate this game'}
        </div>

        {error && (
          <div
            className="community-rating-error"
            role="status"
          >
            {error}
          </div>
        )}
      </div>
    </section>
  )
}
