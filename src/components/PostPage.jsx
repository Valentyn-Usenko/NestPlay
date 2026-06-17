import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import AuthModal from './AuthModal'

export default function PostPage({ postId, session, onBack, onOpenProfile }) {
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [hasUpvoted, setHasUpvoted] = useState(false)
  const [hasDownvoted, setHasDownvoted] = useState(false)
  const [upvoteCount, setUpvoteCount] = useState(0)
  const [downvoteCount, setDownvoteCount] = useState(0)
  const [selectedCommentId, setSelectedCommentId] = useState(null)
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const [authMode, setAuthMode] = useState(null)

  const uid = session?.user?.id

  const fetchData = async () => {
    setLoading(true)

    const { data: p } = await supabase.from('posts').select('*').eq('id', postId).single()
    const { data: c } = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true })

    const { data: allVotes } = await supabase.from('votes').select('vote_type, user_id').eq('post_id', postId)

    const ups = (allVotes || []).filter(v => v.vote_type === 'up').length
    const downs = (allVotes || []).filter(v => v.vote_type === 'down').length
    const myVote = uid ? (allVotes || []).find(v => v.user_id === uid) : null

    setPost(p)
    setComments(c || [])
    setUpvoteCount(ups)
    setDownvoteCount(downs)
    setHasUpvoted(myVote?.vote_type === 'up')
    setHasDownvoted(myVote?.vote_type === 'down')
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Promise.resolve().then(fetchData)
  }, [postId])

  const addComment = async () => {
    if (!session) { setShowAuthPrompt(true); return }
    if (!commentText) return
    const commentName = session?.user?.user_metadata?.username || session?.user?.email || 'Anon'
    await supabase.from('comments').insert([{ post_id: postId, name: commentName, content: commentText }])
    setCommentText('')
    fetchData()
  }

  const upvote = async () => {
    if (!session) { setShowAuthPrompt(true); return }
    const { data: existing } = await supabase.from('votes').select('vote_type').eq('user_id', uid).eq('post_id', postId).limit(1)
    const vote = existing?.[0] ?? null
    if (vote?.vote_type === 'up') {
      await supabase.from('votes').delete().eq('user_id', uid).eq('post_id', postId)
    } else if (vote?.vote_type === 'down') {
      await supabase.from('votes').update({ vote_type: 'up' }).eq('user_id', uid).eq('post_id', postId)
    } else {
      await supabase.from('votes').insert({ user_id: uid, post_id: postId, vote_type: 'up' })
    }
    fetchData()
  }

  const downvote = async () => {
    if (!session) { setShowAuthPrompt(true); return }
    const { data: existing } = await supabase.from('votes').select('vote_type').eq('user_id', uid).eq('post_id', postId).limit(1)
    const vote = existing?.[0] ?? null
    if (vote?.vote_type === 'down') {
      await supabase.from('votes').delete().eq('user_id', uid).eq('post_id', postId)
    } else if (vote?.vote_type === 'up') {
      await supabase.from('votes').update({ vote_type: 'down' }).eq('user_id', uid).eq('post_id', postId)
    } else {
      await supabase.from('votes').insert({ user_id: uid, post_id: postId, vote_type: 'down' })
    }
    fetchData()
  }

  const handleDelete = async () => {
    await supabase.from('votes').delete().eq('post_id', postId)
    await supabase.from('posts').delete().eq('id', postId)
    onBack()
  }

  const deleteComment = async (commentId) => {
    await supabase.from('comments').delete().eq('id', commentId)
    setSelectedCommentId(null)
    fetchData()
  }

  if (loading)
    return <div className="global-loading"><div className="dot" /><div className="dot" /><div className="dot" /></div>

  if (!post) return <div>Post not found.</div>

  const isOwner = session?.user?.id === post.user_id

  return (
    <div className="post-page">
      <button onClick={onBack}>← Back</button>
      <h2>{post.title}</h2>
      <div className="meta">
        By{' '}
        <span
          className="author-link"
          onClick={() => onOpenProfile(post.user_id)}
        >
          {post.name}
        </span>
        {' '}• {new Date(post.created_at).toLocaleString()}
      </div>

      {post.game_art_url && <img className="game-art" src={post.game_art_url} alt="art" />}
      <p>{post.content}</p>

      <button onClick={upvote} style={{ backgroundColor: hasUpvoted ? '#4CAF50' : '' }}>
        Upvote ({upvoteCount})
      </button>
      <button onClick={downvote} style={{ backgroundColor: hasDownvoted ? '#f44336' : '' }}>
        Downvote ({downvoteCount})
      </button>

      <div className="comments">
        <h3>Comments</h3>
        {comments.map(c => (
          <div
            key={c.id}
            className="comment"
            style={{ cursor: 'pointer', position: 'relative' }}
            onClick={() => setSelectedCommentId(selectedCommentId === c.id ? null : c.id)}
          >
            <div className="c-meta">{c.name} • {new Date(c.created_at).toLocaleString()}</div>
            <div>{c.content}</div>
            {selectedCommentId === c.id && (
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#333', borderRadius: '4px' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteComment(c.id) }}
                  style={{ color: '#f44336', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Delete comment
                </button>
              </div>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <textarea
            placeholder={session ? 'Write a comment' : 'Log in to comment...'}
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            style={{ flex: 1, opacity: session ? 1 : 0.5, cursor: session ? 'text' : 'not-allowed' }}
            readOnly={!session}
            onClick={() => { if (!session) setShowAuthPrompt(true) }}
          />
          <button onClick={addComment}>Add comment</button>
        </div>
      </div>

      {isOwner && (
        <div className="danger-zone">
          <h4>Delete post</h4>
          <label>
            <input type="checkbox" checked={confirmDelete} onChange={e => setConfirmDelete(e.target.checked)} />
            I confirm I want to delete this post
          </label>
          <button onClick={handleDelete} disabled={!confirmDelete}>Delete</button>
        </div>
      )}

      {showAuthPrompt && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <button className="close-btn" onClick={() => setShowAuthPrompt(false)}>×</button>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎮</div>
            <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Join the Conversation</h2>
            <p style={{ color: '#aaa', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Create a free account to upvote, downvote, comment, and share your take on games with the community.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn-primary" style={{ padding: '0.85rem', fontSize: '1rem', width: '100%' }}
                onClick={() => { setShowAuthPrompt(false); setAuthMode('signup') }}>
                Create Free Account
              </button>
              <button className="btn-ghost" style={{ padding: '0.75rem', width: '100%' }}
                onClick={() => { setShowAuthPrompt(false); setAuthMode('login') }}>
                Already have an account? Log in
              </button>
            </div>
          </div>
        </div>
      )}

      {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} />}
    </div>
  )
}