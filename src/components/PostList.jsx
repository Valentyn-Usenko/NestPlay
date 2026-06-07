import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function PostList({ onOpenPost, onOpenProfile }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('created_at')
  const [search, setSearch] = useState('')

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
      .select('post_id, vote_type')
      .in('post_id', postIds)
      .eq('vote_type', 'up')

    const upvoteMap = {}
    for (const v of (votesData || [])) {
      upvoteMap[v.post_id] = (upvoteMap[v.post_id] || 0) + 1
    }

    let enriched = postsData.map(p => ({ ...p, liveUpvotes: upvoteMap[p.id] || 0 }))
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

  if (loading)
    return <div className="global-loading"><div className="dot" /><div className="dot" /><div className="dot" /></div>

  if (!posts.length)
    return <div className="empty-state">No posts yet — create one!</div>

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
            <div className="upvotes">▲ {p.liveUpvotes}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}