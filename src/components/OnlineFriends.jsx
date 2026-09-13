import {
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  getOnlineFriends
} from '../api'

import {
  getPresenceState,
  subscribePresence
} from '../presenceClient'

const MAX_SIDEBAR_FRIENDS = 6

const AVATAR_MAP = {
  purple:
    'linear-gradient(135deg, #646cff, #a78bfa)',
  red:
    'linear-gradient(135deg, #fc4646, #ff8c00)',
  green:
    'linear-gradient(135deg, #11998e, #38ef7d)',
  blue:
    'linear-gradient(135deg, #2193b0, #6dd5ed)',
  pink:
    'linear-gradient(135deg, #f953c6, #b91d73)',
  gold:
    'linear-gradient(135deg, #f7971e, #ffd200)'
}

function normalizeFriend(friend) {
  return {
    id: friend.id,
    username:
      friend.username ||
      'Unknown',
    avatar_url:
      friend.avatar_url ||
      null,
    avatar_color:
      friend.avatar_color ||
      'purple',
    lastActiveAt:
      friend.lastActiveAt ||
      friend.last_active_at ||
      new Date().toISOString()
  }
}

function sortFriends(friends) {
  return [...friends].sort(
    (left, right) => {
      const rightTime =
        new Date(
          right.lastActiveAt || 0
        ).getTime()

      const leftTime =
        new Date(
          left.lastActiveAt || 0
        ).getTime()

      if (
        rightTime !== leftTime
      ) {
        return rightTime - leftTime
      }

      return String(
        left.username || ''
      ).localeCompare(
        String(
          right.username || ''
        ),
        undefined,
        {
          sensitivity: 'base'
        }
      )
    }
  )
}

function FriendAvatar({
  friend
}) {
  const letter =
    (friend.username || '?')
      .charAt(0)
      .toUpperCase()

  if (friend.avatar_url) {
    return (
      <span className="online-friend-avatar-wrap">
        <img
          className="online-friend-avatar"
          src={friend.avatar_url}
          alt=""
        />

        <span
          className="online-presence-dot"
          aria-label="Online"
        />
      </span>
    )
  }

  const gradient =
    AVATAR_MAP[
      friend.avatar_color
    ] || AVATAR_MAP.purple

  return (
    <span className="online-friend-avatar-wrap">
      <span
        className="online-friend-avatar online-friend-avatar-fallback"
        style={{
          background: gradient
        }}
        aria-hidden="true"
      >
        {letter}
      </span>

      <span
        className="online-presence-dot"
        aria-label="Online"
      />
    </span>
  )
}

function FriendRow({
  friend,
  onOpenProfile
}) {
  return (
    <button
      type="button"
      className="online-friend-row"
      onClick={() =>
        onOpenProfile?.(
          friend.id
        )
      }
    >
      <FriendAvatar
        friend={friend}
      />

      <span className="online-friend-copy">
        <span className="online-friend-name">
          {friend.username}
        </span>

        <span className="online-friend-status">
          Online
        </span>
      </span>
    </button>
  )
}

export default function OnlineFriends({
  session,
  onOpenProfile
}) {
  const [friends, setFriends] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [showAll, setShowAll] =
    useState(false)

  const offlineTimersRef =
    useRef(new Map())

  function clearOfflineTimer(
    userId
  ) {
    const timer =
      offlineTimersRef.current
        .get(userId)

    if (timer) {
      clearTimeout(timer)
      offlineTimersRef.current
        .delete(userId)
    }
  }

  function upsertOnline(
    friend,
    lastActiveAt
  ) {
    if (!friend?.id) {
      return
    }

    clearOfflineTimer(
      friend.id
    )

    setFriends(current => {
      const normalized =
        normalizeFriend({
          ...friend,
          lastActiveAt
        })

      const exists =
        current.some(
          item =>
            item.id ===
            normalized.id
        )

      const next = exists
        ? current.map(
            item =>
              item.id ===
              normalized.id
                ? {
                    ...item,
                    ...normalized
                  }
                : item
          )
        : [
            ...current,
            normalized
          ]

      return sortFriends(next)
    })
  }

  function scheduleOffline(
    userId,
    graceMs
  ) {
    if (!userId) {
      return
    }

    clearOfflineTimer(userId)

    const timer = setTimeout(
      () => {
        offlineTimersRef.current
          .delete(userId)

        setFriends(current =>
          current.filter(
            friend =>
              friend.id !== userId
          )
        )
      },
      Math.max(
        0,
        Number(graceMs) ||
          12000
      )
    )

    offlineTimersRef.current
      .set(
        userId,
        timer
      )
  }

  useEffect(() => {
    if (!session) {
      setFriends([])
      setLoading(false)
      return undefined
    }

    let active = true

    const unsubscribe =
      subscribePresence(
        event => {
          if (
            event?.type !==
            'presence:update'
          ) {
            return
          }

          if (
            event.status ===
            'online'
          ) {
            upsertOnline(
              event.friend,
              event.lastActiveAt
            )
            return
          }

          if (
            event.status ===
              'recently_offline' ||
            event.status ===
              'offline'
          ) {
            scheduleOffline(
              event.friend?.id,
              event.graceMs
            )
          }
        }
      )

    async function load() {
      setLoading(true)

      try {
        const result =
          await getOnlineFriends()

        if (!active) {
          return
        }

        let next =
          (result?.friends || [])
            .map(normalizeFriend)

        const liveState =
          getPresenceState()

        for (
          const event of
          liveState.values()
        ) {
          const id =
            event?.friend?.id

          if (!id) {
            continue
          }

          if (
            event.status ===
            'online'
          ) {
            const normalized =
              normalizeFriend({
                ...event.friend,
                lastActiveAt:
                  event.lastActiveAt
              })

            next = [
              ...next.filter(
                item =>
                  item.id !== id
              ),
              normalized
            ]
          }
        }

        setFriends(
          sortFriends(next)
        )
      } catch (error) {
        console.error(
          'Could not load online friends:',
          error
        )

        if (active) {
          setFriends([])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
      unsubscribe()

      for (
        const timer of
        offlineTimersRef.current
          .values()
      ) {
        clearTimeout(timer)
      }

      offlineTimersRef.current
        .clear()
    }
  }, [session])

  const visibleFriends =
    useMemo(
      () =>
        friends.slice(
          0,
          MAX_SIDEBAR_FRIENDS
        ),
      [friends]
    )

  const hiddenCount =
    Math.max(
      0,
      friends.length -
        visibleFriends.length
    )

  if (!session) {
    return null
  }

  return (
    <section className="online-friends-card">
      <div className="online-friends-heading-row">
        <h3 className="online-friends-heading">
          Friends Online
        </h3>

        <span className="online-friends-count">
          {loading
            ? '—'
            : friends.length}
        </span>
      </div>

      {loading && (
        <div
          className="online-friends-skeleton-list"
          aria-label="Loading online friends"
        >
          {[0, 1, 2].map(
            item => (
              <div
                key={item}
                className="online-friend-skeleton"
              >
                <span />
                <span />
              </div>
            )
          )}
        </div>
      )}

      {!loading &&
        friends.length === 0 && (
          <p className="online-friends-empty">
            No friends online right now
          </p>
        )}

      {!loading &&
        visibleFriends.length > 0 && (
          <div className="online-friends-list">
            {visibleFriends.map(
              friend => (
                <FriendRow
                  key={friend.id}
                  friend={friend}
                  onOpenProfile={
                    onOpenProfile
                  }
                />
              )
            )}
          </div>
        )}

      {!loading &&
        hiddenCount > 0 && (
          <button
            type="button"
            className="online-friends-more"
            onClick={() =>
              setShowAll(true)
            }
          >
            +{hiddenCount} more
          </button>
        )}

      {showAll && (
        <div
          className="online-friends-modal-backdrop"
          onClick={() =>
            setShowAll(false)
          }
        >
          <div
            className="online-friends-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Friends online"
            onClick={event =>
              event.stopPropagation()
            }
          >
            <div className="online-friends-modal-header">
              <div>
                <strong>
                  Friends Online
                </strong>
                <span>
                  {friends.length}
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAll(false)
                }
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="online-friends-modal-list">
              {friends.map(
                friend => (
                  <FriendRow
                    key={friend.id}
                    friend={friend}
                    onOpenProfile={
                      userId => {
                        setShowAll(
                          false
                        )
                        onOpenProfile?.(
                          userId
                        )
                      }
                    }
                  />
                )
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
