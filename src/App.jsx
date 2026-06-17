import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
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
  const [showModal, setShowModal] = useState(false)
  const [activePost, setActivePost] = useState(null)
  const [activePage, setActivePage] = useState('feed')
  const [activeUserId, setActiveUserId] = useState(null)
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showInbox, setShowInbox] = useState(false)
  const [showMessages, setShowMessages] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [unreadMsgCount, setUnreadMsgCount] = useState(0)
  const menuRef = useRef(null)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) return
    const userId = session.user.id

    async function loadCounts() {
      const { count: friendCount } = await supabase
        .from('friend_requests')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', userId)
        .eq('status', 'pending')

      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false)

      setPendingCount((friendCount || 0) + (notifCount || 0))

      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', userId)
        .or('read.eq.false,read.is.null')
      setUnreadMsgCount(msgCount || 0)
    }

    loadCounts()

    const friendChannel = supabase
      .channel('inbox-badge')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `receiver_id=eq.${userId}`
      }, () => loadCounts())
      .subscribe()

    const msgChannel = supabase
      .channel('msg-badge')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userId}`
      }, () => loadCounts())
      .subscribe()

    const notifChannel = supabase
      .channel('notif-badge')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, () => loadCounts())
      .subscribe()

    return () => {
      supabase.removeChannel(friendChannel)
      supabase.removeChannel(msgChannel)
      supabase.removeChannel(notifChannel)
    }
  }, [session])

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setActivePage('feed')
    setActivePost(null)
    setActiveUserId(null)
  }

  const goHome = () => {
    setActivePage('feed')
    setActivePost(null)
    setActiveUserId(null)
  }

  const openUserProfile = (userId) => {
    if (session && userId === session.user.id) {
      setActivePage('profile')
    } else {
      setActiveUserId(userId)
      setActivePage('publicProfile')
    }
    setActivePost(null)
  }

  const handleOpenMessages = () => {
    setShowMessages(true)
    setUnreadMsgCount(0)
  }

  return (
    <>
      <header>
        <div className="header-left" ref={menuRef}>
          <button className="hamburger-btn" onClick={() => setMenuOpen(o => !o)} aria-label="Open menu">
            <span /><span /><span />
          </button>

          {session && (
            <button className="msg-nav-btn" onClick={handleOpenMessages} aria-label="Messages">
              💬
              {unreadMsgCount > 0 && <span className="msg-nav-dot" />}
            </button>
          )}

          {menuOpen && (
            <div className="hamburger-menu">
              {session && (
                <button className="hamburger-menu-item" onClick={() => { setMenuOpen(false); setShowInbox(true) }}>
                  📬 Inbox
                  {pendingCount > 0 && <span className="inbox-badge">{pendingCount}</span>}
                </button>
              )}
              <button className="hamburger-menu-item" onClick={() => { setMenuOpen(false); setShowSettings(true) }}>
                ⚙️ Settings
              </button>
            </div>
          )}
        </div>

        <h1 style={{ cursor: 'pointer' }} onClick={goHome}>GameNest</h1>

        <div className="header-right">
          {!session ? (
            <>
              <button className="btn-ghost" onClick={() => setAuthMode('login')}>Login</button>
              <button className="btn-primary" onClick={() => setAuthMode('signup')}>Sign Up</button>
            </>
          ) : (
            <>
              <button className="btn-primary" onClick={() => setShowModal(true)}>Create Post</button>
              <button className="btn-ghost" onClick={handleLogout}>Logout</button>
              <span className="username-link" onClick={() => { setActivePage('profile'); setActivePost(null) }}>
                {session.user.user_metadata?.username || session.user.email}
              </span>
            </>
          )}
        </div>
      </header>

      <div className="app-root">
        <main>
          {activePage === 'profile' && session && (
            <ProfilePage session={session} onBack={goHome} onOpenProfile={openUserProfile} />
          )}
          {activePage === 'publicProfile' && activeUserId && (
            <PublicProfilePage
              userId={activeUserId}
              session={session}
              onBack={goHome}
              onOpenPost={(p) => { setActivePost(p); setActivePage('feed') }}
              onOpenProfile={openUserProfile}
            />
          )}
          {activePage === 'feed' && !activePost && (
            <PostList onOpenPost={(p) => setActivePost(p)} onOpenProfile={openUserProfile} session={session} />
          )}
          {activePage === 'feed' && activePost && (
            <PostPage postId={activePost.id} session={session} onBack={() => setActivePost(null)} onOpenProfile={openUserProfile} />
          )}
        </main>
      </div>

      {showModal && (
        <PostModal session={session} onClose={() => setShowModal(false)}
          onCreated={(p) => { setShowModal(false); setActivePost(p); setActivePage('feed') }} />
      )}
      {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} session={session} />}
      {showInbox && <InboxModal session={session} onClose={() => setShowInbox(false)} />}
      {showMessages && <FriendsPickerModal session={session} onClose={() => setShowMessages(false)} />}
    </>
  )
}