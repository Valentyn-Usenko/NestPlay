import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import PostList from './components/PostList'
import PostModal from './components/PostModal'
import PostPage from './components/PostPage'
import AuthModal from './components/AuthModal' 
import './App.css'

export default function App() {
  const [showModal, setShowModal] = useState(false)
  const [activePost, setActivePost] = useState(null)
  
  // New state for Authentication
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState(null) // 'login', 'signup', or null

  useEffect(() => {
    // 1. Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // 2. Listen for login/logout events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="app-root">
      <header>
        <h1>GameSocial</h1>
        
        {/* Auth Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          {!session ? (
            <>
              <button onClick={() => setAuthMode('signup')}>Sign Up</button>
              <button onClick={() => setAuthMode('login')}>Login</button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.8rem' }}>{session.user.email}</span>
              <button onClick={handleLogout}>Logout</button>
            </div>
          )}
        </div>

        <button onClick={() => setShowModal(true)}>Create Post</button>
      </header>

      <main>
        {!activePost && <PostList onOpenPost={(p) => setActivePost(p)} />}
        {activePost && <PostPage postId={activePost.id} onBack={() => setActivePost(null)} />}
      </main>

      {/* Post Creation Modal */}
      {showModal && (
        <PostModal 
          onClose={() => setShowModal(false)} 
          onCreated={(p) => { setShowModal(false); setActivePost(p); }} 
        />
      )}

      {/* Auth Modal (Login/Signup) */}
      {authMode && (
        <AuthModal 
          mode={authMode} 
          onClose={() => setAuthMode(null)} 
        />
      )}
    </div>
  )
}