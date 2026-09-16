import React, {
  useEffect,
  useState
} from 'react'

import {
  createPost
} from '../api'

import {
  getAuthAccessToken
} from '../authSession'

import {
  API_BASE_URL
} from '../config'

import useEscapeKey from '../hooks/useEscapeKey'


const MAX_POLL_OPTIONS = 6


function newPollOptions() {
  return [
    {
      id: crypto.randomUUID(),
      value: ''
    },
    {
      id: crypto.randomUUID(),
      value: ''
    }
  ]
}


export default function PostModal({
  session,
  onClose,
  onCreated,
  initialGame = null
}) {
  const [
    contentType,
    setContentType
  ] = useState('post')

  const [
    title,
    setTitle
  ] = useState('')

  const [
    content,
    setContent
  ] = useState('')

  const [
    pollOptions,
    setPollOptions
  ] = useState(
    newPollOptions
  )

  const [
    pollDuration,
    setPollDuration
  ] = useState('7d')

  const [
    validationError,
    setValidationError
  ] = useState('')


  const [
    showPollContext,
    setShowPollContext
  ] = useState(false)

  const [
    showPollGameSearch,
    setShowPollGameSearch
  ] = useState(false)

  const [
    query,
    setQuery
  ] = useState('')

  const [
    games,
    setGames
  ] = useState([])

  const [
    loadingGames,
    setLoadingGames
  ] = useState(false)

  const [
    creating,
    setCreating
  ] = useState(false)


  const normalizeInitialGame =
    game => {
      if (!game) {
        return null
      }

      return {
        id:
          game.id ??
          game.game_id ??
          null,

        name:
          game.name ??
          game.game_name ??
          '',

        background_image:
          game.gameArtUrl ??
          game.game_art_url ??
          game.background_image ??
          null
      }
    }


  const [
    selectedGame,
    setSelectedGame
  ] = useState(
    normalizeInitialGame(
      initialGame
    )
  )


  const gameLocked =
    Boolean(initialGame)


  const username =
    session?.user
      ?.user_metadata
      ?.username ||
    session?.user?.email ||
    'Anonymous'


  const isPoll =
    contentType === 'poll'


  useEscapeKey(
    onClose
  )


  // ==================================================
  // GAME SEARCH
  // ==================================================

  useEffect(() => {
    if (
      gameLocked ||
      !query.trim()
    ) {
      setGames([])
      return
    }

    let canceled =
      false

    const timeout =
      setTimeout(
        async () => {
          setLoadingGames(
            true
          )

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
              setGames(
                data.results ||
                []
              )
            }
          } catch (error) {
            console.error(
              'Game search failed:',
              error
            )

            if (!canceled) {
              setGames([])
            }
          } finally {
            if (!canceled) {
              setLoadingGames(
                false
              )
            }
          }
        },
        300
      )

    return () => {
      canceled =
        true

      clearTimeout(
        timeout
      )
    }
  }, [
    query,
    gameLocked
  ])


  // ==================================================
  // CONTENT TYPE
  // ==================================================

  function changeContentType(
    type
  ) {
    setContentType(
      type
    )

    if (
      type === 'poll' &&
      content.trim()
    ) {
      setShowPollContext(
        true
      )
    }

    setValidationError(
      ''
    )
  }


  // ==================================================
  // POLL OPTIONS
  // ==================================================

  function updatePollOption(
    id,
    value
  ) {
    setPollOptions(
      current =>
        current.map(
          option =>
            option.id === id
              ? {
                  ...option,
                  value
                }
              : option
        )
    )

    setValidationError(
      ''
    )
  }


  function addPollOption() {
    if (
      pollOptions.length >=
      MAX_POLL_OPTIONS
    ) {
      return
    }

    setPollOptions(
      current => [
        ...current,
        {
          id:
            crypto.randomUUID(),

          value:
            ''
        }
      ]
    )
  }


  function removePollOption(
    id
  ) {
    if (
      pollOptions.length <= 2
    ) {
      return
    }

    setPollOptions(
      current =>
        current.filter(
          option =>
            option.id !== id
        )
    )
  }


  function movePollOption(
    index,
    direction
  ) {
    const targetIndex =
      index + direction

    if (
      targetIndex < 0 ||
      targetIndex >=
        pollOptions.length
    ) {
      return
    }

    setPollOptions(
      current => {
        const next =
          [...current]

        const temporary =
          next[index]

        next[index] =
          next[targetIndex]

        next[targetIndex] =
          temporary

        return next
      }
    )
  }


  // ==================================================
  // VALIDATION
  // ==================================================

  function validatePoll() {
    const question =
      title.trim()

    if (!question) {
      return 'Enter a poll question.'
    }

    const options =
      pollOptions.map(
        option =>
          option.value.trim()
      )

    if (
      options.some(
        option =>
          !option
      )
    ) {
      return 'Every poll choice must have text.'
    }

    if (
      options.length < 2
    ) {
      return 'A poll needs at least 2 choices.'
    }

    const normalized =
      options.map(
        option =>
          option.toLowerCase()
      )

    if (
      new Set(
        normalized
      ).size !==
      normalized.length
    ) {
      return 'Poll choices must be different.'
    }

    return ''
  }


  // ==================================================
  // CREATE POST / POLL
  // ==================================================

  async function handleCreate(e) {
    e.preventDefault()

    setValidationError(
      ''
    )

    if (!session) {
      setValidationError(
        'You must be logged in to publish.'
      )
      return
    }

    if (isPoll) {
      const pollError =
        validatePoll()

      if (pollError) {
        setValidationError(
          pollError
        )
        return
      }
    } else {
      if (!title.trim()) {
        setValidationError(
          'Post title is required.'
        )
        return
      }

      if (!selectedGame) {
        setValidationError(
          'Select a game before publishing.'
        )
        return
      }
    }

    setCreating(
      true
    )

    const payload = {
      content_type:
        contentType,

      title:
        title.trim(),

      content:
        content.trim(),

      game_id:
        selectedGame?.id ||
        null,

      game_name:
        selectedGame?.name ||
        null,

      game_art_url:
        selectedGame
          ?.background_image ||
        null
    }

    if (isPoll) {
      payload.poll_options =
        pollOptions.map(
          option =>
            option.value.trim()
        )

      payload.poll_duration =
        pollDuration
    }

    try {
      const data =
        await createPost(
          payload
        )

      onCreated(
        data
      )
    } catch (error) {
      setValidationError(
        error.message ||
        'Could not publish.'
      )
    } finally {
      setCreating(
        false
      )
    }
  }


  const canPublish =
    session &&
    title.trim() &&
    !creating &&
    (
      isPoll
        ? pollOptions.length >= 2 &&
          pollOptions.every(
            option =>
              option.value.trim()
          )
        : Boolean(
            selectedGame
          )
    )


  return (
    <div className="modal-overlay">

      <div className="post-create-modal">

        <div className="post-create-header">

          <div>

            <h2>
              Create
            </h2>

            <p>
              Posting as{' '}
              <span>
                @{username}
              </span>
            </p>

          </div>


          <button
            type="button"
            className="post-create-close"
            onClick={
              onClose
            }
            aria-label="Close"
          >
            ×
          </button>

        </div>


        <form
          className="post-create-form"
          onSubmit={
            handleCreate
          }
        >

          <div
            className="post-type-selector"
            role="tablist"
            aria-label="Content type"
          >
            <button
              type="button"
              role="tab"
              aria-selected={
                contentType ===
                'post'
              }
              className={
                `post-type-tab${
                  contentType ===
                  'post'
                    ? ' active'
                    : ''
                }`
              }
              onClick={() =>
                changeContentType(
                  'post'
                )
              }
            >
              Post
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={
                contentType ===
                'poll'
              }
              className={
                `post-type-tab${
                  contentType ===
                  'poll'
                    ? ' active'
                    : ''
                }`
              }
              onClick={() =>
                changeContentType(
                  'poll'
                )
              }
            >
              Poll
            </button>
          </div>


          <label className="post-create-field">

            <span>
              {isPoll
                ? 'Poll Question'
                : 'Post Title'}

              <b>
                *
              </b>
            </span>

            <input
              required
              maxLength={
                isPoll
                  ? 240
                  : undefined
              }
              placeholder={
                isPoll
                  ? "What's your question?"
                  : "What's your post about?"
              }
              value={
                title
              }
              onChange={
                e => {
                  setTitle(
                    e.target.value
                  )

                  setValidationError(
                    ''
                  )
                }
              }
            />

          </label>


          {!isPoll && (
            <label className="post-create-field">

              <span>
                Your Opinion
              </span>

              <textarea
                placeholder="Share your thoughts..."
                value={
                  content
                }
                onChange={
                  e =>
                    setContent(
                      e.target.value
                    )
                }
                rows={5}
              />

            </label>
          )}


          {isPoll && (
            <div className="poll-optional-area">

              <div className="poll-optional-actions">

                {!showPollContext && (
                  <button
                    type="button"
                    className="poll-optional-toggle"
                    onClick={() =>
                      setShowPollContext(
                        true
                      )
                    }
                  >
                    + Add context
                  </button>
                )}


                {!gameLocked &&
                  !selectedGame &&
                  !showPollGameSearch && (
                  <button
                    type="button"
                    className="poll-optional-toggle"
                    onClick={() =>
                      setShowPollGameSearch(
                        true
                      )
                    }
                  >
                    + Add game
                  </button>
                )}

              </div>


              {showPollContext && (
                <div className="poll-optional-panel">

                  <label className="post-create-field">

                    <span>
                      Supporting Text

                      <small className="post-field-optional">
                        Optional
                      </small>
                    </span>

                    <textarea
                      placeholder="Add a little context..."
                      value={
                        content
                      }
                      onChange={
                        e =>
                          setContent(
                            e.target.value
                          )
                      }
                      rows={3}
                    />

                  </label>


                  <button
                    type="button"
                    className="poll-game-search-cancel"
                    onClick={() => {
                      setContent('')
                      setShowPollContext(false)
                    }}
                  >
                    Cancel
                  </button>

                </div>
              )}


              {selectedGame && (
                <div className="poll-game-chip">

                  {selectedGame
                    .background_image ? (
                    <img
                      src={
                        selectedGame
                          .background_image
                      }
                      alt=""
                    />
                  ) : (
                    <span className="poll-game-chip-icon">
                      🎮
                    </span>
                  )}


                  <div className="poll-game-chip-copy">

                    <small>
                      {gameLocked
                        ? 'Game Hub'
                        : 'Game'}
                    </small>

                    <strong>
                      {selectedGame.name}
                    </strong>

                  </div>


                  {!gameLocked && (
                    <button
                      type="button"
                      className="poll-game-chip-remove"
                      onClick={() => {
                        setSelectedGame(
                          null
                        )

                        setShowPollGameSearch(
                          false
                        )
                      }}
                      aria-label="Remove game"
                    >
                      ×
                    </button>
                  )}

                </div>
              )}


              {!gameLocked &&
                !selectedGame &&
                showPollGameSearch && (
                <div className="poll-optional-panel">

                  <div className="post-game-search">

                    <label className="post-create-field">

                      <span>
                        Add Game

                        <small className="post-field-optional">
                          Optional
                        </small>
                      </span>

                      <input
                        autoFocus
                        placeholder="Type a game name..."
                        value={
                          query
                        }
                        onChange={
                          e =>
                            setQuery(
                              e.target.value
                            )
                        }
                      />

                    </label>


                    {loadingGames && (
                      <div className="post-game-searching">
                        Searching...
                      </div>
                    )}


                    {games.length > 0 && (
                      <div className="post-game-results">

                        {games.map(
                          game => (
                            <button
                              type="button"
                              key={
                                game.id
                              }
                              className="post-game-result"
                              onClick={() => {
                                setSelectedGame(
                                  game
                                )

                                setGames([])
                                setQuery('')

                                setShowPollGameSearch(
                                  false
                                )
                              }}
                            >

                              {game.background_image ? (
                                <img
                                  src={
                                    game.background_image
                                  }
                                  alt={
                                    game.name
                                  }
                                />
                              ) : (
                                <div className="post-game-result-placeholder">
                                  🎮
                                </div>
                              )}

                              <span>
                                {game.name}
                              </span>

                            </button>
                          )
                        )}

                      </div>
                    )}


                    <button
                      type="button"
                      className="poll-game-search-cancel"
                      onClick={() => {
                        setShowPollGameSearch(
                          false
                        )

                        setGames([])
                        setQuery('')
                      }}
                    >
                      Cancel
                    </button>

                  </div>

                </div>
              )}

            </div>
          )}


          {isPoll && (
            <div className="poll-create-section">

              <div className="poll-create-heading">
                <span>
                  Choices
                  <b>
                    *
                  </b>
                </span>

                <small>
                  {pollOptions.length}/
                  {MAX_POLL_OPTIONS}
                </small>
              </div>


              <div className="poll-create-options">

                {pollOptions.map(
                  (
                    option,
                    index
                  ) => (
                    <div
                      className="poll-create-option"
                      key={
                        option.id
                      }
                    >
                      <input
                        value={
                          option.value
                        }
                        maxLength={200}
                        placeholder={
                          `Option ${index + 1}`
                        }
                        onChange={
                          e =>
                            updatePollOption(
                              option.id,
                              e.target.value
                            )
                        }
                      />

                      <div className="poll-option-controls">

                        <button
                          type="button"
                          onClick={() =>
                            movePollOption(
                              index,
                              -1
                            )
                          }
                          disabled={
                            index === 0
                          }
                          aria-label="Move option up"
                          title="Move up"
                        >
                          ↑
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            movePollOption(
                              index,
                              1
                            )
                          }
                          disabled={
                            index ===
                            pollOptions.length -
                              1
                          }
                          aria-label="Move option down"
                          title="Move down"
                        >
                          ↓
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            removePollOption(
                              option.id
                            )
                          }
                          disabled={
                            pollOptions.length <=
                            2
                          }
                          aria-label="Remove option"
                          title="Remove"
                        >
                          ×
                        </button>

                      </div>

                    </div>
                  )
                )}

              </div>


              {pollOptions.length <
                MAX_POLL_OPTIONS && (
                <button
                  type="button"
                  className="poll-add-option"
                  onClick={
                    addPollOption
                  }
                >
                  + Add option
                </button>
              )}


              <label className="post-create-field poll-duration-field">

                <span>
                  Poll duration
                </span>

                <select
                  value={
                    pollDuration
                  }
                  onChange={
                    e =>
                      setPollDuration(
                        e.target.value
                      )
                  }
                >
                  <option value="1d">
                    1 day
                  </option>

                  <option value="3d">
                    3 days
                  </option>

                  <option value="7d">
                    7 days
                  </option>

                  <option value="none">
                    No expiration
                  </option>
                </select>

              </label>

            </div>
          )}


          {!isPoll &&
            !gameLocked && (
            <div className="post-game-search">

              <label className="post-create-field">

                <span>
                  Search Game

                  {!isPoll && (
                    <b>
                      *
                    </b>
                  )}

                  {isPoll && (
                    <small className="post-field-optional">
                      Optional
                    </small>
                  )}
                </span>

                <input
                  placeholder={
                    isPoll
                      ? 'Add a game context...'
                      : 'Type a game name...'
                  }
                  value={
                    query
                  }
                  onChange={
                    e =>
                      setQuery(
                        e.target.value
                      )
                  }
                />

              </label>


              {loadingGames && (
                <div className="post-game-searching">
                  Searching...
                </div>
              )}


              {games.length >
                0 && (
                <div className="post-game-results">

                  {games.map(
                    game => (
                      <button
                        type="button"
                        key={
                          game.id
                        }
                        className="post-game-result"
                        onClick={() => {
                          setSelectedGame(
                            game
                          )

                          setGames([])
                          setQuery('')
                        }}
                      >

                        {game.background_image ? (
                          <img
                            src={
                              game.background_image
                            }
                            alt={
                              game.name
                            }
                          />
                        ) : (
                          <div className="post-game-result-placeholder">
                            🎮
                          </div>
                        )}

                        <span>
                          {
                            game.name
                          }
                        </span>

                      </button>
                    )
                  )}

                </div>
              )}

            </div>
          )}


          {!isPoll &&
            selectedGame && (
            <div className="selected-game-card">

              {selectedGame
                .background_image && (
                <img
                  src={
                    selectedGame
                      .background_image
                  }
                  alt={
                    selectedGame.name
                  }
                />
              )}


              <div className="selected-game-overlay">

                <span>
                  {gameLocked
                    ? 'Posting in'
                    : 'Selected Game'}
                </span>

                <strong>
                  {
                    selectedGame.name
                  }
                </strong>

              </div>


              {!gameLocked && (
                <button
                  type="button"
                  className="selected-game-remove"
                  onClick={() =>
                    setSelectedGame(
                      null
                    )
                  }
                >
                  × Remove
                </button>
              )}

            </div>
          )}


          {validationError && (
            <div className="post-create-error">
              {validationError}
            </div>
          )}


          <div className="post-create-actions">

            <button
              type="submit"
              className="post-create-publish"
              disabled={
                !canPublish
              }
            >
              {creating
                ? 'Publishing...'
                : isPoll
                  ? 'Post Poll'
                  : 'Publish Post'}
            </button>


            <button
              type="button"
              className="post-create-cancel"
              onClick={
                onClose
              }
            >
              Cancel
            </button>

          </div>

        </form>

      </div>

    </div>
  )
}
