import React, {
    useEffect,
    useMemo,
    useState
  } from 'react'
  
  import {
    getPosts,
    getGameHub,
    joinGameHub,
    leaveGameHub
  } from '../api'
  
  
  const getUpvoteCount = post => {
    return (
      post.liveUpvotes ??
      post.upvotes ??
      0
    )
  }
  
  
  export default function GameHub({
    game,
    session,
    onBack,
    onOpenPost,
    onOpenProfile,
    onCreatePost,
    onJoinRequiresAuth
  }) {
    const [
      posts,
      setPosts
    ] = useState([])
  
    const [
      loading,
      setLoading
    ] = useState(true)
  
    const [
      activeTab,
      setActiveTab
    ] = useState('overview')
  
    const [
      joined,
      setJoined
    ] = useState(false)
  
    const [
      memberCount,
      setMemberCount
    ] = useState(0)
  
    const [
      communityLoading,
      setCommunityLoading
    ] = useState(true)
  
    const [
      communityBusy,
      setCommunityBusy
    ] = useState(false)
  
  
    const communityGameId =
      game?.id != null
        ? String(game.id)
        : null
  
  
    // ==================================================
    // LOAD GAME POSTS
    // ==================================================
  
    useEffect(() => {
      let active = true
  
      async function loadGamePosts() {
        if (!game) {
          return
        }
  
        setLoading(true)
  
        try {
          const result =
            await getPosts(
              game.name || ''
            )
  
          const exactPosts =
            (result || []).filter(
              post => {
                if (
                  game.id &&
                  post.game_id
                ) {
                  return (
                    String(
                      post.game_id
                    ) ===
                    String(
                      game.id
                    )
                  )
                }
  
                return (
                  post.game_name
                    ?.trim()
                    .toLowerCase() ===
                  game.name
                    ?.trim()
                    .toLowerCase()
                )
              }
            )
  
          if (active) {
            setPosts(
              exactPosts
            )
          }
        } catch (error) {
          console.error(
            'Error loading game hub:',
            error
          )
  
          if (active) {
            setPosts([])
          }
        } finally {
          if (active) {
            setLoading(false)
          }
        }
      }
  
      loadGamePosts()
  
      return () => {
        active = false
      }
    }, [
      game?.id,
      game?.name
    ])
  
  
    // ==================================================
    // LOAD COMMUNITY MEMBERSHIP
    // ==================================================
  
    useEffect(() => {
      let active = true
  
      async function loadCommunity() {
        if (!communityGameId) {
          setCommunityLoading(
            false
          )
  
          return
        }
  
        setCommunityLoading(
          true
        )
  
        try {
          const result =
            await getGameHub(
              communityGameId
            )
  
          if (!active) {
            return
          }
  
          setJoined(
            Boolean(
              result.joined
            )
          )
  
          setMemberCount(
            result.memberCount ||
            0
          )
        } catch (error) {
          console.error(
            'Error loading community:',
            error
          )
  
          if (active) {
            setJoined(false)
            setMemberCount(0)
          }
        } finally {
          if (active) {
            setCommunityLoading(
              false
            )
          }
        }
      }
  
      loadCommunity()
  
      return () => {
        active = false
      }
    }, [
      communityGameId,
      session?.user?.id
    ])
  
  
    // ==================================================
    // JOIN / LEAVE COMMUNITY
    // ==================================================
  
    const handleCommunityToggle =
      async () => {
        if (!session) {
          if (
            onJoinRequiresAuth
          ) {
            onJoinRequiresAuth()
          }
  
          return
        }
  
        if (
          !communityGameId ||
          communityBusy
        ) {
          return
        }
  
        setCommunityBusy(
          true
        )
  
        try {
          let result
  
          if (joined) {
            result =
              await leaveGameHub(
                communityGameId
              )
          } else {
            result =
              await joinGameHub({
                ...game,
                id:
                  communityGameId
              })
          }
  
          setJoined(
            Boolean(
              result.joined
            )
          )
  
          setMemberCount(
            result.memberCount ||
            0
          )
        } catch (error) {
          console.error(
            'Community update failed:',
            error
          )
  
          alert(
            'Could not update community: ' +
            error.message
          )
        } finally {
          setCommunityBusy(
            false
          )
        }
      }
  
  
    // ==================================================
    // STATS
    // ==================================================
  
    const contributorCount =
      useMemo(() => {
        return new Set(
          posts
            .map(
              post =>
                post.user_id
            )
            .filter(Boolean)
        ).size
      }, [posts])
  
  
    const totalUpvotes =
      useMemo(() => {
        return posts.reduce(
          (total, post) =>
            total +
            getUpvoteCount(
              post
            ),
          0
        )
      }, [posts])
  
  
    const popularPosts =
      useMemo(() => {
        return [...posts]
          .sort(
            (a, b) =>
              getUpvoteCount(b) -
              getUpvoteCount(a)
          )
          .slice(
            0,
            5
          )
      }, [posts])
  
  
    const topDiscussions =
      useMemo(() => {
        return [...posts]
          .sort(
            (a, b) =>
              getUpvoteCount(b) -
              getUpvoteCount(a)
          )
          .slice(
            0,
            3
          )
      }, [posts])
  
  
    const latestPosts =
      useMemo(() => {
        return [...posts]
          .sort(
            (a, b) =>
              new Date(
                b.created_at
              ).getTime() -
              new Date(
                a.created_at
              ).getTime()
          )
      }, [posts])
  
  
    if (!game) {
      return null
    }
  
  
    const artwork =
      game.gameArtUrl ||
      game.game_art_url ||
      null
  
  
    // ==================================================
    // POST CARD
    // ==================================================
  
    const renderPost =
      post => (
        <article
          key={post.id}
          className="hub-post-card"
          onClick={() =>
            onOpenPost(
              post
            )
          }
        >
  
          <div className="hub-post-meta">
  
            <span
              className="hub-author"
              onClick={e => {
                e.stopPropagation()
  
                onOpenProfile(
                  post.user_id
                )
              }}
            >
              {post.name}
            </span>
  
            <span>
              •
            </span>
  
            <span>
              {new Date(
                post.created_at
              ).toLocaleString()}
            </span>
  
          </div>
  
  
          <h3>
            {post.title}
          </h3>
  
  
          {post.content && (
            <p className="hub-post-content">
              {post.content}
            </p>
          )}
  
  
          <div className="hub-post-actions">
  
            <span>
              ▲{' '}
              {
                getUpvoteCount(
                  post
                )
              }
            </span>
  
          </div>
  
        </article>
      )
  
  
    return (
      <div className="game-hub">
  
        <button
          className="hub-back-btn"
          onClick={onBack}
        >
          ← Back to Feed
        </button>
  
  
        {/* ==========================================
            HERO
        ========================================== */}
  
        <section
          className="game-hub-hero"
          style={
            artwork
              ? {
                  backgroundImage:
                    `linear-gradient(
                      90deg,
                      rgba(6, 6, 6, 0.96) 0%,
                      rgba(6, 6, 6, 0.78) 34%,
                      rgba(6, 6, 6, 0.28) 68%,
                      rgba(6, 6, 6, 0.58) 100%
                    ),
                    url("${artwork}")`
                }
              : undefined
          }
        >
  
          <div className="game-hub-hero-content">
  
            {artwork && (
              <div className="game-hub-cover">
  
                <img
                  src={artwork}
                  alt={
                    game.name
                  }
                />
  
              </div>
            )}
  
  
            <div className="game-hub-info">
  
              <span className="hub-eyebrow">
                Game Hub
              </span>
  
  
              <h1>
                {game.name}
              </h1>
  
  
              <p>
                Join the discussion,
                share your experiences,
                and discover what the
                NestPlay community is
                saying.
              </p>
  
  
              <div className="game-hub-actions">
  
                <button
                  className={
                    `hub-join-btn ${
                      joined
                        ? 'joined'
                        : ''
                    }`
                  }
                  onClick={
                    handleCommunityToggle
                  }
                  disabled={
                    communityBusy ||
                    communityLoading ||
                    !communityGameId
                  }
                  title={
                    joined
                      ? 'Leave community'
                      : 'Join community'
                  }
                >
                  {communityBusy
                    ? '...'
                    : joined
                      ? '✓ Joined'
                      : '+ Join Community'}
                </button>
  
  
                {session && (
                  <button
                    className="hub-create-post-btn"
                    onClick={
                      onCreatePost
                    }
                  >
                    + Create Post
                  </button>
                )}
  
              </div>
  
  
              <div className="hub-stats">
  
                <div>
  
                  <strong>
                    {memberCount}
                  </strong>
  
                  <span>
                    {memberCount === 1
                      ? 'Member'
                      : 'Members'}
                  </span>
  
                </div>
  
  
                <div>
  
                  <strong>
                    {posts.length}
                  </strong>
  
                  <span>
                    Posts
                  </span>
  
                </div>
  
  
                <div>
  
                  <strong>
                    {contributorCount}
                  </strong>
  
                  <span>
                    Contributors
                  </span>
  
                </div>
  
  
                <div>
  
                  <strong>
                    {totalUpvotes}
                  </strong>
  
                  <span>
                    Upvotes
                  </span>
  
                </div>
  
              </div>
  
            </div>
  
          </div>
  
        </section>
  
  
        {/* ==========================================
            TABS
        ========================================== */}
  
        <nav className="game-hub-tabs">
  
          <button
            className={
              activeTab ===
              'overview'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab(
                'overview'
              )
            }
          >
            Overview
          </button>
  
  
          <button
            className={
              activeTab ===
              'posts'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab(
                'posts'
              )
            }
          >
            Posts
          </button>
  
  
          <button
            className={
              activeTab ===
              'polls'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab(
                'polls'
              )
            }
          >
            Polls
          </button>
  
  
          <button
            className={
              activeTab ===
              'spoilers'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab(
                'spoilers'
              )
            }
          >
            Spoilers
          </button>
  
  
          <button
            className={
              activeTab ===
              'players'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab(
                'players'
              )
            }
          >
            Players
          </button>
  
  
          <button
            className={
              activeTab ===
              'media'
                ? 'active'
                : ''
            }
            onClick={() =>
              setActiveTab(
                'media'
              )
            }
          >
            Media
          </button>
  
        </nav>
  
  
        {/* ==========================================
            CONTENT
        ========================================== */}
  
        {loading ? (
          <div className="global-loading">
            <div className="dot" />
            <div className="dot" />
            <div className="dot" />
          </div>
        ) : (
          <>
  
            {activeTab ===
              'overview' && (
              <div className="game-hub-layout">
  
                <main className="game-hub-main">
  
                  <section className="hub-section">
  
                    <div className="hub-section-heading">
  
                      <h2>
                        🔥 Top Discussions
                      </h2>
  
                    </div>
  
  
                    {topDiscussions.length >
                    0 ? (
                      <div className="hub-discussion-list">
  
                        {topDiscussions.map(
                          post => (
                            <button
                              key={
                                post.id
                              }
                              className="hub-discussion-item"
                              onClick={() =>
                                onOpenPost(
                                  post
                                )
                              }
                            >
  
                              <div>
  
                                <strong>
                                  {
                                    post.title
                                  }
                                </strong>
  
                                <span>
                                  ▲{' '}
                                  {
                                    getUpvoteCount(
                                      post
                                    )
                                  }{' '}
                                  upvotes
                                </span>
  
                              </div>
  
                              <span className="hub-arrow">
                                ›
                              </span>
  
                            </button>
                          )
                        )}
  
                      </div>
                    ) : (
                      <div className="hub-empty">
                        No discussions yet.
                      </div>
                    )}
  
                  </section>
  
  
                  <section className="hub-section">
  
                    <div className="hub-section-heading">
  
                      <h2>
                        Latest Posts
                      </h2>
  
                      <span>
                        Newest
                      </span>
  
                    </div>
  
  
                    {latestPosts.length >
                    0 ? (
                      <div className="hub-post-list">
  
                        {
                          latestPosts.map(
                            renderPost
                          )
                        }
  
                      </div>
                    ) : (
                      <div className="hub-empty">
                        No posts in this
                        community yet.
                      </div>
                    )}
  
                  </section>
  
                </main>
  
  
                <aside className="game-hub-sidebar">
  
                  <section className="hub-side-card">
  
                    <h3>
                      ⭐ Popular Posts
                    </h3>
  
  
                    {popularPosts.length >
                    0 ? (
                      <div className="hub-popular-list">
  
                        {popularPosts.map(
                          post => (
                            <button
                              key={
                                post.id
                              }
                              onClick={() =>
                                onOpenPost(
                                  post
                                )
                              }
                            >
  
                              <strong>
                                {
                                  post.title
                                }
                              </strong>
  
                              <span>
                                {
                                  post.name
                                }
                                {' · ▲ '}
                                {
                                  getUpvoteCount(
                                    post
                                  )
                                }
                              </span>
  
                            </button>
                          )
                        )}
  
                      </div>
                    ) : (
                      <div className="hub-empty">
                        No posts yet.
                      </div>
                    )}
  
                  </section>
  
  
                  <section className="hub-side-card">
  
                    <h3>
                      📊 Community Stats
                    </h3>
  
  
                    <div className="hub-stat-row">
  
                      <span>
                        Members
                      </span>
  
                      <strong>
                        {memberCount}
                      </strong>
  
                    </div>
  
  
                    <div className="hub-stat-row">
  
                      <span>
                        Posts
                      </span>
  
                      <strong>
                        {posts.length}
                      </strong>
  
                    </div>
  
  
                    <div className="hub-stat-row">
  
                      <span>
                        Contributors
                      </span>
  
                      <strong>
                        {
                          contributorCount
                        }
                      </strong>
  
                    </div>
  
  
                    <div className="hub-stat-row">
  
                      <span>
                        Total Upvotes
                      </span>
  
                      <strong>
                        {
                          totalUpvotes
                        }
                      </strong>
  
                    </div>
  
                  </section>
  
                </aside>
  
              </div>
            )}
  
  
            {activeTab ===
              'posts' && (
              <section className="hub-section hub-all-posts">
  
                <div className="hub-section-heading">
  
                  <h2>
                    All Posts
                  </h2>
  
                  <span>
                    {posts.length}
                  </span>
  
                </div>
  
  
                {latestPosts.length >
                0 ? (
                  <div className="hub-post-list">
  
                    {
                      latestPosts.map(
                        renderPost
                      )
                    }
  
                  </div>
                ) : (
                  <div className="hub-empty">
                    No posts yet.
                  </div>
                )}
  
              </section>
            )}
  
  
            {[
              'polls',
              'spoilers',
              'players',
              'media'
            ].includes(
              activeTab
            ) && (
              <section className="hub-coming-soon">
  
                <span>
                  🎮
                </span>
  
                <h2>
                  {
                    activeTab
                      .charAt(0)
                      .toUpperCase() +
                    activeTab.slice(1)
                  }
                </h2>
  
                <p>
                  This part of the
                  community is coming
                  next.
                </p>
  
              </section>
            )}
  
          </>
        )}
  
      </div>
    )
  }