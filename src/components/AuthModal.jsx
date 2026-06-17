import React, { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function AuthModal({ mode, onClose }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

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
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.trim() },
          },
        })
        if (signUpError) throw signUpError
        if (data.user && !data.session) {
          setConfirmSent(true)
        } else {
          onClose()
        }
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

  if (confirmSent) {
    return (
      <div className="modal-overlay">
        <div className="modal" style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📬</div>
          <h2 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Check your email</h2>
          <p style={{ color: '#aaa', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            We sent a confirmation link to <strong style={{ color: '#fff' }}>{email}</strong>. Click it to activate your account, then come back and log in.
          </p>
          <button className="btn-primary" style={{ width: '100%', padding: '0.8rem' }} onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    )
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