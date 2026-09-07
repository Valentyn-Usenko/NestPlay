import React, { useEffect, useState } from 'react'
import { getPosts, voteOnPost } from '../api'

export default function PostList({
  onOpenPost,
  onOpenProfile,
  session
}) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('created_at')
  const [search, setSearch] = useState('')
  const [votingId, setVotingId] = useState(null)

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
      let postsData =
        await getPosts(search)

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


  // Clicking the same vote again removes it.
  if (
    currentVote === voteType
  ) {
    optimisticVote =
      null

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

  // Switching from upvote to downvote.
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

  // Switching from downvote to upvote.
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

  // Brand-new vote.
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


  // ----------------------------------------------
  // UPDATE UI IMMEDIATELY
  // ----------------------------------------------

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


    // ----------------------------------------------
    // SYNC WITH EXACT SERVER RESULT
    // ----------------------------------------------

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


    // ----------------------------------------------
    // ROLLBACK IF SERVER FAILED
    // ----------------------------------------------

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
              setSearch(e.target.value)
            }
          />

          <select
            value={sortBy}
            onChange={e =>
              setSortBy(e.target.value)
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
            setSearch(e.target.value)
          }
        />

        <select
          value={sortBy}
          onChange={e =>
            setSortBy(e.target.value)
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
        {posts.map(post => (
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
              <img
                src={post.game_art_url}
                alt={post.game_name || 'Game'}
                className="post-game-image"
                loading="lazy"
              />
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.5rem'
              }}
            >
              <button
                className={
                  `upvote-btn${
                    post.myVote === 'up'
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
                  votingId === post.id
                }
              >
                ▲ {getUpvoteCount(post)}
              </button>

              <button
                className={
                  `downvote-btn${
                    post.myVote === 'down'
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
                  votingId === post.id
                }
              >
                ▼ {getDownvoteCount(post)}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}