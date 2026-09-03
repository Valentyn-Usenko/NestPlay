import React, {
  useState,
  useEffect,
  useRef
} from 'react'

import { supabase } from './supabaseClient'

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
import PostModal from './components/PostModal'
import PostPage from './components/PostPage'
import ProfilePage from './components/ProfilePage'
import PublicProfilePage from './components/PublicProfilePage'
import AuthModal from './components/AuthModal'
import SettingsModal from './components/SettingsModal'
import InboxModal from './components/InboxModal'
import FriendsPickerModal from './components/FriendsPickerModal'

import './App.css'


export default function App() {
  const [showModal, setShowModal] =
    useState(false)

  const [activePost, setActivePost] =
    useState(null)

  const [activePage, setActivePage] =
    useState('feed')

  const [activeUserId, setActiveUserId] =
    useState(null)

  const [session, setSession] =
    useState(null)

  const [authMode, setAuthMode] =
    useState(null)

  const [menuOpen, setMenuOpen] =
    useState(false)

  const [showSettings, setShowSettings] =
    useState(false)

  const [showInbox, setShowInbox] =
    useState(false)

  const [showMessages, setShowMessages] =
    useState(false)

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
  //
  // Cognito takes priority when available.
  // Supabase remains the temporary migration fallback.
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

    // ----------------------------------------------
    // Existing Supabase users still need this
    // during the migration.
    // ----------------------------------------------

    const {
      data: {
        subscription
      }
    } =
      supabase.auth
        .onAuthStateChange(
          () => {
            loadSession()
          }
        )

    // ----------------------------------------------
    // Cognito AuthModal will dispatch this after
    // successful login/signup.
    // ----------------------------------------------

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

      subscription.unsubscribe()

      window.removeEventListener(
        'nestplay-auth-changed',
        handleAuthChanged
      )
    }
  }, [])


  // ==================================================
  // BACKEND AUTH TEST
  //
  // Temporary while auth migration is in progress.
  // Works with either provider.
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
  //
  // FRIEND REQUESTS -> AWS
  // NOTIFICATIONS   -> AWS
  // MESSAGES        -> AWS
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

    // Temporary until WebSockets.
    const awsPoll =
      setInterval(
        () => {
          loadCounts()
        },
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
  // CLOSE MENU WHEN CLICKING OUTSIDE
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
  //
  // Cognito AuthModal will use this soon.
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
    async () => {
      // Remove Cognito tokens if present.
      clearCognitoTokens()

      // Also remove any temporary legacy
      // Supabase session so Cognito logout
      // cannot fall back into Supabase.
      await supabase.auth.signOut()

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
    }


  // ==================================================
  // GO HOME
  // ==================================================

  const goHome = () => {
    setActivePage('feed')
    setActivePost(null)
    setActiveUserId(null)
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
    }


  // ==================================================
  // OPEN MESSAGES
  // ==================================================

  const handleOpenMessages =
    () => {
      setShowMessages(true)
    }


  // ==================================================
  // OPEN POST FROM NOTIFICATION
  // ==================================================

  const handleNotificationPost =
    postId => {
      setShowInbox(false)

      setActivePost({
        id: postId
      })

      setActivePage('feed')
      setActiveUserId(null)
    }


  // ==================================================
  // NOTIFICATIONS WERE READ
  // ==================================================

  const handleNotificationsRead =
    () => {
      setUnreadNotifCount(0)
    }


  return (
    <>
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

              {unreadMsgCount > 0 && (
                <span
                  className="msg-nav-dot"
                />
              )}
            </button>
          )}

          {menuOpen && (
            <div className="hamburger-menu">
              {session && (
                <button
                  className="hamburger-menu-item"
                  onClick={() => {
                    setMenuOpen(false)
                    setShowInbox(true)
                  }}
                >
                  📬 Inbox

                  {pendingCount > 0 && (
                    <span
                      className="inbox-badge"
                    >
                      {pendingCount}
                    </span>
                  )}
                </button>
              )}

              <button
                className="hamburger-menu-item"
                onClick={() => {
                  setMenuOpen(false)
                  setShowSettings(true)
                }}
              >
                ⚙️ Settings
              </button>
            </div>
          )}
        </div>

        <h1
          style={{
            cursor: 'pointer'
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
                  setShowModal(true)
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
                onClick={() => {
                  setActivePage(
                    'profile'
                  )

                  setActivePost(
                    null
                  )
                }}
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
          {activePage ===
            'profile' &&
            session && (
              <ProfilePage
                session={session}
                onBack={goHome}
                onOpenProfile={
                  openUserProfile
                }
              />
            )}

          {activePage ===
            'publicProfile' &&
            activeUserId && (
              <PublicProfilePage
                userId={
                  activeUserId
                }
                session={session}
                onBack={goHome}
                onOpenPost={
                  post => {
                    setActivePost(
                      post
                    )

                    setActivePage(
                      'feed'
                    )
                  }
                }
                onOpenProfile={
                  openUserProfile
                }
              />
            )}

          {activePage ===
            'feed' &&
            !activePost && (
              <PostList
                onOpenPost={
                  post =>
                    setActivePost(
                      post
                    )
                }
                onOpenProfile={
                  openUserProfile
                }
                session={session}
              />
            )}

          {activePage ===
            'feed' &&
            activePost && (
              <PostPage
                postId={
                  activePost.id
                }
                session={session}
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

      {showModal && (
        <PostModal
          session={session}
          onClose={() =>
            setShowModal(false)
          }
          onCreated={post => {
            setShowModal(false)
            setActivePost(post)
            setActivePage('feed')
          }}
        />
      )}

      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() =>
            setAuthMode(null)
          }
          onAuthSuccess={
            handleAuthSuccess
          }
        />
      )}

      {showSettings && (
        <SettingsModal
          onClose={() =>
            setShowSettings(false)
          }
          session={session}
        />
      )}

      {showInbox && (
        <InboxModal
          session={session}
          onClose={() =>
            setShowInbox(false)
          }
          onOpenPost={
            handleNotificationPost
          }
          onNotificationsRead={
            handleNotificationsRead
          }
        />
      )}

      {showMessages && (
        <FriendsPickerModal
          session={session}
          onClose={() =>
            setShowMessages(false)
          }
        />
      )}
    </>
  )
}