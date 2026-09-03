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


export default function PostModal({
  session,
  onClose,
  onCreated
}) {
  const [
    title,
    setTitle
  ] = useState('')

  const [
    content,
    setContent
  ] = useState('')

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
    selectedGame,
    setSelectedGame
  ] = useState(null)

  const [
    creating,
    setCreating
  ] = useState(false)


  const username =
    session?.user
      ?.user_metadata
      ?.username ||
    session?.user?.email ||
    'Anonymous'


  // ==================================================
  // GAME SEARCH
  //
  // Browser
  // ↓
  // NestPlay backend
  // ↓
  // RAWG
  //
  // RAWG API key never reaches the browser.
  // ==================================================

  useEffect(() => {
    if (!query.trim()) {
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

            const res =
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

            const json =
              await res.json()

            if (!res.ok) {
              throw new Error(
                json.error ||
                'Game search failed'
              )
            }

            if (!canceled) {
              setGames(
                json.results ||
                []
              )
            }
          } catch (error) {
            console.error(
              'Game search failed',
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
  }, [query])


  // ==================================================
  // CREATE POST
  // ==================================================

  async function handleCreate(e) {
    e.preventDefault()

    if (
      !title ||
      !selectedGame ||
      !session
    ) {
      return
    }

    setCreating(
      true
    )

    const payload = {
      title,
      content,

      game_id:
        selectedGame.id ||
        null,

      game_name:
        selectedGame.name ||
        null,

      game_art_url:
        selectedGame.background_image ||
        null
    }

    try {
      const data =
        await createPost(
          payload
        )

      onCreated(
        data
      )

      onClose()
    } catch (error) {
      alert(
        'Error creating post: ' +
        error.message
      )
    } finally {
      setCreating(
        false
      )
    }
  }


  const inputStyle = {
    width:
      '100%',

    boxSizing:
      'border-box',

    padding:
      '0.7rem 0.9rem',

    borderRadius:
      '8px',

    border:
      '1px solid #2e2e2e',

    background:
      '#0d0d0d',

    color:
      '#fff',

    fontSize:
      '0.95rem',

    outline:
      'none',

    transition:
      'border-color 0.2s'
  }

  useEscapeKey(onClose)

  const labelStyle = {
    display:
      'flex',

    flexDirection:
      'column',

    gap:
      '0.4rem',

    fontSize:
      '0.78rem',

    fontWeight:
      '600',

    color:
      '#888',

    textTransform:
      'uppercase',

    letterSpacing:
      '0.5px'
  }


  return (
    <div className="modal-overlay">
      <div
        className="modal"
        style={{
          maxWidth:
            '560px',

          padding:
            '2rem',

          borderRadius:
            '16px',

          border:
            '1px solid #222'
        }}
      >
        <div
          style={{
            display:
              'flex',

            justifyContent:
              'space-between',

            alignItems:
              'flex-start',

            marginBottom:
              '1.5rem'
          }}
        >
          <div>
            <h2
              style={{
                margin:
                  0,

                fontSize:
                  '1.3rem',

                fontWeight:
                  '700'
              }}
            >
              Create a Post
            </h2>

            <p
              style={{
                margin:
                  '0.25rem 0 0 0',

                fontSize:
                  '0.82rem',

                color:
                  '#555'
              }}
            >
              Posting as{' '}

              <span
                style={{
                  color:
                    '#646cff',

                  fontWeight:
                    '600'
                }}
              >
                @{username}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            style={{
              background:
                'none',

              border:
                '1px solid #2e2e2e',

              color:
                '#aaa',

              borderRadius:
                '8px',

              width:
                '32px',

              height:
                '32px',

              cursor:
                'pointer',

              fontSize:
                '1rem',

              display:
                'flex',

              alignItems:
                'center',

              justifyContent:
                'center'
            }}
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={
            handleCreate
          }
          style={{
            display:
              'flex',

            flexDirection:
              'column',

            gap:
              '1.1rem'
          }}
        >
          <label
            style={
              labelStyle
            }
          >
            Post Title

            <span
              style={{
                color:
                  '#fc4646'
              }}
            >
              *
            </span>

            <input
              required
              placeholder="What's your post about?"
              value={
                title
              }
              onChange={
                e =>
                  setTitle(
                    e.target.value
                  )
              }
              style={
                inputStyle
              }
            />
          </label>

          <label
            style={
              labelStyle
            }
          >
            Your Opinion

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
              rows={4}
              style={{
                ...inputStyle,

                resize:
                  'vertical',

                fontFamily:
                  'inherit'
              }}
            />
          </label>

          <div
            style={{
              display:
                'flex',

              flexDirection:
                'column',

              gap:
                '0.4rem'
            }}
          >
            <span
              style={{
                ...labelStyle,

                display:
                  'block'
              }}
            >
              Search Game{' '}

              <span
                style={{
                  color:
                    '#fc4646'
                }}
              >
                *
              </span>
            </span>

            <input
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
              style={
                inputStyle
              }
            />

            {loadingGames && (
              <div
                style={{
                  color:
                    '#555',

                  fontSize:
                    '0.8rem',

                  paddingLeft:
                    '0.2rem'
                }}
              >
                Searching...
              </div>
            )}

            {games.length >
              0 && (
              <div
                style={{
                  display:
                    'flex',

                  gap:
                    '0.5rem',

                  overflowX:
                    'auto',

                  padding:
                    '0.5rem 0',

                  scrollbarWidth:
                    'none'
                }}
              >
                {games.map(
                  game => (
                    <button
                      type="button"
                      key={
                        game.id
                      }
                      onClick={() => {
                        setSelectedGame(
                          game
                        )

                        setGames(
                          []
                        )
                      }}
                      style={{
                        flexShrink:
                          0,

                        width:
                          '90px',

                        background:
                          selectedGame
                            ?.id ===
                          game.id
                            ? '#1a1a3a'
                            : '#111',

                        border:
                          selectedGame
                            ?.id ===
                          game.id
                            ? '1px solid #646cff'
                            : '1px solid #2a2a2a',

                        borderRadius:
                          '8px',

                        padding:
                          '0.4rem',

                        cursor:
                          'pointer',

                        display:
                          'flex',

                        flexDirection:
                          'column',

                        alignItems:
                          'center',

                        gap:
                          '0.3rem'
                      }}
                    >
                      {game.background_image ? (
                        <img
                          src={
                            game.background_image
                          }
                          alt="cover"
                          style={{
                            width:
                              '100%',

                            height:
                              '54px',

                            objectFit:
                              'cover',

                            borderRadius:
                              '5px'
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width:
                              '100%',

                            height:
                              '54px',

                            background:
                              '#1a1a1a',

                            borderRadius:
                              '5px'
                          }}
                        />
                      )}

                      <div
                        style={{
                          fontSize:
                            '0.68rem',

                          color:
                            '#ccc',

                          textAlign:
                            'center',

                          lineHeight:
                            '1.2',

                          wordBreak:
                            'break-word'
                        }}
                      >
                        {game.name}
                      </div>
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {selectedGame && (
            <div
              style={{
                background:
                  '#0d0d0d',

                border:
                  '1px solid #2a2a2a',

                borderRadius:
                  '12px',

                overflow:
                  'hidden'
              }}
            >
              <div
                style={{
                  position:
                    'relative'
                }}
              >
                {selectedGame
                  .background_image && (
                  <img
                    src={
                      selectedGame
                        .background_image
                    }
                    alt="art"
                    style={{
                      width:
                        '100%',

                      height:
                        '130px',

                      objectFit:
                        'cover',

                      display:
                        'block',

                      opacity:
                        0.7
                    }}
                  />
                )}

                <div
                  style={{
                    position:
                      'absolute',

                    bottom:
                      0,

                    left:
                      0,

                    right:
                      0,

                    background:
                      'linear-gradient(transparent, #0d0d0d)',

                    padding:
                      '1rem 1rem 0.5rem'
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        '0.85rem',

                      fontWeight:
                        '600',

                      color:
                        '#fff'
                    }}
                  >
                    {
                      selectedGame.name
                    }
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedGame(
                      null
                    )
                  }
                  style={{
                    position:
                      'absolute',

                    top:
                      '0.5rem',

                    right:
                      '0.5rem',

                    background:
                      'rgba(0,0,0,0.6)',

                    border:
                      'none',

                    color:
                      '#aaa',

                    borderRadius:
                      '6px',

                    padding:
                      '0.2rem 0.5rem',

                    cursor:
                      'pointer',

                    fontSize:
                      '0.75rem'
                  }}
                >
                  ✕ Remove
                </button>
              </div>
            </div>
          )}

          <div
            style={{
              display:
                'flex',

              gap:
                '0.75rem',

              marginTop:
                '0.25rem'
            }}
          >
            <button
              type="submit"
              disabled={
                !title ||
                !selectedGame ||
                creating
              }
              style={{
                flex:
                  1,

                padding:
                  '0.8rem',

                borderRadius:
                  '8px',

                border:
                  'none',

                background:
                  !title ||
                  !selectedGame ||
                  creating
                    ? '#2a2a2a'
                    : '#646cff',

                color:
                  !title ||
                  !selectedGame ||
                  creating
                    ? '#555'
                    : '#fff',

                fontWeight:
                  '600',

                fontSize:
                  '0.95rem',

                cursor:
                  !title ||
                  !selectedGame ||
                  creating
                    ? 'not-allowed'
                    : 'pointer',

                transition:
                  'background 0.2s'
              }}
            >
              {creating
                ? 'Publishing...'
                : 'Publish Post'}
            </button>

            <button
              type="button"
              onClick={
                onClose
              }
              style={{
                padding:
                  '0.8rem 1.25rem',

                borderRadius:
                  '8px',

                border:
                  '1px solid #2e2e2e',

                background:
                  'transparent',

                color:
                  '#aaa',

                cursor:
                  'pointer',

                fontSize:
                  '0.95rem'
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}