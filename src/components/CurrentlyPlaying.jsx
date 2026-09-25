import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  updateCurrentGames
} from '../api'

import {
  getAuthAccessToken
} from '../authSession'

import {
  API_BASE_URL
} from '../config'


function normalizeGame(game) {
  return {
    gameId:
      String(
        game?.gameId ??
        game?.game_id ??
        game?.id ??
        ''
      ),

    name:
      game?.name ??
      game?.game_name ??
      '',

    gameArtUrl:
      game?.gameArtUrl ??
      game?.game_art_url ??
      game?.background_image ??
      null
  }
}


export default function CurrentlyPlaying({
  games = [],
  editable = false,
  onChange
}) {
  const [editorOpen, setEditorOpen] =
    useState(false)

  const [draftGames, setDraftGames] =
    useState([])

  const [query, setQuery] =
    useState('')

  const [results, setResults] =
    useState([])

  const [searching, setSearching] =
    useState(false)

  const [saving, setSaving] =
    useState(false)


  const selectedIds =
    useMemo(
      () =>
        new Set(
          draftGames.map(
            game =>
              String(
                game.gameId
              )
          )
        ),
      [draftGames]
    )


  function openEditor() {
    setDraftGames(
      games.map(
        normalizeGame
      )
    )

    setQuery('')
    setResults([])
    setEditorOpen(true)
  }


  function closeEditor() {
    if (saving) {
      return
    }

    setEditorOpen(false)
    setQuery('')
    setResults([])
  }


  useEffect(() => {
    if (
      !editorOpen ||
      !query.trim() ||
      draftGames.length >= 3
    ) {
      setResults([])
      setSearching(false)
      return
    }

    let canceled = false

    const timeout =
      setTimeout(
        async () => {
          setSearching(true)

          try {
            const accessToken =
              await getAuthAccessToken()

            if (!accessToken) {
              throw new Error(
                'You must be logged in to search games.'
              )
            }

            const response =
              await fetch(
                `${API_BASE_URL}/api/games/search?q=${encodeURIComponent(
                  query.trim()
                )}`,
                {
                  headers: {
                    Authorization:
                      `Bearer ${accessToken}`
                  }
                }
              )

            const data =
              await response.json()

            if (!response.ok) {
              throw new Error(
                data.error ||
                'Game search failed'
              )
            }

            if (!canceled) {
              setResults(
                data.results ||
                []
              )
            }
          } catch (error) {
            console.error(
              'Current games search failed:',
              error
            )

            if (!canceled) {
              setResults([])
            }
          } finally {
            if (!canceled) {
              setSearching(false)
            }
          }
        },
        300
      )

    return () => {
      canceled = true
      clearTimeout(timeout)
    }
  }, [
    editorOpen,
    query,
    draftGames.length
  ])


  function addGame(game) {
    if (
      draftGames.length >= 3
    ) {
      return
    }

    const normalized =
      normalizeGame(game)

    if (
      !normalized.gameId ||
      selectedIds.has(
        normalized.gameId
      )
    ) {
      return
    }

    setDraftGames(
      current => [
        ...current,
        normalized
      ]
    )

    setQuery('')
    setResults([])
  }


  function removeGame(index) {
    setDraftGames(
      current =>
        current.filter(
          (_, itemIndex) =>
            itemIndex !== index
        )
    )
  }


  function moveGame(
    index,
    direction
  ) {
    const nextIndex =
      index + direction

    if (
      nextIndex < 0 ||
      nextIndex >=
        draftGames.length
    ) {
      return
    }

    setDraftGames(
      current => {
        const next =
          [...current]

        const temp =
          next[index]

        next[index] =
          next[nextIndex]

        next[nextIndex] =
          temp

        return next
      }
    )
  }


  async function saveGames() {
    setSaving(true)

    try {
      const response =
        await updateCurrentGames(
          draftGames.map(
            game => ({
              id:
                game.gameId,

              name:
                game.name,

              background_image:
                game.gameArtUrl
            })
          )
        )

      const nextGames =
        response?.currentGames ||
        []

      onChange?.(
        nextGames
      )

      setEditorOpen(false)
      setQuery('')
      setResults([])
    } catch (error) {
      console.error(
        'Could not update current games:',
        error
      )

      alert(
        'Could not update Currently Playing: ' +
        error.message
      )
    } finally {
      setSaving(false)
    }
  }


  if (
    !editable &&
    games.length === 0
  ) {
    return null
  }


  return (
    <div className="currently-playing">
      <div className="currently-playing-top">
        {games.length > 0 ? (
          <span className="currently-playing-label">
            Currently Playing
          </span>
        ) : (
          <span className="currently-playing-empty">
            What are you playing lately?
          </span>
        )}

        {editable && (
          <button
            type="button"
            className="currently-playing-manage"
            onClick={
              openEditor
            }
          >
            {games.length > 0
              ? 'Manage'
              : '+ Add game'}
          </button>
        )}
      </div>

      {games.length > 0 && (
        <div className="currently-playing-games">
          {games.map(
            game => (
              <div
                key={
                  `${game.source || 'manual'}-${game.gameId}`
                }
                className="currently-playing-chip"
                title={game.name}
              >
                {game.gameArtUrl && (
                  <img
                    src={
                      game.gameArtUrl
                    }
                    alt=""
                  />
                )}

                <span>
                  {game.name}
                </span>
              </div>
            )
          )}
        </div>
      )}

      {editorOpen && (
        <div
          className="current-games-backdrop"
          onClick={
            closeEditor
          }
        >
          <div
            className="current-games-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Currently Playing"
            onClick={
              event =>
                event.stopPropagation()
            }
          >
            <div className="current-games-modal-header">
              <div>
                <h3>
                  Currently Playing
                </h3>

                <p>
                  Pick up to three games
                  you are playing lately.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeEditor
                }
                disabled={
                  saving
                }
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <div className="current-games-count">
              {draftGames.length} / 3 selected
            </div>

            {draftGames.length > 0 && (
              <div className="current-games-selected">
                {draftGames.map(
                  (
                    game,
                    index
                  ) => (
                    <div
                      key={
                        game.gameId
                      }
                      className="current-game-selected-row"
                    >
                      {game.gameArtUrl && (
                        <img
                          src={
                            game.gameArtUrl
                          }
                          alt=""
                        />
                      )}

                      <span>
                        {game.name}
                      </span>

                      <div className="current-game-row-actions">
                        <button
                          type="button"
                          disabled={
                            index === 0
                          }
                          onClick={() =>
                            moveGame(
                              index,
                              -1
                            )
                          }
                        >
                          Up
                        </button>

                        <button
                          type="button"
                          disabled={
                            index ===
                            draftGames.length - 1
                          }
                          onClick={() =>
                            moveGame(
                              index,
                              1
                            )
                          }
                        >
                          Down
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            removeGame(
                              index
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

            {draftGames.length < 3 ? (
              <div className="current-games-search">
                <input
                  type="text"
                  value={
                    query
                  }
                  placeholder="Search for a game..."
                  onChange={
                    event =>
                      setQuery(
                        event.target.value
                      )
                  }
                />

                {searching && (
                  <div className="current-games-searching">
                    Searching...
                  </div>
                )}

                {!searching &&
                  results.length > 0 && (
                  <div className="current-games-results">
                    {results
                      .filter(
                        game =>
                          !selectedIds.has(
                            String(
                              game.id
                            )
                          )
                      )
                      .map(
                        game => (
                          <button
                            type="button"
                            key={
                              game.id
                            }
                            onClick={() =>
                              addGame(
                                game
                              )
                            }
                          >
                            {game.background_image && (
                              <img
                                src={
                                  game.background_image
                                }
                                alt=""
                              />
                            )}

                            <span>
                              {game.name}
                            </span>
                          </button>
                        )
                      )}
                  </div>
                )}
              </div>
            ) : (
              <p className="current-games-limit-note">
                Remove a game to add a different one.
              </p>
            )}

            <div className="current-games-modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={
                  closeEditor
                }
                disabled={
                  saving
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={
                  saveGames
                }
                disabled={
                  saving
                }
              >
                {saving
                  ? 'Saving...'
                  : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
