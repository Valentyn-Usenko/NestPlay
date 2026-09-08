import React, { useEffect, useState } from 'react'
import { getPosts, voteOnPost } from '../api'

export default function PostList({
  onOpenPost,
  onOpenProfile,
  onOpenGameHub,
  session,
  onPostsChange
}) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('created_at')
  const [search, setSearch] = useState('')
  const [votingId, setVotingId] = useState(null)

  const [
    lastFetchWasGlobal,
    setLastFetchWasGlobal
  ] = useState(true)

  const uid = session?.user?.id

  const getUpvoteCount = post => {
    return (
      post.liveUpvotes ??
      post.upvotes ??
      0
    )
  }

  const getDownvoteCount = post => {
    return (
      post.liveDownvotes ??
      post.downvotes ??
      0
    )
  }

  const fetchPosts = async (
    showLoader = true
  ) => {
    if (showLoader) {
      setLoading(true)
    }

    try {
      const cleanSearch =
        search.trim()

      let postsData =
        await getPosts(cleanSearch)

      setLastFetchWasGlobal(
        cleanSearch === ''
      )

      if (sortBy === 'upvotes') {
        postsData =
          [...postsData].sort(
            (a, b) =>
              getUpvoteCount(b) -
              getUpvoteCount(a)
          )
      }

      setPosts(postsData)
    } catch (error) {
      console.error(
        'Error loading posts:',
        error
      )

      if (showLoader) {
        setPosts([])
      }
    } finally {
      if (showLoader) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    Promise.resolve().then(() =>
      fetchPosts(true)
    )

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, session])

  useEffect(() => {
    if (
      lastFetchWasGlobal &&
      onPostsChange
    ) {
      onPostsChange(posts)
    }
  }, [
    posts,
    lastFetchWasGlobal,
    onPostsChange
  ])

  const handleVote = async (
    e,
    post,
    voteType
  ) => {
    e.stopPropagation()

    if (
      !uid ||
      votingId === post.id
    ) {
      return
    }

    const previousPost = {
      ...post
    }

    const currentVote =
      post.myVote || null

    const currentUpvotes =
      getUpvoteCount(post)

    const currentDownvotes =
      getDownvoteCount(post)

    let optimisticVote =
      voteType

    let optimisticUpvotes =
      currentUpvotes

    let optimisticDownvotes =
      currentDownvotes

    if (
      currentVote === voteType
    ) {
      optimisticVote = null

      if (
        voteType === 'up'
      ) {
        optimisticUpvotes =
          Math.max(
            0,
            currentUpvotes - 1
          )
      } else {
        optimisticDownvotes =
          Math.max(
            0,
            currentDownvotes - 1
          )
      }
    }

    else if (
      currentVote === 'up' &&
      voteType === 'down'
    ) {
      optimisticUpvotes =
        Math.max(
          0,
          currentUpvotes - 1
        )

      optimisticDownvotes =
        currentDownvotes + 1
    }

    else if (
      currentVote === 'down' &&
      voteType === 'up'
    ) {
      optimisticDownvotes =
        Math.max(
          0,
          currentDownvotes - 1
        )

      optimisticUpvotes =
        currentUpvotes + 1
    }

    else if (
      voteType === 'up'
    ) {
      optimisticUpvotes =
        currentUpvotes + 1
    }

    else {
      optimisticDownvotes =
        currentDownvotes + 1
    }

    setPosts(prev =>
      prev.map(item =>
        item.id === post.id
          ? {
              ...item,
              myVote:
                optimisticVote,
              liveUpvotes:
                optimisticUpvotes,
              liveDownvotes:
                optimisticDownvotes
            }
          : item
      )
    )

    setVotingId(
      post.id
    )

    try {
      const result =
        await voteOnPost(
          post.id,
          voteType
        )

      setPosts(prev =>
        prev.map(item =>
          item.id === post.id
            ? {
                ...item,
                myVote:
                  result.vote,
                liveUpvotes:
                  result.liveUpvotes,
                liveDownvotes:
                  result.liveDownvotes
              }
            : item
        )
      )
    } catch (error) {
      console.error(
        'Vote failed:',
        error
      )

      setPosts(prev =>
        prev.map(item =>
          item.id === post.id
            ? previousPost
            : item
        )
      )

      alert(
        'Error voting: ' +
        error.message
      )
    } finally {
      setVotingId(
        null
      )
    }
  }

  const openGame =
    (e, post) => {
      e.stopPropagation()

      if (
        !post.game_name ||
        !onOpenGameHub
      ) {
        return
      }

      onOpenGameHub({
        id:
          post.game_id ||
          null,

        name:
          post.game_name,

        gameArtUrl:
          post.game_art_url ||
          null
      })
    }

  if (loading) {
    return (
      <div className="global-loading">
        <div className="dot" />
        <div className="dot" />
        <div className="dot" />
      </div>
    )
  }

  if (!posts.length) {
    return (
      <>
        <div className="feed-controls">
          <input
            placeholder="Search by game..."
            value={search}
            onChange={e =>
              setSearch(
                e.target.value
              )
            }
          />

          <select
            value={sortBy}
            onChange={e =>
              setSortBy(
                e.target.value
              )
            }
          >
            <option value="created_at">
              Newest
            </option>

            <option value="upvotes">
              Most upvoted
            </option>
          </select>

          <button
            onClick={() =>
              fetchPosts(true)
            }
          >
            Apply
          </button>
        </div>

        <div className="empty-state">
          No posts yet — create one!
        </div>
      </>
    )
  }

  return (
    <div>
      <div className="feed-controls">
        <input
          placeholder="Search by game..."
          value={search}
          onChange={e =>
            setSearch(
              e.target.value
            )
          }
        />

        <select
          value={sortBy}
          onChange={e =>
            setSortBy(
              e.target.value
            )
          }
        >
          <option value="created_at">
            Newest
          </option>

          <option value="upvotes">
            Most upvoted
          </option>
        </select>

        <button
          onClick={() =>
            fetchPosts(true)
          }
        >
          Apply
        </button>
      </div>

      <ul className="posts">
        {posts.map(
          (post, index) => (
            <li
              key={post.id}
              className="post-card"
              onClick={() =>
                onOpenPost(post)
              }
            >
              <div className="post-meta">
                <span
                  className="author-link"
                  onClick={e => {
                    e.stopPropagation()

                    onOpenProfile(
                      post.user_id
                    )
                  }}
                >
                  {post.name}
                </span>

                {' • '}

                {new Date(
                  post.created_at
                ).toLocaleString()}
              </div>

              <h3>
                {post.title}
              </h3>

              {post.game_art_url && (
                <div className="post-game-media">
                  <img
                    src={
                      post.game_art_url
                    }
                    alt={
                      post.game_name ||
                      'Game'
                    }
                    className="post-game-image"
                    loading={
                      index < 3
                        ? 'eager'
                        : 'lazy'
                    }
                    fetchPriority={
                      index === 0
                        ? 'high'
                        : 'auto'
                    }
                  />

                  {post.game_name && (
                    <button
                      className="post-game-hub-link"
                      onClick={e =>
                        openGame(
                          e,
                          post
                        )
                      }
                    >
                      <span className="post-game-hub-icon">
                        🎮
                      </span>

                      <span>
                        {
                          post.game_name
                        }
                      </span>

                      <span className="post-game-hub-arrow">
                        ›
                      </span>
                    </button>
                  )}
                </div>
              )}

              <div
                style={{
                  display:
                    'flex',

                  alignItems:
                    'center',

                  gap:
                    '0.5rem',

                  marginTop:
                    '0.5rem'
                }}
              >
                <button
                  className={
                    `upvote-btn${
                      post.myVote ===
                      'up'
                        ? ' active'
                        : ''
                    }`
                  }
                  onClick={e =>
                    handleVote(
                      e,
                      post,
                      'up'
                    )
                  }
                  disabled={
                    !uid ||
                    votingId ===
                      post.id
                  }
                >
                  ▲{' '}
                  {
                    getUpvoteCount(
                      post
                    )
                  }
                </button>

                <button
                  className={
                    `downvote-btn${
                      post.myVote ===
                      'down'
                        ? ' active'
                        : ''
                    }`
                  }
                  onClick={e =>
                    handleVote(
                      e,
                      post,
                      'down'
                    )
                  }
                  disabled={
                    !uid ||
                    votingId ===
                      post.id
                  }
                >
                  ▼{' '}
                  {
                    getDownvoteCount(
                      post
                    )
                  }
                </button>
              </div>
            </li>
          )
        )}
      </ul>
    </div>
  )
}