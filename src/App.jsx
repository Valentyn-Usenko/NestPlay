import React, {
  useState,
  useEffect,
  useRef
} from 'react'

import {
  API_BASE_URL
} from './config'

import {
  getCurrentAuthSession,
  clearCognitoTokens
} from './authSession'

import {
  getUnreadNotificationCount,
  getPendingFriendRequestCount,
  getUnreadMessageCount
} from './api'

import PostList from './components/PostList'
import RightSidebar from './components/RightSidebar'
import GameHub from './components/GameHub'
import PostModal from './components/PostModal'
import PostPage from './components/PostPage'
import ProfilePage from './components/ProfilePage'
import PublicProfilePage from './components/PublicProfilePage'
import AuthModal from './components/AuthModal'
import SettingsModal from './components/SettingsModal'
import InboxModal from './components/InboxModal'
import FriendsPickerModal from './components/FriendsPickerModal'

import PresenceConnection from './components/PresenceConnection'
import './App.css'


export default function App() {
  const [
    showModal,
    setShowModal
  ] = useState(false)

  const [
    activePost,
    setActivePost
  ] = useState(null)

  const [
    sidebarPosts,
    setSidebarPosts
  ] = useState([])

  const [
    activeGame,
    setActiveGame
  ] = useState(null)

  const [
    activePage,
    setActivePage
  ] = useState('feed')

  const [
    activeUserId,
    setActiveUserId
  ] = useState(null)

  const [
    session,
    setSession
  ] = useState(null)

  const [
    authMode,
    setAuthMode
  ] = useState(null)

  const [
    menuOpen,
    setMenuOpen
  ] = useState(false)

  const [
    showSettings,
    setShowSettings
  ] = useState(false)

  const [
    showInbox,
    setShowInbox
  ] = useState(false)

  const [
    showMessages,
    setShowMessages
  ] = useState(false)

  const [
    pendingFriendCount,
    setPendingFriendCount
  ] = useState(0)

  const [
    unreadNotifCount,
    setUnreadNotifCount
  ] = useState(0)

  const [
    unreadMsgCount,
    setUnreadMsgCount
  ] = useState(0)


  const menuRef =
    useRef(null)


  const pendingCount =
    pendingFriendCount +
    unreadNotifCount


  // ==================================================
  // AUTH SESSION
  // ==================================================

  useEffect(() => {
    let mounted = true

    const loadSession =
      async () => {
        try {
          const currentSession =
            await getCurrentAuthSession()

          if (mounted) {
            setSession(
              currentSession
            )
          }
        } catch (error) {
          console.error(
            'Could not load auth session:',
            error
          )

          if (mounted) {
            setSession(null)
          }
        }
      }

    loadSession()

    const handleAuthChanged =
      () => {
        loadSession()
      }

    window.addEventListener(
      'nestplay-auth-changed',
      handleAuthChanged
    )

    return () => {
      mounted = false

      window.removeEventListener(
        'nestplay-auth-changed',
        handleAuthChanged
      )
    }
  }, [])


  // ==================================================
  // BACKEND AUTH TEST
  // ==================================================

  useEffect(() => {
    if (!session?.access_token) {
      return
    }

    fetch(
      `${API_BASE_URL}/api/auth-check`,
      {
        headers: {
          Authorization:
            `Bearer ${session.access_token}`
        }
      }
    )
      .then(response =>
        response.json()
      )
      .then(data => {
        console.log(
          'BACKEND AUTH TEST:',
          data
        )
      })
      .catch(error => {
        console.error(
          'BACKEND AUTH ERROR:',
          error
        )
      })
  }, [session])


  // ==================================================
  // HEADER COUNTS
  // ==================================================

  useEffect(() => {
    if (!session) {
      return
    }

    let active = true

    async function loadCounts() {
      try {
        const [
          friendResult,
          notifResult,
          msgResult
        ] =
          await Promise.all([
            getPendingFriendRequestCount(),
            getUnreadNotificationCount(),
            getUnreadMessageCount()
          ])

        if (!active) {
          return
        }

        setPendingFriendCount(
          friendResult.count || 0
        )

        setUnreadNotifCount(
          notifResult.count || 0
        )

        setUnreadMsgCount(
          msgResult.count || 0
        )
      } catch (error) {
        console.error(
          'Error loading header counts:',
          error
        )
      }
    }

    loadCounts()

    const awsPoll =
      setInterval(
        loadCounts,
        2000
      )

    const handleFocus =
      () => {
        loadCounts()
      }

    window.addEventListener(
      'focus',
      handleFocus
    )

    return () => {
      active = false

      clearInterval(
        awsPoll
      )

      window.removeEventListener(
        'focus',
        handleFocus
      )
    }
  }, [session])


  // ==================================================
  // CLOSE MENU OUTSIDE
  // ==================================================

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    const handleClickOutside =
      e => {
        if (
          menuRef.current &&
          !menuRef.current.contains(
            e.target
          )
        ) {
          setMenuOpen(false)
        }
      }

    document.addEventListener(
      'mousedown',
      handleClickOutside
    )

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      )
    }
  }, [menuOpen])


  // ==================================================
  // AUTH SUCCESS
  // ==================================================

  const handleAuthSuccess =
    async () => {
      const currentSession =
        await getCurrentAuthSession()

      setSession(
        currentSession
      )

      setAuthMode(null)
    }


  // ==================================================
  // LOGOUT
  // ==================================================

  const handleLogout =
    () => {
      clearCognitoTokens()

      setSession(null)

      setPendingFriendCount(0)
      setUnreadNotifCount(0)
      setUnreadMsgCount(0)

      setShowInbox(false)
      setShowMessages(false)
      setShowSettings(false)
      setMenuOpen(false)

      setActivePage('feed')
      setActivePost(null)
      setActiveUserId(null)
      setActiveGame(null)
    }


  // ==================================================
  // HOME
  // ==================================================

  const goHome =
    () => {
      setActivePage('feed')
      setActivePost(null)
      setActiveUserId(null)
      setActiveGame(null)

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }


  // ==================================================
  // GAME HUB
  // ==================================================

  const openGameHub =
    game => {
      if (!game) {
        return
      }

      const normalizedGame = {
        id:
          game.id ??
          game.game_id ??
          null,

        name:
          game.name ??
          game.game_name ??
          'Unknown Game',

        gameArtUrl:
          game.gameArtUrl ??
          game.game_art_url ??
          game.background_image ??
          null
      }

      setActiveGame(
        normalizedGame
      )

      setActivePost(null)
      setActiveUserId(null)
      setActivePage('feed')

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }


  const closeGameHub =
    () => {
      setActiveGame(null)
      setActivePost(null)
      setActivePage('feed')

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }


  // ==================================================
  // OPEN POST
  // ==================================================

  const openPost =
    post => {
      setActivePost(
        post
      )

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }


  // ==================================================
  // OPEN PROFILE
  // ==================================================

  const openUserProfile =
    userId => {
      if (
        session &&
        userId ===
          session.user.id
      ) {
        setActivePage(
          'profile'
        )
      } else {
        setActiveUserId(
          userId
        )

        setActivePage(
          'publicProfile'
        )
      }

      setActivePost(null)

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }


  // ==================================================
  // OPEN OWN PROFILE
  // ==================================================

  const openOwnProfile =
    () => {
      setActivePage(
        'profile'
      )

      setActivePost(null)
      setActiveGame(null)
      setActiveUserId(null)

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }


  // ==================================================
  // OPEN MESSAGES
  // ==================================================

  const handleOpenMessages =
    () => {
      setShowMessages(true)
    }


  // ==================================================
  // NOTIFICATION POST
  // ==================================================

  const handleNotificationPost =
    postId => {
      setShowInbox(false)

      setActiveGame(null)

      setActivePost({
        id: postId
      })

      setActivePage('feed')
      setActiveUserId(null)

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }


  // ==================================================
  // NOTIFICATIONS READ
  // ==================================================

  const handleNotificationsRead =
    () => {
      setUnreadNotifCount(0)
    }


  // ==================================================
  // CREATE POST
  // ==================================================

  const handlePostCreated =
    post => {
      setShowModal(false)

      setActivePost(
        post
      )

      setActivePage(
        'feed'
      )

      /*
        IMPORTANT:

        We intentionally DO NOT clear
        activeGame here.

        If the post was created inside
        a Game Hub, pressing Back from
        the post returns to that hub.
      */
    }


  return (
    <>

      <PresenceConnection
        session={session}
      />

      <header>

        <div
          className="header-left"
          ref={menuRef}
        >

          <button
            className="hamburger-btn"
            onClick={() =>
              setMenuOpen(
                open => !open
              )
            }
            aria-label="Open menu"
          >
            <span />
            <span />
            <span />
          </button>


          {session && (
            <button
              className="msg-nav-btn"
              onClick={
                handleOpenMessages
              }
              aria-label="Messages"
            >
              💬

              {unreadMsgCount >
                0 && (
                <span className="msg-nav-dot" />
              )}
            </button>
          )}


          {menuOpen && (
            <div className="hamburger-menu">

              {session && (
                <button
                  className="hamburger-menu-item"
                  onClick={() => {
                    setMenuOpen(
                      false
                    )

                    setShowInbox(
                      true
                    )
                  }}
                >
                  📬 Inbox

                  {pendingCount >
                    0 && (
                    <span className="inbox-badge">
                      {
                        pendingCount
                      }
                    </span>
                  )}
                </button>
              )}


              <button
                className="hamburger-menu-item"
                onClick={() => {
                  setMenuOpen(
                    false
                  )

                  setShowSettings(
                    true
                  )
                }}
              >
                ⚙️ Settings
              </button>

            </div>
          )}

        </div>


        <h1
          style={{
            cursor:
              'pointer'
          }}
          onClick={goHome}
        >
          NestPlay
        </h1>


        <div className="header-right">

          {!session ? (
            <>

              <button
                className="btn-ghost"
                onClick={() =>
                  setAuthMode(
                    'login'
                  )
                }
              >
                Login
              </button>


              <button
                className="btn-primary"
                onClick={() =>
                  setAuthMode(
                    'signup'
                  )
                }
              >
                Sign Up
              </button>

            </>
          ) : (
            <>

              <button
                className="btn-primary"
                onClick={() =>
                  setShowModal(
                    true
                  )
                }
              >
                Create Post
              </button>


              <button
                className="btn-ghost"
                onClick={
                  handleLogout
                }
              >
                Logout
              </button>


              <span
                className="username-link"
                onClick={
                  openOwnProfile
                }
              >
                {
                  session.user
                    .user_metadata
                    ?.username ||
                  session.user.email
                }
              </span>

            </>
          )}

        </div>

      </header>


      <div className="app-root">
        <main>


          {/* ==========================================
              MY PROFILE
          ========================================== */}

          {activePage ===
            'profile' &&
            session && (
              <ProfilePage
                session={
                  session
                }
                onBack={
                  goHome
                }
                onOpenProfile={
                  openUserProfile
                }
              />
            )}


          {/* ==========================================
              PUBLIC PROFILE
          ========================================== */}

          {activePage ===
            'publicProfile' &&
            activeUserId && (
              <PublicProfilePage
                userId={
                  activeUserId
                }
                session={
                  session
                }
                onBack={
                  goHome
                }
                onOpenPost={
                  post => {
                    setActiveGame(
                      null
                    )

                    setActivePost(
                      post
                    )

                    setActivePage(
                      'feed'
                    )

                    window.scrollTo({
                      top: 0,
                      behavior:
                        'smooth'
                    })
                  }
                }
                onOpenProfile={
                  openUserProfile
                }
              />
            )}


          {/* ==========================================
              NORMAL FEED
          ========================================== */}

          {activePage ===
            'feed' &&
            !activePost &&
            !activeGame && (
              <div className="feed-layout">

                <section className="feed-main">

                  <PostList
                    onOpenPost={
                      openPost
                    }
                    onOpenProfile={
                      openUserProfile
                    }
                    onOpenGameHub={
                      openGameHub
                    }
                    session={
                      session
                    }
                    onPostsChange={
                      setSidebarPosts
                    }
                  />

                </section>


                <RightSidebar
                  posts={
                    sidebarPosts
                  }
                  onOpenPost={
                    openPost
                  }
                  onOpenGameHub={
                    openGameHub
                  }
                  session={
                    session
                  }
                  onOpenProfile={
                    openUserProfile
                  }
                />

              </div>
            )}


          {/* ==========================================
              GAME HUB
          ========================================== */}

          {activePage === 'feed' &&
            !activePost &&
            activeGame && (
              <GameHub
                game={activeGame}
                session={session}
                onBack={closeGameHub}
                onOpenPost={openPost}
                onOpenProfile={openUserProfile}
                onCreatePost={() => setShowModal(true)}
                onJoinRequiresAuth={() => setAuthMode('login')}
              />
            )}

          {/* ==========================================
              POST PAGE
          ========================================== */}

          {activePage ===
            'feed' &&
            activePost && (
              <PostPage
                postId={
                  activePost.id
                }
                session={
                  session
                }
                onBack={() =>
                  setActivePost(
                    null
                  )
                }
                onOpenProfile={
                  openUserProfile
                }
              />
            )}

        </main>
      </div>


      {/* ==========================================
          CREATE POST MODAL
      ========================================== */}

      {showModal && (
        <PostModal
          session={
            session
          }
          initialGame={
            activeGame
          }
          onClose={() =>
            setShowModal(
              false
            )
          }
          onCreated={
            handlePostCreated
          }
        />
      )}


      {/* ==========================================
          AUTH
      ========================================== */}

      {authMode && (
        <AuthModal
          mode={
            authMode
          }
          onClose={() =>
            setAuthMode(
              null
            )
          }
          onAuthSuccess={
            handleAuthSuccess
          }
        />
      )}


      {/* ==========================================
          SETTINGS
      ========================================== */}

      {showSettings && (
        <SettingsModal
          onClose={() =>
            setShowSettings(
              false
            )
          }
          session={
            session
          }
        />
      )}


      {/* ==========================================
          INBOX
      ========================================== */}

      {showInbox && (
        <InboxModal
          session={
            session
          }
          onClose={() =>
            setShowInbox(
              false
            )
          }
          onOpenPost={
            handleNotificationPost
          }
          onNotificationsRead={
            handleNotificationsRead
          }
        />
      )}


      {/* ==========================================
          MESSAGES
      ========================================== */}

      {showMessages && (
        <FriendsPickerModal
          session={
            session
          }
          onClose={() =>
            setShowMessages(
              false
            )
          }
        />
      )}

    </>
  )
}
