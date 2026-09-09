import React, {
  useMemo,
  useState
} from 'react'

import {
  setFeaturedAchievements
} from '../api'

import useEscapeKey from '../hooks/useEscapeKey'

const CATEGORY_LABELS = {
  all: 'All',
  community: 'Community',
  discussion: 'Discussion',
  social: 'Social',
  discovery: 'Discovery',
  milestones: 'Milestones',
  contributions: 'Contributions',
  fun: 'Fun',
  special: 'Special',
  'game-mastery': 'Game Mastery'
}

const CATEGORY_ORDER = [
  'all',
  'community',
  'discussion',
  'social',
  'discovery',
  'milestones',
  'contributions',
  'fun',
  'special',
  'game-mastery'
]

const STATUS_FILTERS = [
  ['all', 'All'],
  ['unlocked', 'Unlocked'],
  ['locked', 'Locked'],
  ['featured', 'Featured']
]

const RARITY_ORDER = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4
}

function formatUnlockDate(
  value
) {
  if (!value) {
    return null
  }

  return new Date(
    value
  ).toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }
  )
}

function rarityClass(
  rarity
) {
  return rarity
    ? `achievement-rarity-${rarity}`
    : 'achievement-rarity-hidden'
}

function progressPercent(
  current,
  target
) {
  if (
    current == null ||
    target == null ||
    target <= 0
  ) {
    return 0
  }

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        (
          Number(current) /
          Number(target)
        ) * 100
      )
    )
  )
}

export default function AchievementsModal({
  data,
  editable = false,
  onClose,
  onDataChange
}) {
  useEscapeKey(onClose)

  const [category, setCategory] =
    useState('all')

  const [status, setStatus] =
    useState('all')

  const [saving, setSaving] =
    useState(false)

  const [replaceCandidate, setReplaceCandidate] =
    useState(null)

  const achievements =
    data?.achievements || []

  const featured =
    data?.featured || []

  const availableCategories =
    useMemo(() => {
      const found =
        new Set(
          achievements.map(
            item => item.category
          )
        )

      return CATEGORY_ORDER.filter(
        item =>
          item === 'all' ||
          found.has(item)
      )
    }, [achievements])

const filteredAchievements =
  useMemo(() => {
    return achievements
      .filter(
        achievement => {
          if (
            category !== 'all' &&
            achievement.category !==
              category
          ) {
            return false
          }

          if (
            status === 'unlocked' &&
            !achievement.unlocked
          ) {
            return false
          }

          if (
            status === 'locked' &&
            achievement.unlocked
          ) {
            return false
          }

          if (
            status === 'featured' &&
            !achievement.featuredOrder
          ) {
            return false
          }

          return true
        }
      )
      .sort((a, b) => {
        if (
          a.unlocked !== b.unlocked
        ) {
          return a.unlocked
            ? -1
            : 1
        }

        const aRarity =
          RARITY_ORDER[
            a.rarity
          ] ?? 99

        const bRarity =
          RARITY_ORDER[
            b.rarity
          ] ?? 99

        if (
          aRarity !== bRarity
        ) {
          return (
            aRarity -
            bRarity
          )
        }

        return a.name.localeCompare(
          b.name
        )
      })
  }, [
    achievements,
    category,
    status
  ])

  async function saveFeatured(
    ids
  ) {
    if (saving) {
      return
    }

    setSaving(true)

    try {
      const updated =
        await setFeaturedAchievements(
          ids
        )

      onDataChange?.(
        updated
      )

      setReplaceCandidate(
        null
      )
    } catch (error) {
      console.error(
        'Could not update featured achievements:',
        error
      )

      alert(
        'Could not update featured badges: ' +
        error.message
      )
    } finally {
      setSaving(false)
    }
  }

  function handleFeature(
    achievement
  ) {
    const ids =
      featured.map(
        item => item.id
      )

    if (
      ids.includes(
        achievement.id
      )
    ) {
      saveFeatured(
        ids.filter(
          id =>
            id !== achievement.id
        )
      )

      return
    }

    if (ids.length < 3) {
      saveFeatured([
        ...ids,
        achievement.id
      ])

      return
    }

    setReplaceCandidate(
      achievement
    )
  }

  function replaceFeatured(
    oldAchievementId
  ) {
    if (!replaceCandidate) {
      return
    }

    const ids =
      featured.map(item =>
        item.id ===
        oldAchievementId
          ? replaceCandidate.id
          : item.id
      )

    saveFeatured(ids)
  }

  function moveFeatured(
    achievementId,
    direction
  ) {
    const ids =
      featured.map(
        item => item.id
      )

    const index =
      ids.indexOf(
        achievementId
      )

    const targetIndex =
      index + direction

    if (
      index < 0 ||
      targetIndex < 0 ||
      targetIndex >= ids.length
    ) {
      return
    }

    const next = [...ids]

    const temp =
      next[index]

    next[index] =
      next[targetIndex]

    next[targetIndex] = temp

    saveFeatured(next)
  }

  return (
    <div
      className="modal-overlay achievement-modal-overlay"
      onMouseDown={onClose}
    >
      <section
        className="modal achievements-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievements-title"
        onMouseDown={event =>
          event.stopPropagation()
        }
      >
        <button
          type="button"
          className="close-btn"
          onClick={onClose}
          aria-label="Close achievements"
        >
          ×
        </button>

        <header className="achievements-modal-header">
          <div>
            <span className="achievements-eyebrow">
              Profile collection
            </span>

            <h2 id="achievements-title">
              Achievements
            </h2>

            <p>
              {data?.totalUnlocked || 0}{' '}
              unlocked
            </p>
          </div>
        </header>

        {editable &&
          featured.length > 0 && (
          <section className="featured-manager">
            <div className="featured-manager-heading">
              <div>
                <strong>
                  Featured on profile
                </strong>
                <span>
                  Up to 3 badges
                </span>
              </div>
            </div>

            <div className="featured-manager-list">
              {featured.map(
                (
                  badge,
                  index
                ) => (
                  <div
                    key={badge.id}
                    className={`featured-manager-item ${rarityClass(
                      badge.rarity
                    )}`}
                  >
                    <span
                      className="achievement-card-icon"
                      aria-hidden="true"
                    >
                      {badge.icon}
                    </span>

                    <span className="featured-manager-name">
                      {badge.name}
                    </span>

                    <div className="featured-manager-actions">
                      <button
                        type="button"
                        onClick={() =>
                          moveFeatured(
                            badge.id,
                            -1
                          )
                        }
                        disabled={
                          saving ||
                          index === 0
                        }
                        aria-label={`Move ${badge.name} earlier`}
                      >
                        ←
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          moveFeatured(
                            badge.id,
                            1
                          )
                        }
                        disabled={
                          saving ||
                          index ===
                            featured.length - 1
                        }
                        aria-label={`Move ${badge.name} later`}
                      >
                        →
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {replaceCandidate && (
          <section
            className="achievement-replace-panel"
            aria-live="polite"
          >
            <div>
              <strong>
                Choose a badge to replace
              </strong>

              <span>
                Feature {replaceCandidate.name}
              </span>
            </div>

            <div className="achievement-replace-options">
              {featured.map(
                badge => (
                  <button
                    type="button"
                    key={badge.id}
                    disabled={saving}
                    onClick={() =>
                      replaceFeatured(
                        badge.id
                      )
                    }
                  >
                    Replace {badge.name}
                  </button>
                )
              )}

              <button
                type="button"
                className="achievement-replace-cancel"
                onClick={() =>
                  setReplaceCandidate(
                    null
                  )
                }
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        <div className="achievement-category-tabs">
          {availableCategories.map(
            item => (
              <button
                type="button"
                key={item}
                className={
                  category === item
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setCategory(item)
                }
              >
                {CATEGORY_LABELS[item] ||
                  item}
              </button>
            )
          )}
        </div>

        <div className="achievement-status-filters">
          {STATUS_FILTERS.map(
            ([value, label]) => (
              <button
                type="button"
                key={value}
                className={
                  status === value
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setStatus(value)
                }
              >
                {label}
              </button>
            )
          )}
        </div>

        <div className="achievement-grid">
          {filteredAchievements.map(
            (achievement, index) => {
              const percent =
                progressPercent(
                  achievement.currentValue,
                  achievement.targetValue
                )

              const hasProgress =
                !achievement.unlocked &&
                achievement.currentValue != null &&
                achievement.targetValue != null

              const unlockDate =
                formatUnlockDate(
                  achievement.unlockedAt
                )

              const previousAchievement =
                filteredAchievements[index - 1]

              const showSectionHeading =
                index === 0 || previousAchievement?.unlocked !== achievement.unlocked

              return (
                <React.Fragment key={achievement.id}>
                  {showSectionHeading && (
                    <div className="achievement-section-heading">
                      {achievement.unlocked
                        ? 'Unlocked'
                        : 'Locked'}
                    </div>
                  )}

                  <article
                    className={`achievement-card ${rarityClass(
                      achievement.rarity
                    )} ${
                      achievement.unlocked
                        ? 'unlocked'
                        : 'locked'
                    }`}
                  >
                        <div className="achievement-card-top">
                    <div
                      className="achievement-card-icon"
                      aria-label={`${achievement.name} icon`}
                      role="img"
                    >
                      {achievement.icon || '◆'}
                    </div>

                    <div className="achievement-card-heading">
                      <h3>
                        {achievement.name}
                      </h3>

                      <span className="achievement-rarity-label">
                        {achievement.rarity
                          ? achievement.rarity
                          : 'Hidden'}
                      </span>
                    </div>

                    <span
                      className="achievement-state-icon"
                      aria-label={
                        achievement.unlocked
                          ? 'Unlocked'
                          : 'Locked'
                      }
                    >
                      {achievement.unlocked
                        ? '✓'
                        : '○'}
                    </span>
                  </div>

                  <p className="achievement-description">
                    {achievement.description}
                  </p>

                  {achievement.gameId &&
                    achievement.metadata
                      ?.gameName && (
                    <div className="achievement-game-context">
                      {achievement.metadata
                        .gameArtUrl && (
                        <img
                          src={
                            achievement.metadata
                              .gameArtUrl
                          }
                          alt=""
                        />
                      )}

                      <span>
                        {
                          achievement.metadata
                            .gameName
                        }
                      </span>
                    </div>
                  )}

                  {hasProgress && (
                    <div className="achievement-progress-block">
                      <div className="achievement-progress-copy">
                        <span>
                          Progress
                        </span>

                        <strong>
                          {achievement.currentValue}{' '}
                          /{' '}
                          {achievement.targetValue}
                        </strong>
                      </div>

                      <div
                        className="achievement-progress-track"
                        role="progressbar"
                        aria-valuemin="0"
                        aria-valuemax={
                          achievement.targetValue
                        }
                        aria-valuenow={
                          achievement.currentValue
                        }
                        aria-label={`${achievement.name} progress`}
                      >
                        <span
                          style={{
                            width:
                              `${percent}%`
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {achievement.unlocked && (
                    <div className="achievement-unlocked-copy">
                      <strong>
                        ✓ Unlocked
                      </strong>

                      {unlockDate && (
                        <span>
                          {unlockDate}
                        </span>
                      )}
                    </div>
                  )}

                  {editable &&
                    achievement.unlocked && (
                    <button
                      type="button"
                      className={`achievement-feature-btn ${
                        achievement.featuredOrder
                          ? 'featured'
                          : ''
                      }`}
                      disabled={saving}
                      onClick={() =>
                        handleFeature(
                          achievement
                        )
                      }
                    >
                      {achievement.featuredOrder
                        ? 'Remove from Featured'
                        : 'Feature on Profile'}
                    </button>
                  )}
                </article>
                </React.Fragment>
              )
            }
          )}
        </div>

        {filteredAchievements.length === 0 && (
          <div className="achievement-empty-state">
            No achievements match these filters.
          </div>
        )}
      </section>
    </div>
  )
}
