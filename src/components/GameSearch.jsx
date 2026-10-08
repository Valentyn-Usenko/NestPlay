import React, {
  useEffect,
  useId,
  useRef,
  useState
} from 'react'

import {
  getAuthAccessToken
} from '../authSession'

import {
  API_BASE_URL
} from '../config'

import './GameSearch.css'


function uniqueGames(games) {
  const seen =
    new Set()

  return games.filter(game => {
    if (
      !game ||
      game.id == null ||
      !game.name
    ) {
      return false
    }

    const key =
      String(game.id)

    if (seen.has(key)) {
      return false
    }

    seen.add(key)

    return true
  })
}


export default function GameSearch({
  value,
  onChange,
  locked = false,
  required = false,
  label = 'Search Game'
}) {
  const [
    query,
    setQuery
  ] = useState('')

  const [
    results,
    setResults
  ] = useState([])

  const [
    loading,
    setLoading
  ] = useState(false)

  const [
    error,
    setError
  ] = useState('')

  const [
    isOpen,
    setIsOpen
  ] = useState(false)

  const [
    highlightedIndex,
    setHighlightedIndex
  ] = useState(-1)

  const [
    retryVersion,
    setRetryVersion
  ] = useState(0)

  const instanceId =
    useId()
      .replace(
        /:/g,
        ''
      )

  const inputRef =
    useRef(null)

  const resultRefs =
    useRef([])

  const requestIdRef =
    useRef(0)

  const trimmedQuery =
    query.trim()

  const canSearch =
    !locked &&
    !value &&
    trimmedQuery.length >= 2


  useEffect(() => {
    if (!canSearch) {
      requestIdRef.current += 1

      setResults([])
      setLoading(false)
      setError('')
      setHighlightedIndex(-1)

      return
    }

    const requestId =
      requestIdRef.current + 1

    requestIdRef.current =
      requestId

    const controller =
      new AbortController()

    const timeout =
      setTimeout(
        async () => {
          setLoading(true)
          setError('')
          setIsOpen(true)

          try {
            const accessToken =
              await getAuthAccessToken()

            if (!accessToken) {
              throw new Error(
                'Authentication required'
              )
            }

            const response =
              await fetch(
                `${API_BASE_URL}/api/games/search?q=${encodeURIComponent(
                  trimmedQuery
                )}`,
                {
                  headers: {
                    Authorization:
                      `Bearer ${accessToken}`
                  },

                  signal:
                    controller.signal
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

            if (
              controller.signal.aborted ||
              requestId !==
                requestIdRef.current
            ) {
              return
            }

            const nextResults =
              uniqueGames(
                Array.isArray(
                  data.results
                )
                  ? data.results
                  : []
              )

            setResults(
              nextResults
            )

            setHighlightedIndex(
              nextResults.length > 0
                ? 0
                : -1
            )
          } catch (searchError) {
            if (
              controller.signal.aborted ||
              requestId !==
                requestIdRef.current
            ) {
              return
            }

            console.error(
              'Game search failed:',
              searchError
            )

            setResults([])
            setHighlightedIndex(-1)
            setError(
              'Couldn’t load games.'
            )
          } finally {
            if (
              !controller.signal.aborted &&
              requestId ===
                requestIdRef.current
            ) {
              setLoading(false)
            }
          }
        },
        300
      )

    return () => {
      clearTimeout(
        timeout
      )

      controller.abort()
    }
  }, [
    canSearch,
    retryVersion,
    trimmedQuery
  ])


  useEffect(() => {
    if (
      highlightedIndex < 0
    ) {
      return
    }

    resultRefs.current[
      highlightedIndex
    ]?.scrollIntoView({
      block:
        'nearest'
    })
  }, [
    highlightedIndex
  ])


  function selectGame(
    game
  ) {
    onChange(game)

    setQuery('')
    setResults([])
    setError('')
    setIsOpen(false)
    setHighlightedIndex(-1)
  }


  function changeGame() {
    if (locked) {
      return
    }

    onChange(null)

    setQuery('')
    setResults([])
    setError('')
    setHighlightedIndex(-1)
    setIsOpen(false)

    setTimeout(
      () => {
        inputRef.current
          ?.focus()
      },
      0
    )
  }


  function handleKeyDown(
    event
  ) {
    if (
      event.key ===
      'Escape'
    ) {
      if (isOpen) {
        event.preventDefault()
        event.stopPropagation()

        setIsOpen(false)
      }

      return
    }

    if (
      !isOpen ||
      results.length === 0
    ) {
      return
    }

    if (
      event.key ===
      'ArrowDown'
    ) {
      event.preventDefault()

      setHighlightedIndex(
        current =>
          current < 0
            ? 0
            : Math.min(
                current + 1,
                results.length - 1
              )
      )

      return
    }

    if (
      event.key ===
      'ArrowUp'
    ) {
      event.preventDefault()

      setHighlightedIndex(
        current =>
          current <= 0
            ? 0
            : current - 1
      )

      return
    }

    if (
      event.key ===
      'Enter' &&
      highlightedIndex >= 0
    ) {
      event.preventDefault()

      selectGame(
        results[
          highlightedIndex
        ]
      )
    }
  }


  const showPanel =
    !locked &&
    !value &&
    isOpen &&
    trimmedQuery.length > 0

  const inputId =
    `game-search-input-${instanceId}`

  const listboxId =
    `game-search-results-${instanceId}`

  const activeDescendant =
    highlightedIndex >= 0 &&
    results[
      highlightedIndex
    ]
      ? `game-search-option-${instanceId}-${String(
          results[
            highlightedIndex
          ].id
        ).replace(
          /[^a-zA-Z0-9_-]/g,
          '-'
        )}`
      : undefined


  return (
    <div
      className="game-search"
      onBlur={event => {
        if (
          !event.currentTarget
            .contains(
              event.relatedTarget
            )
        ) {
          setIsOpen(false)
        }
      }}
    >
      {value ? (
        <div
          className={`game-search-selected ${
            locked
              ? 'is-locked'
              : ''
          }`}
        >
          {value
            .background_image ? (
            <img
              src={
                value
                  .background_image
              }
              alt=""
              aria-hidden="true"
              className="game-search-selected-art"
            />
          ) : (
            <div
              className="game-search-selected-art game-search-art-placeholder"
              aria-hidden="true"
            >
              🎮
            </div>
          )}

          <div className="game-search-selected-copy">
            <span>
              {locked
                ? 'Posting in'
                : 'Selected Game'}
            </span>

            <strong>
              {value.name}
            </strong>
          </div>

          {!locked && (
            <button
              type="button"
              className="game-search-change"
              onClick={
                changeGame
              }
            >
              Change
            </button>
          )}
        </div>
      ) : (
        <>
          <label
            className="game-search-label"
            htmlFor={
              inputId
            }
          >
            {label}

            {required && (
              <b>
                *
              </b>
            )}
          </label>

          <div className="game-search-picker">
            <div className="game-search-input-wrap">
              <span
                className="game-search-icon"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 24 24"
                  focusable="false"
                >
                  <path
                    d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>

              <input
                ref={
                  inputRef
                }
                id={
                  inputId
                }
                className="game-search-input"
                type="search"
                role="combobox"
                autoComplete="off"
                placeholder="Search games..."
                value={
                  query
                }
                aria-expanded={
                  showPanel
                }
                aria-controls={
                  listboxId
                }
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-activedescendant={
                  activeDescendant
                }
                onFocus={() => {
                  if (
                    trimmedQuery.length >
                    0
                  ) {
                    setIsOpen(
                      true
                    )
                  }
                }}
                onChange={event => {
                  setQuery(
                    event.target.value
                  )

                  setIsOpen(
                    event.target.value
                      .trim()
                      .length >
                      0
                  )
                }}
                onKeyDown={
                  handleKeyDown
                }
              />
            </div>

            {showPanel && (
              <div
                className="game-search-panel"
              >
                <div className="game-search-panel-header">
                  <span>
                    Results
                  </span>

                  {!loading &&
                    !error &&
                    trimmedQuery.length >=
                      2 &&
                    results.length >
                      0 && (
                      <span>
                        {
                          results.length
                        }
                      </span>
                    )}
                </div>

                {trimmedQuery.length <
                2 ? (
                  <div className="game-search-status">
                    Type at least 2 characters.
                  </div>
                ) : loading ? (
                  <div className="game-search-status game-search-loading">
                    <span
                      className="game-search-spinner"
                      aria-hidden="true"
                    />

                    Searching...
                  </div>
                ) : error ? (
                  <div className="game-search-status game-search-error">
                    <span>
                      {error}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setRetryVersion(
                          value =>
                            value + 1
                        )
                      }
                    >
                      Try again
                    </button>
                  </div>
                ) : results.length ===
                  0 ? (
                  <div className="game-search-status">
                    No games found for “
                    {trimmedQuery}
                    ”.
                  </div>
                ) : (
                  <div
                    id={
                      listboxId
                    }
                    className="game-search-results"
                    role="listbox"
                    aria-label="Game search results"
                  >
                    {results.map(
                      (
                        game,
                        index
                      ) => {
                        const optionId =
                          `game-search-option-${instanceId}-${String(
                            game.id
                          ).replace(
                            /[^a-zA-Z0-9_-]/g,
                            '-'
                          )}`

                        const highlighted =
                          index ===
                          highlightedIndex

                        return (
                          <button
                            key={
                              game.id
                            }
                            ref={
                              element => {
                                resultRefs
                                  .current[
                                  index
                                ] =
                                  element
                              }
                            }
                            id={
                              optionId
                            }
                            type="button"
                            role="option"
                            aria-selected={
                              highlighted
                            }
                            className={`game-search-result ${
                              highlighted
                                ? 'is-highlighted'
                                : ''
                            }`}
                            onMouseEnter={() =>
                              setHighlightedIndex(
                                index
                              )
                            }
                            onMouseDown={
                              event =>
                                event
                                  .preventDefault()
                            }
                            onClick={() =>
                              selectGame(
                                game
                              )
                            }
                          >
                            {game
                              .background_image ? (
                              <img
                                src={
                                  game
                                    .background_image
                                }
                                alt=""
                                aria-hidden="true"
                                className="game-search-result-art"
                              />
                            ) : (
                              <div
                                className="game-search-result-art game-search-art-placeholder"
                                aria-hidden="true"
                              >
                                🎮
                              </div>
                            )}

                            <span className="game-search-result-copy">
                              <strong>
                                {
                                  game.name
                                }
                              </strong>
                            </span>

                            <span
                              className="game-search-result-arrow"
                              aria-hidden="true"
                            >
                              ›
                            </span>
                          </button>
                        )
                      }
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
