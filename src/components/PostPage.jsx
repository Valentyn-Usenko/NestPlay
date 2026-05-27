import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function PostPage({ postId, session, onBack }) {
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [hasUpvoted, setHasUpvoted] = useState(false)
  const [hasDownvoted, setHasDownvoted] = useState(false)
  const [selectedCommentId, setSelectedCommentId] = useState(null)

  const fetchData = async () => {
    setLoading(true)

    const { data: p } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single()

    const { data: c } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    setPost(p)
    setComments(c || [])

    const upvotedPosts = JSON.parse(localStorage.getItem('upvotedPosts') || '[]')
    const downvotedPosts = JSON.parse(localStorage.getItem('downvotedPosts') || '[]')
    setHasUpvoted(upvotedPosts.includes(postId))
    setHasDownvoted(downvotedPosts.includes(postId))

    setLoading(false)
  }

  useEffect(() => {
    Promise.resolve().then(fetchData)
  }, [postId])

  const addComment = async () => {
    if (!commentText) return
    const commentName = session?.user?.user_metadata?.username || session?.user?.email || 'Anon'
    await supabase.from('comments').insert([{ post_id: postId, name: commentName, content: commentText }])
    setCommentText('')
    fetchData()
  }

  const upvote = async () => {
    const { data: p } = await supabase.from('posts').select('upvotes').eq('id', postId).single()
    const upvotedPosts = JSON.parse(localStorage.getItem('upvotedPosts') || '[]')
    const downvotedPosts = JSON.parse(localStorage.getItem('downvotedPosts') || '[]')

    if (hasUpvoted) {
      upvotedPosts.splice(upvotedPosts.indexOf(postId), 1)
      await supabase.from('posts').update({ upvotes: (p.upvotes || 1) - 1 }).eq('id', postId)
      setHasUpvoted(false)
    } else {
      if (hasDownvoted) {
        downvotedPosts.splice(downvotedPosts.indexOf(postId), 1)
        await supabase.from('posts').update({ downvotes: (p.downvotes || 1) - 1 }).eq('id', postId)
        setHasDownvoted(false)
      }
      upvotedPosts.push(postId)
      await supabase.from('posts').update({ upvotes: (p.upvotes || 0) + 1 }).eq('id', postId)
      setHasUpvoted(true)
    }

    localStorage.setItem('upvotedPosts', JSON.stringify(upvotedPosts))
    localStorage.setItem('downvotedPosts', JSON.stringify(downvotedPosts))
    fetchData()
  }

  const downvote = async () => {
    const { data: p } = await supabase.from('posts').select('downvotes, upvotes').eq('id', postId).single()
    const upvotedPosts = JSON.parse(localStorage.getItem('upvotedPosts') || '[]')
    const downvotedPosts = JSON.parse(localStorage.getItem('downvotedPosts') || '[]')

    if (hasDownvoted) {
      downvotedPosts.splice(downvotedPosts.indexOf(postId), 1)
      await supabase.from('posts').update({ downvotes: (p.downvotes || 1) - 1 }).eq('id', postId)
      setHasDownvoted(false)
    } else {
      if (hasUpvoted) {
        upvotedPosts.splice(upvotedPosts.indexOf(postId), 1)
        await supabase.from('posts').update({ upvotes: (p.upvotes || 1) - 1 }).eq('id', postId)
        setHasUpvoted(false)
      }
      downvotedPosts.push(postId)
      await supabase.from('posts').update({ downvotes: (p.downvotes || 0) + 1 }).eq('id', postId)
      setHasDownvoted(true)
    }

    localStorage.setItem('upvotedPosts', JSON.stringify(upvotedPosts))
    localStorage.setItem('downvotedPosts', JSON.stringify(downvotedPosts))
    fetchData()
  }

  const handleDelete = async () => {
    await supabase.from('posts').delete().eq('id', postId)
    onBack()
  }

  const deleteComment = async (commentId) => {
    await supabase.from('comments').delete().eq('id', commentId)
    setSelectedCommentId(null)
    fetchData()
  }

  if (loading)
    return (
      <div className="global-loading">
        <div className="dot" /><div className="dot" /><div className="dot" />
      </div>
    )

  if (!post) return <div>Post not found.</div>

  const isOwner = session?.user?.id === post.user_id

  return (
    <div className="post-page">
      <button onClick={onBack}>← Back</button>
      <h2>{post.title}</h2>
      <div className="meta">
        By {post.name} • {new Date(post.created_at).toLocaleString()}
      </div>

      {post.game_art_url && (
        <img className="game-art" src={post.game_art_url} alt="art" />
      )}

      <p>{post.content}</p>

      <button onClick={upvote} style={{ backgroundColor: hasUpvoted ? '#4CAF50' : '' }}>
        Upvote ({post.upvotes || 0})
      </button>
      <button onClick={downvote} style={{ backgroundColor: hasDownvoted ? '#f44336' : '' }}>
        Downvote ({post.downvotes || 0})
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
            <div className="c-meta">
              {c.name} • {new Date(c.created_at).toLocaleString()}
            </div>
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
            placeholder="Write a comment"
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            style={{ flex: 1 }}
          />
          <button onClick={addComment}>Add comment</button>
        </div>
      </div>

      {/* Only the post owner sees the delete section */}
      {isOwner && (
        <div className="danger-zone">
          <h4>Delete post</h4>
          <label>
            <input
              type="checkbox"
              checked={confirmDelete}
              onChange={e => setConfirmDelete(e.target.checked)}
            />
            I confirm I want to delete this post
          </label>
          <button onClick={handleDelete} disabled={!confirmDelete}>Delete</button>
        </div>
      )}
    </div>
  )
}