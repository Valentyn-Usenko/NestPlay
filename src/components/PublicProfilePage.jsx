import React, { useEffect, useState, useRef } from 'react'
import {
  getPosts,
  getUserFriends,
  getFriendStatus,
  sendFriendRequest,
  getProfile,
  getProfiles
} from '../api'

const AVATAR_COLORS = {
  purple: 'linear-gradient(135deg, #646cff, #a78bfa)',
  red: 'linear-gradient(135deg, #fc4646, #ff8c00)',
  green: 'linear-gradient(135deg, #11998e, #38ef7d)',
  blue: 'linear-gradient(135deg, #2193b0, #6dd5ed)',
  pink: 'linear-gradient(135deg, #f953c6, #b91d73)',
  gold: 'linear-gradient(135deg, #f7971e, #ffd200)'
}

export default function PublicProfilePage({
  userId,
  session,
  onBack,
  onOpenPost,
  onOpenProfile
}) {
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)

  const [isPrivate, setIsPrivate] =
    useState(false)

  const [friendStatus, setFriendStatus] =
    useState(null)

  const [sendingRequest, setSendingRequest] =
    useState(false)

  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    async function fetchAll() {
      setLoading(true)

      try {
        // ------------------------------------------------
        // PROFILE — AWS
        // ------------------------------------------------

        let profileData = null

        try {
          profileData =
            await getProfile(userId)
        } catch (error) {
          console.error(
            'Error loading AWS profile:',
            error
          )
        }

        let fetchedPosts = []
        let fetchedFriends = []

        // ------------------------------------------------
        // PUBLIC CONTENT
        // ------------------------------------------------

        if (!profileData?.is_private) {
          // ----------------------------------------------
          // POSTS — AWS
          // ----------------------------------------------

          try {
            const allPosts =
              await getPosts()

            fetchedPosts =
              allPosts.filter(
                post =>
                  post.user_id === userId
              )
          } catch (error) {
            console.error(
              'Error loading AWS posts:',
              error
            )
          }

          // ----------------------------------------------
          // FRIENDSHIPS — AWS
          // ----------------------------------------------

          let friendRows = []

          try {
            friendRows =
              await getUserFriends(
                userId
              )
          } catch (error) {
            console.error(
              'Error loading AWS friends:',
              error
            )
          }

          const friendIds =
            friendRows.map(
              row => row.friend_id
            )

          // ----------------------------------------------
          // FRIEND PROFILES — AWS
          // ----------------------------------------------

          if (friendIds.length > 0) {
            try {
              fetchedFriends =
                await getProfiles(
                  friendIds
                )
            } catch (error) {
              console.error(
                'Error loading AWS friend profiles:',
                error
              )
            }
          }
        }

        // ------------------------------------------------
        // FRIEND STATUS — AWS
        // ------------------------------------------------

        let status = null

        if (
          session &&
          session.user.id !== userId
        ) {
          try {
            const statusResult =
              await getFriendStatus(
                userId
              )

            status =
              statusResult.status
          } catch (error) {
            console.error(
              'Error loading AWS friend status:',
              error
            )
          }
        }

        if (!mountedRef.current) {
          return
        }

        setProfile(
          profileData
        )

        setIsPrivate(
          profileData?.is_private ||
            false
        )

        setPosts(
          fetchedPosts
        )

        setFriends(
          fetchedFriends
        )

        setFriendStatus(
          status
        )
      } catch (error) {
        console.error(
          'Error loading public profile:',
          error
        )
      } finally {
        if (mountedRef.current) {
          setLoading(false)
        }
      }
    }

    fetchAll()

    return () => {
      mountedRef.current = false
    }
  }, [userId, session?.user?.id])

  // ------------------------------------------------
  // SEND FRIEND REQUEST — AWS
  // ------------------------------------------------

  const handleSendRequest = async () => {
    if (!session) {
      return
    }

    setSendingRequest(true)

    try {
      await sendFriendRequest(
        userId
      )

      if (mountedRef.current) {
        setFriendStatus(
          'sent'
        )
      }
    } catch (error) {
      console.error(
        'Friend request failed:',
        error
      )

      alert(
        'Could not send friend request: ' +
        error.message
      )
    } finally {
      if (mountedRef.current) {
        setSendingRequest(false)
      }
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

  const username =
    profile?.username ||
    'Unknown'

  const avatarLetter =
    username
      .charAt(0)
      .toUpperCase()

  const avatarGradient =
    AVATAR_COLORS[
      profile?.avatar_color ||
        'purple'
    ]

  const joinDate =
    profile?.created_at
      ? new Date(
          profile.created_at
        ).toLocaleDateString(
          'en-US',
          {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }
        )
      : '—'

  const totalUpvotes =
    posts.reduce(
      (sum, post) =>
        sum +
        (
          post.liveUpvotes ||
          0
        ),
      0
    )

  // ------------------------------------------------
  // FRIEND BUTTON
  // ------------------------------------------------

  const friendBtn = () => {
    if (!session) {
      return null
    }

    if (
      session.user.id ===
      userId
    ) {
      return null
    }

    if (
      friendStatus ===
      'friends'
    ) {
      return (
        <span className="friend-badge">
          ✅ Friends
        </span>
      )
    }

    if (
      friendStatus ===
      'sent'
    ) {
      return (
        <span className="friend-badge pending">
          📨 Request Sent
        </span>
      )
    }

    if (
      friendStatus ===
      'received'
    ) {
      return (
        <span className="friend-badge pending">
          📬 Sent you a request
        </span>
      )
    }

    return (
      <button
        className="btn-primary friend-request-btn"
        onClick={
          handleSendRequest
        }
        disabled={
          sendingRequest
        }
      >
        {sendingRequest
          ? 'Sending…'
          : '➕ Add Friend'}
      </button>
    )
  }

  return (
    <div className="profile-page">
      <div className="profile-hero">
        {profile?.avatar_url ? (
          <img
            src={
              profile.avatar_url
            }
            alt="avatar"
            className="profile-avatar-large"
            style={{
              objectFit: 'cover'
            }}
          />
        ) : (
          <div
            className="profile-avatar-large"
            style={{
              background:
                avatarGradient
            }}
          >
            {avatarLetter}
          </div>
        )}

        <div className="profile-hero-info">
          <h2 className="profile-username">
            {username}
          </h2>

          <p className="profile-joined">
            Member since{' '}
            {joinDate}
          </p>

          {isPrivate && (
            <span className="private-badge">
              🔒 Private Profile
            </span>
          )}

          <div
            style={{
              marginTop:
                '0.5rem'
            }}
          >
            {friendBtn()}
          </div>
        </div>
      </div>

      {isPrivate ? (
        <div className="private-wall">
          <span
            style={{
              fontSize:
                '2.5rem'
            }}
          >
            🔒
          </span>

          <h3>
            This profile is private
          </h3>

          <p>
            This user has chosen
            to keep their posts
            private.
          </p>
        </div>
      ) : (
        <>
          <div className="profile-stats">
            <div className="stat-card">
              <span className="stat-number">
                {posts.length}
              </span>

              <span className="stat-label">
                Posts
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-number">
                {totalUpvotes}
              </span>

              <span className="stat-label">
                Total Upvotes
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-number">
                {friends.length}
              </span>

              <span className="stat-label">
                Friends
              </span>
            </div>
          </div>

          <div className="profile-posts-section">
            <h3 className="profile-posts-heading">
              Friends
            </h3>

            {friends.length === 0 && (
              <div className="profile-empty">
                <span
                  style={{
                    fontSize:
                      '2rem'
                  }}
                >
                  👥
                </span>

                <p>
                  No friends yet.
                </p>
              </div>
            )}

            <div className="friends-grid">
              {friends.map(
                friend => {
                  const letter =
                    (
                      friend.username ||
                      '?'
                    )
                      .charAt(0)
                      .toUpperCase()

                  const gradient =
                    AVATAR_COLORS[
                      friend.avatar_color ||
                        'purple'
                    ]

                  return (
                    <div
                      key={
                        friend.id
                      }
                      className="friend-card"
                      onClick={() =>
                        onOpenProfile?.(
                          friend.id
                        )
                      }
                      style={{
                        cursor:
                          'pointer'
                      }}
                    >
                      <div className="friend-card-left">
                        {friend.avatar_url ? (
                          <img
                            src={
                              friend.avatar_url
                            }
                            alt="avatar"
                            className="friend-avatar"
                          />
                        ) : (
                          <div
                            className="friend-avatar"
                            style={{
                              background:
                                gradient
                            }}
                          >
                            {letter}
                          </div>
                        )}

                        <span className="friend-name">
                          {friend.username ||
                            'Unknown'}
                        </span>
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          </div>

          <div className="profile-posts-section">
            <h3 className="profile-posts-heading">
              {username}'s Posts
            </h3>

            {posts.length === 0 && (
              <div className="profile-empty">
                <span
                  style={{
                    fontSize:
                      '2rem'
                  }}
                >
                  🎮
                </span>

                <p>
                  No posts yet.
                </p>
              </div>
            )}

            <ul className="posts">
              {posts.map(
                post => (
                  <li
                    key={
                      post.id
                    }
                    className="post-card profile-post-card"
                    onClick={() =>
                      onOpenPost(
                        post
                      )
                    }
                    style={{
                      cursor:
                        'pointer'
                    }}
                  >
                    <div className="profile-post-top">
                      <h3 className="profile-post-title">
                        {post.title}
                      </h3>

                      <span className="profile-post-upvotes">
                        ▲{' '}
                        {post.liveUpvotes}
                      </span>
                    </div>

                    {post.game_name && (
                      <div className="profile-post-game">
                        🎮{' '}
                        {post.game_name}
                      </div>
                    )}

                    <div className="post-meta">
                      {new Date(
                        post.created_at
                      ).toLocaleString()}
                    </div>
                  </li>
                )
              )}
            </ul>
          </div>
        </>
      )}

      <button
        className="profile-back-btn"
        onClick={onBack}
      >
        ← Back to Feed
      </button>
    </div>
  )
}