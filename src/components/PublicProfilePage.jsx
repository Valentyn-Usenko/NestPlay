import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'

const AVATAR_COLORS = {
  purple: 'linear-gradient(135deg, #646cff, #a78bfa)',
  red:    'linear-gradient(135deg, #fc4646, #ff8c00)',
  green:  'linear-gradient(135deg, #11998e, #38ef7d)',
  blue:   'linear-gradient(135deg, #2193b0, #6dd5ed)',
  pink:   'linear-gradient(135deg, #f953c6, #b91d73)',
  gold:   'linear-gradient(135deg, #f7971e, #ffd200)',
}

export default function PublicProfilePage({ userId, session, onBack, onOpenPost, onOpenProfile }) {
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)
  const [isPrivate, setIsPrivate] = useState(false)
  const [friendStatus, setFriendStatus] = useState(null)
  const [sendingRequest, setSendingRequest] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    async function fetchAll() {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, avatar_url, avatar_color, is_private, created_at')
        .eq('id', userId)
        .single()

      let fetchedPosts = []
      let fetchedFriends = []

      if (!profileData?.is_private) {
        const { data: userPosts } = await supabase
          .from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false })

        const postIds = (userPosts || []).map(p => p.id)
        let upvoteMap = {}
        if (postIds.length > 0) {
          const { data: votesData } = await supabase
            .from('votes').select('post_id').in('post_id', postIds).eq('vote_type', 'up')
          for (const v of (votesData || [])) upvoteMap[v.post_id] = (upvoteMap[v.post_id] || 0) + 1
        }
        fetchedPosts = (userPosts || []).map(p => ({ ...p, liveUpvotes: upvoteMap[p.id] || 0 }))

        const { data: friendRows } = await supabase
          .from('friend_requests')
          .select('sender_id, receiver_id')
          .eq('status', 'accepted')
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)

        const friendIds = (friendRows || []).map(r => r.sender_id === userId ? r.receiver_id : r.sender_id)
        if (friendIds.length > 0) {
          const { data: fp } = await supabase
            .from('profiles').select('id, username, avatar_url, avatar_color').in('id', friendIds)
          fetchedFriends = fp || []
        }
      }

      let status = null
      if (session) {
        const { data: reqData } = await supabase
          .from('friend_requests')
          .select('status, sender_id')
          .or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${session.user.id})`)
          .maybeSingle()

        if (reqData) {
          if (reqData.status === 'accepted') status = 'friends'
          else if (reqData.sender_id === session.user.id) status = 'sent'
          else status = 'received'
        }
      }

      if (!mountedRef.current) return

      setProfile(profileData)
      setIsPrivate(profileData?.is_private || false)
      setPosts(fetchedPosts)
      setFriends(fetchedFriends)
      setFriendStatus(status)
      setLoading(false)
    }

    fetchAll()

    return () => { mountedRef.current = false }
  }, [userId, session])

  const handleSendRequest = async () => {
    if (!session) return
    setSendingRequest(true)
    await supabase.from('friend_requests').insert({
      sender_id: session.user.id,
      receiver_id: userId,
      status: 'pending'
    })
    if (mountedRef.current) {
      setFriendStatus('sent')
      setSendingRequest(false)
    }
  }

  if (loading)
    return <div className="global-loading"><div className="dot" /><div className="dot" /><div className="dot" /></div>

  const username = profile?.username || 'Unknown'
  const avatarLetter = username.charAt(0).toUpperCase()
  const avatarGradient = AVATAR_COLORS[profile?.avatar_color || 'purple']
  const joinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'
  const totalUpvotes = posts.reduce((sum, p) => sum + p.liveUpvotes, 0)

  const friendBtn = () => {
    if (!session) return null
    if (friendStatus === 'friends') return <span className="friend-badge">✅ Friends</span>
    if (friendStatus === 'sent') return <span className="friend-badge pending">📨 Request Sent</span>
    if (friendStatus === 'received') return <span className="friend-badge pending">📬 Sent you a request</span>
    return (
      <button className="btn-primary friend-request-btn" onClick={handleSendRequest} disabled={sendingRequest}>
        {sendingRequest ? 'Sending…' : '➕ Add Friend'}
      </button>
    )
  }

  return (
    <div className="profile-page">

      <div className="profile-hero">
        {profile?.avatar_url
          ? <img src={profile.avatar_url} alt="avatar" className="profile-avatar-large" style={{ objectFit: 'cover' }} />
          : <div className="profile-avatar-large" style={{ background: avatarGradient }}>{avatarLetter}</div>
        }
        <div className="profile-hero-info">
          <h2 className="profile-username">{username}</h2>
          <p className="profile-joined">Member since {joinDate}</p>
          {isPrivate && <span className="private-badge">🔒 Private Profile</span>}
          <div style={{ marginTop: '0.5rem' }}>{friendBtn()}</div>
        </div>
      </div>

      {isPrivate ? (
        <div className="private-wall">
          <span style={{ fontSize: '2.5rem' }}>🔒</span>
          <h3>This profile is private</h3>
          <p>This user has chosen to keep their posts private.</p>
        </div>
      ) : (
        <>
          <div className="profile-stats">
            <div className="stat-card"><span className="stat-number">{posts.length}</span><span className="stat-label">Posts</span></div>
            <div className="stat-card"><span className="stat-number">{totalUpvotes}</span><span className="stat-label">Total Upvotes</span></div>
            <div className="stat-card"><span className="stat-number">{friends.length}</span><span className="stat-label">Friends</span></div>
          </div>

          <div className="profile-posts-section">
            <h3 className="profile-posts-heading">Friends</h3>
            {friends.length === 0 && (
              <div className="profile-empty"><span style={{ fontSize: '2rem' }}>👥</span><p>No friends yet.</p></div>
            )}
            <div className="friends-grid">
              {friends.map(f => {
                const letter = (f.username || '?').charAt(0).toUpperCase()
                const gradient = AVATAR_COLORS[f.avatar_color || 'purple']
                return (
                  <div key={f.id} className="friend-card" onClick={() => onOpenProfile?.(f.id)} style={{ cursor: 'pointer' }}>
                    <div className="friend-card-left">
                      {f.avatar_url
                        ? <img src={f.avatar_url} alt="avatar" className="friend-avatar" />
                        : <div className="friend-avatar" style={{ background: gradient }}>{letter}</div>
                      }
                      <span className="friend-name">{f.username || 'Unknown'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

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
        </>
      )}

      <button className="profile-back-btn" onClick={onBack}>← Back to Feed</button>
    </div>
  )
}