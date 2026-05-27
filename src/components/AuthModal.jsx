import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function AuthModal({ mode, onClose }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (mode === 'signup' && username.trim().length < 3) {
      setError('Username must be at least 3 characters.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.trim() },
          },
        })
        if (signUpError) throw signUpError
        onClose()
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        onClose()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    padding: '0.8rem',
    borderRadius: '6px',
    border: '1px solid #333',
    background: '#1a1a1a',
    color: '#fff',
    width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '400px' }}>
        <button className="close-btn" onClick={onClose}>×</button>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>
          {mode === 'signup' ? 'Create an Account' : 'Welcome Back'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Username (min. 3 characters)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={inputStyle}
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />

          {error && (
            <div style={{ color: '#fc4646', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>
          )}

          <button type="submit" disabled={loading} style={{ marginTop: '0.5rem', padding: '0.8rem' }}>
            {loading ? 'Processing...' : mode === 'signup' ? 'Sign Up' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  )
}