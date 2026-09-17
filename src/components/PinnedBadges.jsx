export default function PinnedBadges({
  badges = []
}) {
  if (!badges.length) {
    return null
  }

  return (
    <span className="pinned-badges">
      {badges
        .slice(0, 3)
        .map(badge => (
          <span
            key={badge.id}
            className={
              `pinned-badge pinned-badge-${(
                badge.rarity ||
                'common'
              ).toLowerCase()}`
            }
            title={`${badge.name} · ${badge.rarity}`}
            aria-label={
              `${badge.name} achievement`
            }
          >
            {badge.imageUrl ? (
              <img
                src={badge.imageUrl}
                alt=""
                className="pinned-badge-image"
              />
            ) : (
              <span
                aria-hidden="true"
              >
                {badge.icon || '◆'}
              </span>
            )}
          </span>
        ))}
    </span>
  )
}
