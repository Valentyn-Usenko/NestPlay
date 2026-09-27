import React, {
  useEffect,
  useState
} from 'react'

import {
  getJoinedGameHubs
} from '../api'


function NavIcon({
  type
}) {
  const commonProps = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  }

  if (type === 'home') {
    return (
      <svg {...commonProps}>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10.5V20h13v-9.5" />
        <path d="M9.5 20v-5.5h5V20" />
      </svg>
    )
  }

  if (type === 'profile') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.7-4 3.1-6 7-6s6.3 2 7 6" />
      </svg>
    )
  }

  if (type === 'chats') {
    return (
      <svg {...commonProps}>
        <path d="M4 5.5h16v10H9l-5 4v-14Z" />
      </svg>
    )
  }

  if (type === 'settings') {
    return (
      <svg {...commonProps}>
        <path d="M9.7 3.2h4.6l.5 2 1.5.9 2-.6 2.3 4-1.5 1.4v1.8l1.5 1.4-2.3 4-2-.6-1.5.9-.5 2H9.7l-.5-2-1.5-.9-2 .6-2.3-4L4.9 12.7v-1.8L3.4 9.5l2.3-4 2 .6 1.5-.9.5-2Z" />
        <circle cx="12" cy="11.8" r="3.1" />
      </svg>
    )
  }

  return null
}


export default function LeftNavigationRail({
  session,
  activeItem = 'home',
  activeGameId = null,
  onHome,
  onProfile,
  onMessages,
  onSettings,
  onOpenGameHub,
  hubsRefreshKey = 0
}) {
  const [hubs, setHubs] =
    useState([])

  const [loadingHubs, setLoadingHubs] =
    useState(false)


  useEffect(() => {
    let active = true

    async function loadHubs() {
      if (!session) {
        setHubs([])
        return
      }

      setLoadingHubs(true)

      try {
        const result =
          await getJoinedGameHubs()

        if (active) {
          setHubs(
            Array.isArray(result)
              ? result
              : []
          )
        }
      } catch (error) {
        console.error(
          'Could not load joined hubs:',
          error
        )

        if (active) {
          setHubs([])
        }
      } finally {
        if (active) {
          setLoadingHubs(false)
        }
      }
    }

    loadHubs()

    return () => {
      active = false
    }
  }, [
    session,
    hubsRefreshKey
  ])


  const navButtonClass =
    item =>
      `left-rail-nav-item ${
        activeItem === item
          ? 'active'
          : ''
      }`


  return (
    <aside
      className="left-navigation-rail"
      aria-label="Primary navigation"
    >
      <div className="left-rail-inner">

        <nav
          className="left-rail-primary"
          aria-label="NestPlay navigation"
        >
          <button
            type="button"
            className={
              navButtonClass('home')
            }
            onClick={onHome}
            aria-current={
              activeItem === 'home'
                ? 'page'
                : undefined
            }
          >
            <span className="left-rail-nav-icon">
              <NavIcon type="home" />
            </span>

            <span>
              Home
            </span>
          </button>


          {session && (
            <>
              <button
                type="button"
                className={
                  navButtonClass(
                    'profile'
                  )
                }
                onClick={onProfile}
                aria-current={
                  activeItem === 'profile'
                    ? 'page'
                    : undefined
                }
              >
                <span className="left-rail-nav-icon">
                  <NavIcon type="profile" />
                </span>

                <span>
                  Profile
                </span>
              </button>
              <button
                type="button"
                className={
                  navButtonClass(
                    'chats'
                  )
                }
                onClick={
                  onMessages
                }
              >
                <span className="left-rail-nav-icon">
                  <NavIcon type="chats" />
                </span>

                <span>
                  Chats
                </span>
              </button>


              <button
                type="button"
                className={
                  navButtonClass(
                    'settings'
                  )
                }
                onClick={
                  onSettings
                }
              >
                <span className="left-rail-nav-icon">
                  <NavIcon type="settings" />
                </span>

                <span>
                  Settings
                </span>
              </button>
            </>
          )}
        </nav>


        {session && (
          <section
            className="left-rail-hubs"
            aria-labelledby="left-rail-hubs-title"
          >
            <h2
              id="left-rail-hubs-title"
              className="left-rail-section-title"
            >
              Your Hubs
            </h2>


            {loadingHubs ? (
              <div
                className="left-rail-hubs-loading"
                aria-label="Loading your hubs"
              >
                <span />
                <span />
                <span />
              </div>
            ) : hubs.length === 0 ? (
              <div className="left-rail-empty">
                No hubs yet
              </div>
            ) : (
              <div className="left-rail-hub-list">
                {hubs.map(hub => (
                  <button
                    key={hub.id}
                    type="button"
                    className={
                      `left-rail-hub-item ${
                        String(
                          activeGameId
                        ) ===
                        String(
                          hub.id
                        )
                          ? 'active'
                          : ''
                      }`
                    }
                    onClick={() =>
                      onOpenGameHub?.(
                        hub
                      )
                    }
                    aria-current={
                      String(
                        activeGameId
                      ) ===
                      String(
                        hub.id
                      )
                        ? 'page'
                        : undefined
                    }
                    title={hub.name}
                  >
                    {hub.gameArtUrl ? (
                      <img
                        src={
                          hub.gameArtUrl
                        }
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span
                        className="left-rail-hub-fallback"
                        aria-hidden="true"
                      >
                        ??
                      </span>
                    )}

                    <span className="left-rail-hub-name">
                      {hub.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

      </div>
    </aside>
  )
}
