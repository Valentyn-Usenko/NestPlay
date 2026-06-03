import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import PostList from './components/PostList'
import PostModal from './components/PostModal'
import PostPage from './components/PostPage'
import ProfilePage from './components/ProfilePage'
import PublicProfilePage from './components/PublicProfilePage'
import AuthModal from './components/AuthModal'
import './App.css'

export default function App() {
  const [showModal, setShowModal] = useState(false)
  const [activePost, setActivePost] = useState(null)
  const [activePage, setActivePage] = useState('feed') // 'feed' | 'profile' | 'publicProfile'
  const [activeUserId, setActiveUserId] = useState(null)
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

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

  return (
    <>
      <header>
        <h1 style={{ cursor: 'pointer' }} onClick={goHome}>GameSocial</h1>
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
              <span
                className="username-link"
                onClick={() => { setActivePage('profile'); setActivePost(null) }}
              >
                {session.user.user_metadata?.username || session.user.email}
              </span>
            </>
          )}
        </div>
      </header>

      <div className="app-root">
        <main>
          {activePage === 'profile' && session && (
            <ProfilePage session={session} onBack={goHome} />
          )}
          {activePage === 'publicProfile' && activeUserId && (
            <PublicProfilePage userId={activeUserId} onBack={goHome} onOpenPost={(p) => { setActivePost(p); setActivePage('feed') }} />
          )}
          {activePage === 'feed' && !activePost && (
            <PostList onOpenPost={(p) => setActivePost(p)} onOpenProfile={openUserProfile} />
          )}
          {activePage === 'feed' && activePost && (
            <PostPage postId={activePost.id} session={session} onBack={() => setActivePost(null)} onOpenProfile={openUserProfile} />
          )}
        </main>
      </div>

      {showModal && (
        <PostModal
          session={session}
          onClose={() => setShowModal(false)}
          onCreated={(p) => { setShowModal(false); setActivePost(p); setActivePage('feed') }}
        />
      )}
      {authMode && (
        <AuthModal mode={authMode} onClose={() => setAuthMode(null)} />
      )}
    </>
  )
}