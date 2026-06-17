import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function PostList({ onOpenPost, onOpenProfile, session }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('created_at')
  const [search, setSearch] = useState('')
  const [votingId, setVotingId] = useState(null)

  const uid = session?.user?.id

  const fetchPosts = async () => {
    setLoading(true)

    let query = supabase.from('posts').select('*')
    if (search) query = query.ilike('game_name', `%${search}%`)
    query = query.order('created_at', { ascending: false })

    const { data: postsData } = await query

    if (!postsData || postsData.length === 0) {
      setPosts([])
      setLoading(false)
      return
    }

    const postIds = postsData.map(p => p.id)

    const { data: votesData } = await supabase
      .from('votes')
      .select('post_id, vote_type, user_id')
      .in('post_id', postIds)

    const upvoteMap = {}
    const myVoteMap = {}
    for (const v of (votesData || [])) {
      if (v.vote_type === 'up') upvoteMap[v.post_id] = (upvoteMap[v.post_id] || 0) + 1
      if (uid && v.user_id === uid) myVoteMap[v.post_id] = v.vote_type
    }

    let enriched = postsData.map(p => ({
      ...p,
      liveUpvotes: upvoteMap[p.id] || 0,
      myVote: myVoteMap[p.id] || null,
    }))

    if (sortBy === 'upvotes') enriched = enriched.sort((a, b) => b.liveUpvotes - a.liveUpvotes)

    setPosts(enriched)
    setLoading(false)
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchPosts())
    const sub = supabase
      .channel('public:posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, fetchPosts)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [sortBy])

  const handleUpvote = async (e, post) => {
    e.stopPropagation()
    if (!uid || votingId === post.id) return
    setVotingId(post.id)

    const { data: existing } = await supabase
      .from('votes')
      .select('vote_type')
      .eq('user_id', uid)
      .eq('post_id', post.id)
      .limit(1)

    const vote = existing?.[0] ?? null

    if (vote?.vote_type === 'up') {
      await supabase.from('votes').delete().eq('user_id', uid).eq('post_id', post.id)
    } else if (vote?.vote_type === 'down') {
      await supabase.from('votes').update({ vote_type: 'up' }).eq('user_id', uid).eq('post_id', post.id)
      if (post.user_id !== uid) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          actor_id: uid,
          type: 'like',
          post_id: post.id,
        })
      }
    } else {
      await supabase.from('votes').insert({ user_id: uid, post_id: post.id, vote_type: 'up' })
      if (post.user_id !== uid) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          actor_id: uid,
          type: 'like',
          post_id: post.id,
        })
      }
    }

    setVotingId(null)
    fetchPosts()
  }

  if (loading)
    return <div className="global-loading"><div className="dot" /><div className="dot" /><div className="dot" /></div>

  if (!posts.length)
    return (
      <>
        <div className="feed-controls">
          <input placeholder="Search by game..." value={search} onChange={e => setSearch(e.target.value)} />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="created_at">Newest</option>
            <option value="upvotes">Most upvoted</option>
          </select>
          <button onClick={fetchPosts}>Apply</button>
        </div>
        <div className="empty-state">No posts yet — create one!</div>
      </>
    )

  return (
    <div>
      <div className="feed-controls">
        <input placeholder="Search by game..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="created_at">Newest</option>
          <option value="upvotes">Most upvoted</option>
        </select>
        <button onClick={fetchPosts}>Apply</button>
      </div>

      <ul className="posts">
        {posts.map(p => (
          <li key={p.id} className="post-card" onClick={() => onOpenPost(p)}>
            <div className="post-meta">
              <span
                className="author-link"
                onClick={e => { e.stopPropagation(); onOpenProfile(p.user_id) }}
              >
                {p.name}
              </span>
              {' '}• {new Date(p.created_at).toLocaleString()}
            </div>
            <h3>{p.title}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                className={`upvote-btn${p.myVote === 'up' ? ' active' : ''}`}
                onClick={e => handleUpvote(e, p)}
                disabled={!uid || votingId === p.id}
              >
                ▲ {p.liveUpvotes}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}