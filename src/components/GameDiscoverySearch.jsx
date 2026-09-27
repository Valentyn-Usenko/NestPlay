import React, {
  useEffect,
  useState
} from 'react'

import {
  getDiscoveredGames
} from '../api'


export default function GameDiscoverySearch({
  onOpenGameHub
}) {
  const [query, setQuery] =
    useState('')

  const [games, setGames] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')


  useEffect(() => {
    let cancelled = false

    const timeout =
      setTimeout(
        async () => {
          setLoading(true)
          setError('')

          try {
            const data =
              await getDiscoveredGames(
                query
              )

            if (!cancelled) {
              setGames(
                Array.isArray(
                  data?.results
                )
                  ? data.results
                  : []
              )
            }
          } catch (fetchError) {
            console.error(
              'Game discovery failed:',
              fetchError
            )

            if (!cancelled) {
              setGames([])

              setError(
                'Could not load games.'
              )
            }
          } finally {
            if (!cancelled) {
              setLoading(false)
            }
          }
        },
        query.trim()
          ? 180
          : 0
      )

    return () => {
      cancelled = true

      clearTimeout(
        timeout
      )
    }
  }, [query])


  const openGame =
    game => {
      if (!onOpenGameHub) {
        return
      }

      onOpenGameHub({
        id:
          game.id,

        name:
          game.name,

        gameArtUrl:
          game.gameArtUrl ||
          null
      })
    }


  return (
    <div className="game-discovery-search">
      <input
        type="search"
        placeholder="Search games on NestPlay..."
        aria-label="Search games on NestPlay"
        value={query}
        onChange={event =>
          setQuery(
            event.target.value
          )
        }
        onKeyDown={event => {
          if (
            event.key ===
            'Escape'
          ) {
            event.currentTarget
              .blur()
          }
        }}
      />

      <div className="game-discovery-panel">
        <div className="game-discovery-heading">
          {query.trim()
            ? 'Matching games'
            : 'Games on NestPlay'}
        </div>

        {loading && (
          <div className="game-discovery-status">
            Loading games...
          </div>
        )}

        {!loading &&
          error && (
            <div className="game-discovery-status">
              {error}
            </div>
          )}

        {!loading &&
          !error &&
          games.length === 0 && (
            <div className="game-discovery-status">
              No tagged games found.
            </div>
          )}

        {!loading &&
          !error &&
          games.map(game => (
            <button
              key={
                game.id
              }
              type="button"
              className="game-discovery-result"
              onClick={() =>
                openGame(game)
              }
            >
              {game.gameArtUrl ? (
                <img
                  src={
                    game.gameArtUrl
                  }
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="game-discovery-placeholder">
                  ??
                </span>
              )}

              <span className="game-discovery-copy">
                <strong>
                  {game.name}
                </strong>

                <span>
                  {game.postCount}{' '}
                  {Number(
                    game.postCount
                  ) === 1
                    ? 'post'
                    : 'posts'}
                </span>
              </span>
            </button>
          ))}
      </div>
    </div>
  )
}
