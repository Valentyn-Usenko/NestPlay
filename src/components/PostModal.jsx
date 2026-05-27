import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function PostModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [shortOpinion, setShortOpinion] = useState('')
  const [content, setContent] = useState('')
  const [password, setPassword] = useState('')
  const [query, setQuery] = useState('')
  const [games, setGames] = useState([])
  const [loadingGames, setLoadingGames] = useState(false)
  const [selectedGame, setSelectedGame] = useState(null)
  const [passwordOptional, setPasswordOptional] = useState(false)

  useEffect(() => {
    if (!query) return
    let canceled = false

    ;(async () => {
      setLoadingGames(true)
      try {
        const key = "4055a1accfce45c49cd0d383b551b795"
        const res = await fetch(`https://api.rawg.io/api/games?search=${encodeURIComponent(query)}&key=${key}`)
        const json = await res.json()
        if (!canceled) setGames(json.results || [])
      } catch (e) {
        console.error('RAWG search failed', e)
      } finally {
        if (!canceled) setLoadingGames(false)
      }
    })()

    return () => { canceled = true }
  }, [query])

  async function handleCreate(e) {
    e.preventDefault()
    if (!name) {
      alert('Name is required.')
      return
    }
    if (!title) {
      alert('Title is required.')
      return
    }
    if (!selectedGame) {
      alert('Please select a game.')
      return
    }
    if (!passwordOptional && !password) {
      alert('Password is required to create a post.')
      return
    }

    async function hashSecret(secret) {
      const enc = new TextEncoder()
      const data = enc.encode(secret)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
    }

    const hashed = password ? await hashSecret(password) : null

    const payload = {
      title,
      name,
      short_opinion: shortOpinion,
      content,
      game_id: selectedGame?.id || null,
      game_name: selectedGame?.name || null,
      game_art_url: selectedGame?.background_image || null,
      password: hashed
    }

    const { data, error } = await supabase.from('posts').insert([payload]).select().single()
    if (error) return alert('Error creating post: ' + error.message)

    onCreated(data)
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2>Create a post</h2>

        <form onSubmit={handleCreate}>
          <label>Your name (required)
            <input required value={name} onChange={e => setName(e.target.value)} />
          </label>

          <label>Post title (required)
            <input required value={title} onChange={e => setTitle(e.target.value)} />
          </label>

          <label>Short opinion
            <input value={shortOpinion} onChange={e => setShortOpinion(e.target.value)} />
          </label>

          {}
          <div className="game-search">
            <label>Search game</label>
            <input placeholder="Type to search..." value={query} onChange={e => setQuery(e.target.value)} />

            {loadingGames && <div className="small-loading">Searching RAWG...</div>}

            <div className="games-list">
              {games.map(g => (
                <button 
                  type="button"
                  key={g.id}
                  className={selectedGame?.id === g.id ? 'selected' : ''}
                  onClick={() => setSelectedGame(g)}
                >
                  <img src={g.background_image} alt="cover" />
                  <div>{g.name}</div>
                </button>
              ))}
            </div>
          </div>

          {selectedGame && (
            <div className="selected-game-preview">
              <h3>Selected: {selectedGame.name}</h3>
              <img src={selectedGame.background_image} alt="art" />
              <textarea placeholder="Full opinion" value={content} onChange={e => setContent(e.target.value)} />
            </div>
          )}

          <label>Override image URL (optional)
            <input onChange={e =>
              setSelectedGame(prev => prev ? { ...prev, background_image: e.target.value } : { background_image: e.target.value })
            } />
          </label>

          <label>Password
            <input
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={passwordOptional}
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={passwordOptional}
              onChange={e => setPasswordOptional(e.target.checked)}
            />
            Make password optional
          </label>

          <div className="modal-actions">
            <button type="submit" disabled={!name || !title || !selectedGame || (!passwordOptional && !password)}>Create post</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
