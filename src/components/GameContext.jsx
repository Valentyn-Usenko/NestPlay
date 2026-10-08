import React, {
  useEffect,
  useState
} from 'react'

import {
  getGameContext
} from '../api'

import './GameContext.css'


export default function GameContext({
  gameId,
  gameName,
  gameArtUrl
}) {
  const [
    requestState,
    setRequestState
  ] = useState({
    gameId:
      null,

    context:
      null,

    error:
      false
  })

  const normalizedGameId =
    String(
      gameId || ''
    ).trim()

  const canLoadContext =
    normalizedGameId
      .startsWith(
        'igdb:'
      )


  useEffect(() => {
    let cancelled =
      false

    if (!canLoadContext) {
      return () => {
        cancelled =
          true
      }
    }

    getGameContext(
      normalizedGameId
    )
      .then(data => {
        if (!cancelled) {
          setRequestState({
            gameId:
              normalizedGameId,

            context:
              data || null,

            error:
              false
          })
        }
      })
      .catch(fetchError => {
        console.error(
          'Game context failed:',
          fetchError
        )

        if (!cancelled) {
          setRequestState({
            gameId:
              normalizedGameId,

            context:
              null,

            error:
              true
          })
        }
      })

    return () => {
      cancelled =
        true
    }
  }, [
    canLoadContext,
    normalizedGameId
  ])


  const requestMatches =
    canLoadContext &&
    requestState.gameId ===
      normalizedGameId

  const context =
    requestMatches
      ? requestState.context
      : null

  const loading =
    canLoadContext &&
    !requestMatches

  const error =
    requestMatches &&
    requestState.error

  const displayName =
    context?.game?.name ||
    gameName ||
    'Game'

  const artwork =
    gameArtUrl ||
    context?.game
      ?.background_image ||
    null

  const platforms =
    Array.isArray(
      context?.platforms
    )
      ? context.platforms
      : []

  if (
    !gameId &&
    !gameName &&
    !gameArtUrl
  ) {
    return null
  }


  return (
    <section
      className="game-context"
      aria-label={`Game context for ${displayName}`}
    >
      <div className="game-context-heading">
        <span>
          Game Context
        </span>

        <strong>
          {displayName}
        </strong>
      </div>

      {artwork && (
        <img
          className="game-context-art"
          src={
            artwork
          }
          alt={`${displayName} artwork`}
        />
      )}

      {loading && (
        <div
          className="game-context-status"
          role="status"
        >
          Loading store links…
        </div>
      )}

      {!loading &&
        error && (
        <div
          className="game-context-status"
          role="status"
        >
          Store links temporarily unavailable.
        </div>
      )}

      {!loading &&
        !error &&
        platforms.length >
          0 && (
        <div className="game-context-platforms">
          <span className="game-context-platforms-label">
            Available On
          </span>

          <div className="game-context-platform-list">
            {platforms.map(
              platform => (
                <a
                  key={
                    platform.key
                  }
                  className="game-context-platform-link"
                  href={
                    platform.url
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View ${displayName} on ${platform.label}`}
                >
                  <span>
                    {
                      platform.label
                    }
                  </span>

                  <span
                    className="game-context-external-icon"
                    aria-hidden="true"
                  >
                    ↗
                  </span>
                </a>
              )
            )}
          </div>
        </div>
      )}
    </section>
  )
}
