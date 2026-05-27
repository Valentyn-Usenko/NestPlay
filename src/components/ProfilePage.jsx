import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ProfilePage({ session, onBack }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  const username = session?.user?.user_metadata?.username || session?.user?.email || 'Anonymous'

  useEffect(() => {
    const fetchUserPosts = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      setPosts(data || [])
      setLoading(false)
    }
    fetchUserPosts()
  }, [session])

  return (
    <div className="profile-page">
      <button className= "back-button" onClick={onBack}>← Back</button>

      <div className="profile-header">
        <div className="profile-avatar">
          {/* {username.charAt(0).toUpperCase()} */}
        </div>
        <div>
          <h2>Your username: {username}</h2>
          {/* <p style={{ color: '#aaa', fontSize: '0.85rem', margin: 0 }}>{session.user.email}</p> */}
          <p>Your email: {session.user.email}</p>
        </div>
      </div>

      <h3 style={{ marginTop: '2rem' }}>Your Posts ({posts.length})</h3>

      {loading && (
        <div className="global-loading">
          <div className="dot" /><div className="dot" /><div className="dot" />
        </div>
      )}

      {!loading && posts.length === 0 && (
        <p style={{ color: '#aaa' }}>You haven't posted anything yet.</p>
      )}

      <ul className="posts">
        {posts.map(p => (
          <li key={p.id} className="post-card">
            <div className="post-meta">{new Date(p.created_at).toLocaleString()}</div>
            <h3>{p.title}</h3>
            {p.game_name && <div style={{ color: '#aaa', fontSize: '0.85rem' }}>🎮 {p.game_name}</div>}
            <div className="upvotes">▲ {p.upvotes || 0}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}