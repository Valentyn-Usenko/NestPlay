import React from 'react'

function rarityClass(
  rarity
) {
  return rarity
    ? `achievement-rarity-${rarity}`
    : 'achievement-rarity-hidden'
}

export default function FeaturedBadges({
  badges = [],
  onOpen
}) {
  if (!badges.length) {
    return null
  }

  return (
    <div
      className="profile-featured-badges"
      aria-label="Featured achievements"
    >
      {badges.map(badge => {
        const tooltipId =
          `featured-achievement-${badge.id}`

        return (
          <div
            key={badge.id}
            className="featured-badge-wrap"
          >
            <button
              type="button"
              className={`featured-badge ${rarityClass(
                badge.rarity
              )}`}
              onClick={onOpen}
              aria-describedby={tooltipId}
            >
              <span
                className="featured-badge-icon"
                aria-hidden="true"
              >
                {badge.icon || '◆'}
              </span>

              <span className="featured-badge-name">
                {badge.name}
              </span>

              <span className="featured-badge-rarity">
                {badge.rarity || 'Hidden'}
              </span>
            </button>

            <span
              id={tooltipId}
              role="tooltip"
              className="achievement-tooltip"
            >
              {badge.description}
            </span>
          </div>
        )
      })}
    </div>
  )
}
