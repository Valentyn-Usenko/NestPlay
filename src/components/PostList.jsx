import React, { useEffect, useState } from 'react'
import {
  getFriendCount,
  getPosts,
  voteOnPost
} from '../api'

import PollContent from './PollContent'

export default function PostList({
  onOpenPost,
  onOpenProfile,
  onOpenGameHub,
  session,
  onPostsChange
}) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  const [feedMode, setFeedMode] =
    useState('home')

  const [sortBy, setSortBy] =
    useState('recommended')

  const [search, setSearch] =
    useState('')

  const [votingId, setVotingId] =
    useState(null)

  const [friendCount, setFriendCount] =
    useState(null)

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

      const postsData =
        await getPosts(
          cleanSearch,
          {
            feed: feedMode,
            sort: sortBy
          }
        )

      setLastFetchWasGlobal(
        feedMode === 'home' &&
        cleanSearch === ''
      )

      setPosts(postsData)

      if (
        feedMode === 'friends' &&
        postsData.length === 0
      ) {
        try {
          const friendData =
            await getFriendCount()

          setFriendCount(
            friendData.count ?? 0
          )
        } catch (error) {
          console.error(
            'Error loading friend count:',
            error
          )

          setFriendCount(null)
        }
      } else {
        setFriendCount(null)
      }
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
    if (
      !uid &&
      feedMode === 'friends'
    ) {
      setFeedMode('home')
      setSortBy('recommended')
      return
    }

    Promise.resolve().then(() =>
      fetchPosts(true)
    )

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sortBy,
    session,
    feedMode
  ])

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

  const changeFeedMode =
    nextMode => {
      if (
        nextMode === feedMode
      ) {
        return
      }

      setFeedMode(nextMode)

      if (
        nextMode === 'friends'
      ) {
        setSortBy('newest')
      } else {
        setSortBy('recommended')
      }
    }

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
    } else if (
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
    } else if (
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
    } else if (
      voteType === 'up'
    ) {
      optimisticUpvotes =
        currentUpvotes + 1
    } else {
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

    setVotingId(post.id)

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
      setVotingId(null)
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

  const controls = (
    <>
      <div
        className="feed-view-tabs"
        role="tablist"
        aria-label="Feed view"
      >
        <button
          type="button"
          role="tab"
          aria-selected={
            feedMode === 'home'
          }
          className={
            `feed-view-tab${
              feedMode === 'home'
                ? ' active'
                : ''
            }`
          }
          onClick={() =>
            changeFeedMode('home')
          }
        >
          For You
        </button>

        {uid && (
          <button
            type="button"
            role="tab"
            aria-selected={
              feedMode === 'friends'
            }
            className={
              `feed-view-tab${
                feedMode === 'friends'
                  ? ' active'
                  : ''
              }`
            }
            onClick={() =>
              changeFeedMode(
                'friends'
              )
            }
          >
            Friends
          </button>
        )}
      </div>

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
          {feedMode === 'home' && (
            <option value="recommended">
              Recommended
            </option>
          )}

          <option value="newest">
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
    </>
  )

  if (loading) {
    return (
      <div>
        {controls}

        <div className="global-loading">
          <div className="dot" />
          <div className="dot" />
          <div className="dot" />
        </div>
      </div>
    )
  }

  if (!posts.length) {
    let emptyMessage =
      'No posts yet — create one!'

    if (
      feedMode === 'friends'
    ) {
      if (friendCount === 0) {
        emptyMessage =
          'You do not have any friends yet. Discover people through Game Hubs and the wider NestPlay community.'
      } else {
        emptyMessage =
          'Nothing new from your friends yet. Explore the For You feed while you wait.'
      }
    }

    return (
      <div>
        {controls}

        <div className="empty-state">
          {emptyMessage}
        </div>
      </div>
    )
  }

  return (
    <div>
      {controls}

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

                {feedMode ===
                  'home' &&
                  post.isFriend && (
                    <>
                      <span className="post-meta-separator">
                        ·
                      </span>

                      <span className="friend-post-label">
                        Friend
                      </span>
                    </>
                  )}

                <span className="post-meta-separator">
                  ·
                </span>

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

              {post.content_type ===
                'poll' && (
                <PollContent
                  post={post}
                  session={session}
                  onPollChange={
                    nextPoll =>
                      setPosts(
                        current =>
                          current.map(
                            item =>
                              item.id ===
                              post.id
                                ? {
                                    ...item,
                                    poll:
                                      nextPoll
                                  }
                                : item
                          )
                      )
                  }
                />
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
