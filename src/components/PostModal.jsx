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
  onCreated,
  initialGame = null
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
  // CREATE POST
  // ==================================================

  async function handleCreate(e) {
    e.preventDefault()

    if (
      !title.trim() ||
      !selectedGame ||
      !session
    ) {
      return
    }

    setCreating(
      true
    )

    const payload = {
      title:
        title.trim(),

      content,

      game_id:
        selectedGame.id ||
        null,

      game_name:
        selectedGame.name ||
        null,

      game_art_url:
        selectedGame
          .background_image ||
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


  return (
    <div className="modal-overlay">

      <div className="post-create-modal">

        <div className="post-create-header">

          <div>

            <h2>
              Create a Post
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
          >
            ✕
          </button>

        </div>


        <form
          className="post-create-form"
          onSubmit={
            handleCreate
          }
        >

          <label className="post-create-field">

            <span>
              Post Title
              <b>
                *
              </b>
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
            />

          </label>


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


          {!gameLocked && (
            <div className="post-game-search">

              <label className="post-create-field">

                <span>
                  Search Game
                  <b>
                    *
                  </b>
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


          {selectedGame && (
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
                  ✕ Remove
                </button>
              )}

            </div>
          )}


          <div className="post-create-actions">

            <button
              type="submit"
              className="post-create-publish"
              disabled={
                !title.trim() ||
                !selectedGame ||
                creating
              }
            >
              {creating
                ? 'Publishing...'
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