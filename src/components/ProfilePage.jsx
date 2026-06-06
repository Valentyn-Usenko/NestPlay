import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import ChatModal from './ChatModal'

const AVATAR_COLORS = [
  { id: 'purple', gradient: 'linear-gradient(135deg, #646cff, #a78bfa)' },
  { id: 'red',    gradient: 'linear-gradient(135deg, #fc4646, #ff8c00)' },
  { id: 'green',  gradient: 'linear-gradient(135deg, #11998e, #38ef7d)' },
  { id: 'blue',   gradient: 'linear-gradient(135deg, #2193b0, #6dd5ed)' },
  { id: 'pink',   gradient: 'linear-gradient(135deg, #f953c6, #b91d73)' },
  { id: 'gold',   gradient: 'linear-gradient(135deg, #f7971e, #ffd200)' },
]

const AVATAR_MAP = {
  purple: 'linear-gradient(135deg, #646cff, #a78bfa)',
  red:    'linear-gradient(135deg, #fc4646, #ff8c00)',
  green:  'linear-gradient(135deg, #11998e, #38ef7d)',
  blue:   'linear-gradient(135deg, #2193b0, #6dd5ed)',
  pink:   'linear-gradient(135deg, #f953c6, #b91d73)',
  gold:   'linear-gradient(135deg, #f7971e, #ffd200)',
}

export default function ProfilePage({ session, onBack, onOpenProfile }) {
  const [posts, setPosts] = useState([])
  const [likedPosts, setLikedPosts] = useState([])
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarColor, setAvatarColor] = useState('purple')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarPanelOpen, setAvatarPanelOpen] = useState(false)
  const [chatFriend, setChatFriend] = useState(null)
  const mountedRef = useRef(true)
  const fileInputRef = useRef()

  const username = session?.user?.user_metadata?.username || session?.user?.email || 'Anonymous'
  const avatarLetter = username.charAt(0).toUpperCase()
  const joinDate = new Date(session?.user?.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
  const currentGradient = AVATAR_COLORS.find(c => c.id === avatarColor)?.gradient || AVATAR_COLORS[0].gradient

  useEffect(() => {
    mountedRef.current = true

    async function fetchAll() {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url, avatar_color')
        .eq('id', session.user.id)
        .single()

      const { data: userPosts } = await supabase
        .from('posts').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false })

      const postIds = (userPosts || []).map(p => p.id)
      let upvoteMap = {}
      if (postIds.length > 0) {
        const { data: votesData } = await supabase
          .from('votes').select('post_id').in('post_id', postIds).eq('vote_type', 'up')
        for (const v of (votesData || [])) upvoteMap[v.post_id] = (upvoteMap[v.post_id] || 0) + 1
      }

      const { data: voteRows } = await supabase
        .from('votes').select('post_id').eq('user_id', session.user.id).eq('vote_type', 'up')

      const likedPostIds = (voteRows || []).map(v => v.post_id)
      let likedPostsData = []
      if (likedPostIds.length > 0) {
        const { data } = await supabase.from('posts').select('*').in('id', likedPostIds).order('created_at', { ascending: false })
        likedPostsData = data || []
      }

      const { data: friendRows } = await supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)

      const friendIds = (friendRows || []).map(r =>
        r.sender_id === session.user.id ? r.receiver_id : r.sender_id
      )

      let friendProfiles = []
      if (friendIds.length > 0) {
        const { data: fp } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, avatar_color')
          .in('id', friendIds)
        friendProfiles = (fp || []).map(p => {
          const row = friendRows.find(r => r.sender_id === p.id || r.receiver_id === p.id)
          return { ...p, requestId: row?.id }
        })
      }

      if (!mountedRef.current) return

      setAvatarUrl(profile?.avatar_url || null)
      setAvatarColor(profile?.avatar_color || 'purple')
      setPosts((userPosts || []).map(p => ({ ...p, liveUpvotes: upvoteMap[p.id] || 0 })))
      setLikedPosts(likedPostsData)
      setFriends(friendProfiles)
      setLoading(false)
    }

    fetchAll()

    return () => { mountedRef.current = false }
  }, [session])

  const saveProfile = async (fields) => {
    await supabase
      .from('profiles')
      .upsert({ id: session.user.id, username, ...fields }, { onConflict: 'id' })
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${session.user.id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars').upload(path, file, { upsert: true, cacheControl: '0' })
    if (uploadError) { alert('Upload failed: ' + uploadError.message); setUploadingAvatar(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const bustedUrl = `${publicUrl}?t=${Date.now()}`
    await saveProfile({ avatar_url: bustedUrl, avatar_color: avatarColor })
    if (mountedRef.current) { setAvatarUrl(bustedUrl); setUploadingAvatar(false) }
  }

  const handleColorPick = async (colorId) => {
    setAvatarColor(colorId)
    setAvatarUrl(null)
    await saveProfile({ avatar_color: colorId, avatar_url: null })
  }

  const handleResetAvatar = async () => {
    setAvatarUrl(null)
    await saveProfile({ avatar_url: null })
  }

  const handleRemoveFriend = async (requestId, friendId) => {
    await supabase.from('friend_requests').delete().eq('id', requestId)
    if (mountedRef.current) setFriends(prev => prev.filter(f => f.id !== friendId))
  }

  const totalUpvotes = posts.reduce((sum, p) => sum + p.liveUpvotes, 0)

  return (
    <div className="profile-page">

      <div className="profile-hero">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="avatar" className="profile-avatar-large" style={{ objectFit: 'cover' }} />
            : <div className="profile-avatar-large" style={{ background: currentGradient }}>{avatarLetter}</div>
          }
          <button onClick={() => setAvatarPanelOpen(o => !o)} disabled={uploadingAvatar} className="avatar-edit-btn">
            {uploadingAvatar ? '…' : '✏️'}
          </button>
          <input ref={fileInputRef} type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,image/bmp"
            style={{ display: 'none' }} onChange={handleAvatarUpload} />
        </div>
        <div className="profile-hero-info">
          <h2 className="profile-username">{username}</h2>
          <p className="profile-joined">Member since {joinDate}</p>
        </div>
      </div>

      {avatarPanelOpen && (
        <div className="avatar-edit-panel">
          <div className="avatar-edit-panel-row">
            <button className="btn-primary" style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}
              onClick={() => fileInputRef.current.click()} disabled={uploadingAvatar}>
              {uploadingAvatar ? 'Uploading…' : '📷 Upload Photo'}
            </button>
            {avatarUrl && (
              <button className="settings-edit-btn" onClick={handleResetAvatar}>Reset to Default</button>
            )}
          </div>
          {!avatarUrl && (
            <>
              <p className="settings-color-label">Pick a color:</p>
              <div className="avatar-color-grid">
                {AVATAR_COLORS.map(c => (
                  <button key={c.id}
                    className={`avatar-color-swatch ${avatarColor === c.id ? 'selected' : ''}`}
                    style={{ background: c.gradient }}
                    onClick={() => handleColorPick(c.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="profile-stats">
        <div className="stat-card"><span className="stat-number">{posts.length}</span><span className="stat-label">Posts</span></div>
        <div className="stat-card"><span className="stat-number">{totalUpvotes}</span><span className="stat-label">Total Upvotes</span></div>
        <div className="stat-card"><span className="stat-number">{likedPosts.length}</span><span className="stat-label">Posts Liked</span></div>
        <div className="stat-card"><span className="stat-number">{friends.length}</span><span className="stat-label">Friends</span></div>
      </div>

      <div className="profile-posts-section">
        <h3 className="profile-posts-heading">Friends</h3>
        {loading && <div className="global-loading"><div className="dot" /><div className="dot" /><div className="dot" /></div>}
        {!loading && friends.length === 0 && (
          <div className="profile-empty"><span style={{ fontSize: '2rem' }}>👥</span><p>No friends yet. Add some!</p></div>
        )}
        <div className="friends-grid">
          {friends.map(f => {
            const letter = (f.username || '?').charAt(0).toUpperCase()
            const gradient = AVATAR_MAP[f.avatar_color || 'purple']
            return (
              <div key={f.id} className="friend-card">
                <div className="friend-card-left" onClick={() => onOpenProfile?.(f.id)} style={{ cursor: 'pointer' }}>
                  {f.avatar_url
                    ? <img src={f.avatar_url} alt="avatar" className="friend-avatar" />
                    : <div className="friend-avatar" style={{ background: gradient }}>{letter}</div>
                  }
                  <span className="friend-name">{f.username || 'Unknown'}</span>
                </div>
                <div className="friend-card-actions">
                  <button className="friend-msg-btn" onClick={() => setChatFriend(f)}>💬</button>
                  <button className="friend-remove-btn" onClick={() => handleRemoveFriend(f.requestId, f.id)}>Remove</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="profile-posts-section">
        <h3 className="profile-posts-heading">Your Posts</h3>
        {loading && <div className="global-loading"><div className="dot" /><div className="dot" /><div className="dot" /></div>}
        {!loading && posts.length === 0 && (
          <div className="profile-empty"><span style={{ fontSize: '2rem' }}>🎮</span><p>You haven't posted anything yet.</p></div>
        )}
        <ul className="posts">
          {posts.map(p => (
            <li key={p.id} className="post-card profile-post-card">
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

      <div className="profile-posts-section">
        <h3 className="profile-posts-heading">Posts You Liked</h3>
        {loading && <div className="global-loading"><div className="dot" /><div className="dot" /><div className="dot" /></div>}
        {!loading && likedPosts.length === 0 && (
          <div className="profile-empty"><span style={{ fontSize: '2rem' }}>👾</span><p>You haven't liked any posts yet.</p></div>
        )}
        <ul className="posts">
          {likedPosts.map(p => (
            <li key={p.id} className="post-card profile-post-card">
              <div className="profile-post-top">
                <h3 className="profile-post-title">{p.title}</h3>
                <span className="profile-post-upvotes">▲ {p.upvotes || 0}</span>
              </div>
              {p.game_name && <div className="profile-post-game">🎮 {p.game_name}</div>}
              <div className="post-meta">By {p.name} • {new Date(p.created_at).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </div>

      <button className="profile-back-btn" onClick={onBack}>← Back to Feed</button>

      {chatFriend && (
        <ChatModal session={session} friend={chatFriend} onClose={() => setChatFriend(null)} />
      )}
    </div>
  )
}