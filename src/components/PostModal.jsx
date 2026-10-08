import React, { useState } from 'react'

import {
  createPost
} from '../api'

import useEscapeKey from '../hooks/useEscapeKey'

import GameSearch from './GameSearch'


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
          <GameSearch
            value={selectedGame}
            onChange={setSelectedGame}
            locked={gameLocked}
            required
          />




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