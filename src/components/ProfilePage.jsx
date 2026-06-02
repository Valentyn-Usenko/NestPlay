import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function ProfilePage({ session, onBack }) {
  const [posts, setPosts] = useState([])
  const [likedPosts, setLikedPosts] = useState([])
  const [loading, setLoading] = useState(true)

  const username = session?.user?.user_metadata?.username || session?.user?.email || 'Anonymous'
  const email = session?.user?.email || ''
  const avatarLetter = username.charAt(0).toUpperCase()
  const joinDate = new Date(session?.user?.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)

      // fetch user's own posts
      const { data: userPosts } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      // fetch post IDs the user has upvoted
      const { data: voteRows } = await supabase
        .from('votes')
        .select('post_id')
        .eq('user_id', session.user.id)
        .eq('vote_type', 'up')

      const likedPostIds = (voteRows || []).map(v => v.post_id)

      // fetch the actual post data for those IDs
      let likedPostsData = []
      if (likedPostIds.length > 0) {
        const { data } = await supabase
          .from('posts')
          .select('*')
          .in('id', likedPostIds)
          .order('created_at', { ascending: false })
        likedPostsData = data || []
      }

      setPosts(userPosts || [])
      setLikedPosts(likedPostsData)
      setLoading(false)
    }

    fetchAll()
  }, [session])

  const totalUpvotes = posts.reduce((sum, p) => sum + (p.upvotes || 0), 0)

  return (
    <div className="profile-page">

      {/* Hero card */}
      <div className="profile-hero">
        <div className="profile-avatar-large">{avatarLetter}</div>
        <div className="profile-hero-info">
          <h2 className="profile-username">{username}</h2>
          <p className="profile-email-text">{email}</p>
          <p className="profile-joined">Member since {joinDate}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="profile-stats">
        <div className="stat-card">
          <span className="stat-number">{posts.length}</span>
          <span className="stat-label">Posts</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{totalUpvotes}</span>
          <span className="stat-label">Total Upvotes</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{likedPosts.length}</span>
          <span className="stat-label">Posts Liked</span>
        </div>
      </div>

      {/* Your Posts section */}
      <div className="profile-posts-section">
        <h3 className="profile-posts-heading">Your Posts</h3>

        {loading && (
          <div className="global-loading">
            <div className="dot" /><div className="dot" /><div className="dot" />
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="profile-empty">
            <span style={{ fontSize: '2rem' }}>🎮</span>
            <p>You haven't posted anything yet.</p>
          </div>
        )}

        <ul className="posts">
          {posts.map(p => (
            <li key={p.id} className="post-card profile-post-card">
              <div className="profile-post-top">
                <h3 className="profile-post-title">{p.title}</h3>
                <span className="profile-post-upvotes">▲ {p.upvotes || 0}</span>
              </div>
              {p.game_name && (
                <div className="profile-post-game">🎮 {p.game_name}</div>
              )}
              <div className="post-meta">{new Date(p.created_at).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </div>

      {/* Liked Posts section */}
      <div className="profile-posts-section">
        <h3 className="profile-posts-heading">Posts You Liked</h3>

        {loading && (
          <div className="global-loading">
            <div className="dot" /><div className="dot" /><div className="dot" />
          </div>
        )}

        {!loading && likedPosts.length === 0 && (
          <div className="profile-empty">
            <span style={{ fontSize: '2rem' }}>👾</span>
            <p>You haven't liked any posts yet.</p>
          </div>
        )}

        <ul className="posts">
          {likedPosts.map(p => (
            <li key={p.id} className="post-card profile-post-card">
              <div className="profile-post-top">
                <h3 className="profile-post-title">{p.title}</h3>
                <span className="profile-post-upvotes">▲ {p.upvotes || 0}</span>
              </div>
              {p.game_name && (
                <div className="profile-post-game">🎮 {p.game_name}</div>
              )}
              <div className="post-meta">
                By {p.name} • {new Date(p.created_at).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <button className="profile-back-btn" onClick={onBack}>← Back to Feed</button>
    </div>
  )
}