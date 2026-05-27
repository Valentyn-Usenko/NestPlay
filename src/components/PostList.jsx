import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function PostList({ onOpenPost }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('created_at')
  const [search, setSearch] = useState('')

  const fetchPosts = async () => {
    setLoading(true)

    let query = supabase.from('posts').select('*')
    if (search) query = query.ilike('title', `%${search}%`)
    if (sortBy === 'upvotes') query = query.order('upvotes', { ascending: false })
    else query = query.order('created_at', { ascending: false })

    const { data } = await query
    setPosts(data || [])
    setLoading(false)
  }

  useEffect(() => {
  Promise.resolve().then(() => fetchPosts());

  const sub = supabase
    .channel('public:posts')
    .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'posts' }, 
        fetchPosts)
    .subscribe();

  return () => supabase.removeChannel(sub);
}, [sortBy]);


  if (loading)
    return (
      <div className="global-loading">
        <div className="dot" /><div className="dot" /><div className="dot" />
      </div>
    )

  if (!posts.length)
    return <div className="empty-state">No posts yet — create one!</div>

  return (
    <div>
      <div className="feed-controls">
        <input placeholder="Search title" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="created_at">Newest</option>
          <option value="upvotes">Most upvoted</option>
        </select>
        <button onClick={fetchPosts}>Apply</button>
      </div>

      <ul className="posts">
        {posts.map(p => (
          <li key={p.id} className="post-card" onClick={() => onOpenPost(p)}>
            <div className="post-meta">{new Date(p.created_at).toLocaleString()}</div>
            <h3>{p.title}</h3>
            <div className="upvotes">▲ {p.upvotes}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
