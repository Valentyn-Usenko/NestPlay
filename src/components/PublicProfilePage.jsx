import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function PublicProfilePage({ userId, onBack, onOpenPost }) {
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, avatar_url, created_at')
        .eq('id', userId)
        .single()

      const { data: userPosts } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      const postIds = (userPosts || []).map(p => p.id)
      let upvoteMap = {}
      if (postIds.length > 0) {
        const { data: votesData } = await supabase
          .from('votes')
          .select('post_id')
          .in('post_id', postIds)
          .eq('vote_type', 'up')
        for (const v of (votesData || [])) {
          upvoteMap[v.post_id] = (upvoteMap[v.post_id] || 0) + 1
        }
      }

      const enrichedPosts = (userPosts || []).map(p => ({ ...p, liveUpvotes: upvoteMap[p.id] || 0 }))

      setProfile(profileData)
      setPosts(enrichedPosts)
      setLoading(false)
    }

    fetchAll()
  }, [userId])

  if (loading)
    return <div className="global-loading"><div className="dot" /><div className="dot" /><div className="dot" /></div>

  const username = profile?.username || 'Unknown'
  const avatarLetter = username.charAt(0).toUpperCase()
  const joinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'
  const totalUpvotes = posts.reduce((sum, p) => sum + p.liveUpvotes, 0)

  return (
    <div className="profile-page">

      {}
      <div className="profile-hero">
        {profile?.avatar_url
          ? <img src={profile.avatar_url} alt="avatar" className="profile-avatar-large" style={{ objectFit: 'cover' }} />
          : <div className="profile-avatar-large">{avatarLetter}</div>
        }
        <div className="profile-hero-info">
          <h2 className="profile-username">{username}</h2>
          <p className="profile-joined">Member since {joinDate}</p>
        </div>
      </div>

      {}
      <div className="profile-stats">
        <div className="stat-card">
          <span className="stat-number">{posts.length}</span>
          <span className="stat-label">Posts</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{totalUpvotes}</span>
          <span className="stat-label">Total Upvotes</span>
        </div>
      </div>

      {}
      <div className="profile-posts-section">
        <h3 className="profile-posts-heading">{username}'s Posts</h3>
        {posts.length === 0 && (
          <div className="profile-empty"><span style={{ fontSize: '2rem' }}>🎮</span><p>No posts yet.</p></div>
        )}
        <ul className="posts">
          {posts.map(p => (
            <li key={p.id} className="post-card profile-post-card" onClick={() => onOpenPost(p)} style={{ cursor: 'pointer' }}>
              <div className="profile-post-top">
                <h3 className="profile-post-title">{p.title}</h3>
                <span className="profile-post-upvotes">▲ {p.liveUpvotes}</span>
              </div>
              {p.game_name && <div className="profile-post-game">🎮 {p.game_name}</div>}
              <div className="post-meta">{new Date(p.created_at).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </div>

      <button className="profile-back-btn" onClick={onBack}>← Back to Feed</button>
    </div>
  )
}