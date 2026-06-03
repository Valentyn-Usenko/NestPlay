import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'

export default function ProfilePage({ session, onBack }) {
  const [posts, setPosts] = useState([])
  const [likedPosts, setLikedPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef()

  const username = session?.user?.user_metadata?.username || session?.user?.email || 'Anonymous'
  const email = session?.user?.email || ''
  const avatarLetter = username.charAt(0).toUpperCase()
  const joinDate = new Date(session?.user?.created_at).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)

      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', session.user.id)
        .single()
      setAvatarUrl(profile?.avatar_url || null)

      const { data: userPosts } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', session.user.id)
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

      const { data: voteRows } = await supabase
        .from('votes')
        .select('post_id')
        .eq('user_id', session.user.id)
        .eq('vote_type', 'up')

      const likedPostIds = (voteRows || []).map(v => v.post_id)
      let likedPostsData = []
      if (likedPostIds.length > 0) {
        const { data } = await supabase
          .from('posts')
          .select('*')
          .in('id', likedPostIds)
          .order('created_at', { ascending: false })
        likedPostsData = data || []
      }

      setPosts(enrichedPosts)
      setLikedPosts(likedPostsData)
      setLoading(false)
    }

    fetchAll()
  }, [session])

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)

    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${session.user.id}.${ext}`

    console.log('Uploading to path:', path)
    console.log('File type:', file.type)
    console.log('Bucket: avatars')

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    console.log('Upload result:', uploadData, uploadError)

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setUploadingAvatar(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

    await supabase.from('profiles').upsert({ id: session.user.id, avatar_url: publicUrl, username })

    setAvatarUrl(publicUrl)
    setUploadingAvatar(false)
  }

  const totalUpvotes = posts.reduce((sum, p) => sum + p.liveUpvotes, 0)

  return (
    <div className="profile-page">

      {/* Hero card */}
      <div className="profile-hero">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="avatar" className="profile-avatar-large" style={{ objectFit: 'cover' }} />
            : <div className="profile-avatar-large">{avatarLetter}</div>
          }
          <button
            onClick={() => fileInputRef.current.click()}
            disabled={uploadingAvatar}
            style={{
              position: 'absolute', bottom: 0, right: 0,
              background: '#646cff', border: 'none', borderRadius: '50%',
              width: '28px', height: '28px', cursor: 'pointer',
              fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff'
            }}
          >
            {uploadingAvatar ? '…' : '✏️'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,image/bmp,image/tiff"
            style={{ display: 'none' }}
            onChange={handleAvatarUpload}
          />
        </div>
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

      {/* Liked Posts section */}
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
    </div>
  )
}