import React, { useEffect, useState, useRef } from 'react'
import {
  getPosts,
  getFriends,
  getProfiles,
  getMyProfile,
  updateProfile,
  deleteFriendRequest,
  uploadAvatar,
  deleteAvatar
} from '../api'
import ChatModal from './ChatModal'

const AVATAR_COLORS = [
  {
    id: 'purple',
    gradient: 'linear-gradient(135deg, #646cff, #a78bfa)'
  },
  {
    id: 'red',
    gradient: 'linear-gradient(135deg, #fc4646, #ff8c00)'
  },
  {
    id: 'green',
    gradient: 'linear-gradient(135deg, #11998e, #38ef7d)'
  },
  {
    id: 'blue',
    gradient: 'linear-gradient(135deg, #2193b0, #6dd5ed)'
  },
  {
    id: 'pink',
    gradient: 'linear-gradient(135deg, #f953c6, #b91d73)'
  },
  {
    id: 'gold',
    gradient: 'linear-gradient(135deg, #f7971e, #ffd200)'
  }
]

const AVATAR_MAP = {
  purple: 'linear-gradient(135deg, #646cff, #a78bfa)',
  red: 'linear-gradient(135deg, #fc4646, #ff8c00)',
  green: 'linear-gradient(135deg, #11998e, #38ef7d)',
  blue: 'linear-gradient(135deg, #2193b0, #6dd5ed)',
  pink: 'linear-gradient(135deg, #f953c6, #b91d73)',
  gold: 'linear-gradient(135deg, #f7971e, #ffd200)'
}

export default function ProfilePage({
  session,
  onBack,
  onOpenProfile
}) {
  const [posts, setPosts] = useState([])
  const [likedPosts, setLikedPosts] = useState([])
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)

  const [username, setUsername] =
    useState(
      session?.user?.user_metadata?.username ||
      session?.user?.email ||
      'Anonymous'
    )

  const [avatarUrl, setAvatarUrl] =
    useState(null)

  const [avatarColor, setAvatarColor] =
    useState('purple')

  const [uploadingAvatar, setUploadingAvatar] =
    useState(false)

  const [avatarPanelOpen, setAvatarPanelOpen] =
    useState(false)

  const [chatFriend, setChatFriend] =
    useState(null)

  const mountedRef = useRef(true)
  const fileInputRef = useRef()

  const avatarLetter =
    (username || '?')
      .charAt(0)
      .toUpperCase()

  const joinDate = new Date(
    session?.user?.created_at
  ).toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }
  )

  const currentGradient =
    AVATAR_COLORS.find(
      color =>
        color.id === avatarColor
    )?.gradient ||
    AVATAR_COLORS[0].gradient

  useEffect(() => {
    mountedRef.current = true

    async function fetchAll() {
      setLoading(true)

      try {
        // ------------------------------------------------
        // MY PROFILE — AWS
        // ------------------------------------------------

        let myProfile = null

        try {
          myProfile =
            await getMyProfile()
        } catch (error) {
          console.error(
            'Error loading AWS profile:',
            error
          )
        }

        // ------------------------------------------------
        // POSTS + VOTES — AWS
        // ------------------------------------------------

        let allPosts = []

        try {
          allPosts =
            await getPosts()
        } catch (error) {
          console.error(
            'Error loading AWS posts:',
            error
          )
        }

        const userPosts =
          allPosts.filter(
            post =>
              post.user_id ===
              session.user.id
          )

        const likedPostsData =
          allPosts.filter(
            post =>
              post.myVote === 'up'
          )

        // ------------------------------------------------
        // FRIENDSHIPS — AWS
        // ------------------------------------------------

        let friendRows = []

        try {
          friendRows =
            await getFriends()
        } catch (error) {
          console.error(
            'Error loading AWS friends:',
            error
          )
        }

        const friendIds =
          friendRows.map(
            row =>
              row.friend_id
          )

        // ------------------------------------------------
        // FRIEND PROFILE INFO — AWS
        // ------------------------------------------------

        let friendProfiles = []

        if (
          friendIds.length > 0
        ) {
          try {
            const profiles =
              await getProfiles(
                friendIds
              )

            friendProfiles =
              profiles.map(
                profile => {
                  const friendship =
                    friendRows.find(
                      row =>
                        row.friend_id ===
                        profile.id
                    )

                  return {
                    ...profile,
                    requestId:
                      friendship?.id
                  }
                }
              )
          } catch (error) {
            console.error(
              'Error loading AWS friend profiles:',
              error
            )
          }
        }

        if (
          !mountedRef.current
        ) {
          return
        }

        if (myProfile) {
          setUsername(
            myProfile.username ||
            session?.user?.user_metadata?.username ||
            session?.user?.email ||
            'Anonymous'
          )

          setAvatarUrl(
            myProfile.avatar_url ||
            null
          )

          setAvatarColor(
            myProfile.avatar_color ||
            'purple'
          )
        }

        setPosts(
          userPosts
        )

        setLikedPosts(
          likedPostsData
        )

        setFriends(
          friendProfiles
        )
      } catch (error) {
        console.error(
          'Error loading profile:',
          error
        )
      } finally {
        if (
          mountedRef.current
        ) {
          setLoading(false)
        }
      }
    }

    fetchAll()

    return () => {
      mountedRef.current =
        false
    }
  }, [session.user.id])

  // ------------------------------------------------
  // AVATAR UPLOAD
  //
  // BROWSER → NODE → AMAZON S3
  // ------------------------------------------------

  const handleAvatarUpload =
    async e => {
      const file =
        e.target.files?.[0]

      if (!file) {
        return
      }

      setUploadingAvatar(
        true
      )

      try {
        const profile =
          await uploadAvatar(
            file
          )

        if (
          mountedRef.current
        ) {
          setAvatarUrl(
            profile.avatar_url ||
            null
          )

          setAvatarColor(
            profile.avatar_color ||
            avatarColor
          )
        }
      } catch (error) {
        console.error(
          'Avatar upload failed:',
          error
        )

        alert(
          'Upload failed: ' +
          error.message
        )
      } finally {
        if (
          fileInputRef.current
        ) {
          fileInputRef.current.value =
            ''
        }

        if (
          mountedRef.current
        ) {
          setUploadingAvatar(
            false
          )
        }
      }
    }

  // ------------------------------------------------
  // PICK AVATAR COLOR — AWS
  // ------------------------------------------------

  const handleColorPick =
    async colorId => {
      try {
        if (avatarUrl) {
          await deleteAvatar()
        }

        await updateProfile({
          avatar_color:
            colorId,
          avatar_url:
            null
        })

        if (
          mountedRef.current
        ) {
          setAvatarColor(
            colorId
          )

          setAvatarUrl(
            null
          )
        }
      } catch (error) {
        console.error(
          'Error changing avatar color:',
          error
        )

        alert(
          'Could not change avatar color: ' +
          error.message
        )
      }
    }

  // ------------------------------------------------
  // RESET AVATAR — AMAZON S3 + AWS PROFILE
  // ------------------------------------------------

  const handleResetAvatar =
    async () => {
      try {
        await deleteAvatar()

        if (
          mountedRef.current
        ) {
          setAvatarUrl(
            null
          )
        }
      } catch (error) {
        console.error(
          'Error resetting avatar:',
          error
        )

        alert(
          'Could not reset avatar: ' +
          error.message
        )
      }
    }

  // ------------------------------------------------
  // REMOVE FRIEND — AWS
  // ------------------------------------------------

  const handleRemoveFriend =
    async (
      requestId,
      friendId
    ) => {
      try {
        await deleteFriendRequest(
          requestId
        )

        if (
          mountedRef.current
        ) {
          setFriends(
            prev =>
              prev.filter(
                friend =>
                  friend.id !==
                  friendId
              )
          )
        }
      } catch (error) {
        console.error(
          'Error removing friend:',
          error
        )

        alert(
          'Could not remove friend: ' +
          error.message
        )
      }
    }

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

  return (
    <div className="profile-page">
      <div className="profile-hero">
        <div
          style={{
            position:
              'relative',
            display:
              'inline-block'
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="avatar"
              className="profile-avatar-large"
              style={{
                objectFit:
                  'cover'
              }}
            />
          ) : (
            <div
              className="profile-avatar-large"
              style={{
                background:
                  currentGradient
              }}
            >
              {avatarLetter}
            </div>
          )}

          <button
            onClick={() =>
              setAvatarPanelOpen(
                open =>
                  !open
              )
            }
            disabled={
              uploadingAvatar
            }
            className="avatar-edit-btn"
          >
            {uploadingAvatar
              ? '…'
              : '✏️'}
          </button>

          <input
            ref={
              fileInputRef
            }
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,image/bmp"
            style={{
              display:
                'none'
            }}
            onChange={
              handleAvatarUpload
            }
          />
        </div>

        <div className="profile-hero-info">
          <h2 className="profile-username">
            {username}
          </h2>

          <p className="profile-joined">
            Member since{' '}
            {joinDate}
          </p>
        </div>
      </div>

      {avatarPanelOpen && (
        <div className="avatar-edit-panel">
          <div className="avatar-edit-panel-row">
            <button
              className="btn-primary"
              style={{
                fontSize:
                  '0.85rem',
                padding:
                  '0.4rem 0.9rem'
              }}
              onClick={() =>
                fileInputRef
                  .current
                  .click()
              }
              disabled={
                uploadingAvatar
              }
            >
              {uploadingAvatar
                ? 'Uploading…'
                : '📷 Upload Photo'}
            </button>

            {avatarUrl && (
              <button
                className="settings-edit-btn"
                onClick={
                  handleResetAvatar
                }
              >
                Reset to Default
              </button>
            )}
          </div>

          {!avatarUrl && (
            <>
              <p className="settings-color-label">
                Pick a color:
              </p>

              <div className="avatar-color-grid">
                {AVATAR_COLORS.map(
                  color => (
                    <button
                      key={
                        color.id
                      }
                      className={
                        `avatar-color-swatch ${
                          avatarColor ===
                          color.id
                            ? 'selected'
                            : ''
                        }`
                      }
                      style={{
                        background:
                          color.gradient
                      }}
                      onClick={() =>
                        handleColorPick(
                          color.id
                        )
                      }
                    />
                  )
                )}
              </div>
            </>
          )}
        </div>
      )}

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
            {likedPosts.length}
          </span>

          <span className="stat-label">
            Posts Liked
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

        {loading && (
          <div className="global-loading">
            <div className="dot" />
            <div className="dot" />
            <div className="dot" />
          </div>
        )}

        {!loading &&
          friends.length ===
            0 && (
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
                Add some!
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
                AVATAR_MAP[
                  friend.avatar_color ||
                  'purple'
                ]

              return (
                <div
                  key={
                    friend.id
                  }
                  className="friend-card"
                >
                  <div
                    className="friend-card-left"
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

                  <div className="friend-card-actions">
                    <button
                      className="friend-msg-btn"
                      onClick={() =>
                        setChatFriend(
                          friend
                        )
                      }
                    >
                      💬
                    </button>

                    <button
                      className="friend-remove-btn"
                      onClick={() =>
                        handleRemoveFriend(
                          friend.requestId,
                          friend.id
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            }
          )}
        </div>
      </div>

      <div className="profile-posts-section">
        <h3 className="profile-posts-heading">
          Your Posts
        </h3>

        {loading && (
          <div className="global-loading">
            <div className="dot" />
            <div className="dot" />
            <div className="dot" />
          </div>
        )}

        {!loading &&
          posts.length ===
            0 && (
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
                You haven't posted
                anything yet.
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

      <div className="profile-posts-section">
        <h3 className="profile-posts-heading">
          Posts You Liked
        </h3>

        {loading && (
          <div className="global-loading">
            <div className="dot" />
            <div className="dot" />
            <div className="dot" />
          </div>
        )}

        {!loading &&
          likedPosts.length ===
            0 && (
            <div className="profile-empty">
              <span
                style={{
                  fontSize:
                    '2rem'
                }}
              >
                👾
              </span>

              <p>
                You haven't liked
                any posts yet.
              </p>
            </div>
          )}

        <ul className="posts">
          {likedPosts.map(
            post => (
              <li
                key={
                  post.id
                }
                className="post-card profile-post-card"
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
                  By {post.name}
                  {' '}•{' '}
                  {new Date(
                    post.created_at
                  ).toLocaleString()}
                </div>
              </li>
            )
          )}
        </ul>
      </div>

      <button
        className="profile-back-btn"
        onClick={onBack}
      >
        ← Back to Feed
      </button>

      {chatFriend && (
        <ChatModal
          session={session}
          friend={chatFriend}
          onClose={() =>
            setChatFriend(
              null
            )
          }
        />
      )}
    </div>
  )
}