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

    setVotingId(post.id)

    try {
      await voteOnPost(
        post.id,
        voteType
      )

      // Refresh without hiding the feed.
      await fetchPosts(false)
    } catch (error) {
      console.error(
        'Vote failed:',
        error
      )

      alert(
        'Error voting: ' +
        error.message
      )
    } finally {
      setVotingId(null)
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