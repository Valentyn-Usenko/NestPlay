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
    setLoading(true)

    try {
      if (mode === 'signup') {
        // Sign up and attach username to user_metadata
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username, 
            },
          },
        })
        if (signUpError) throw signUpError
        onClose() 
      } else if (mode === 'login') {
        // Standard login
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) throw signInError
        onClose() 
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '400px' }}>
        <button className="close-btn" onClick={onClose}>×</button>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>
          {mode === 'signup' ? 'Create an Account' : 'Welcome Back'}
        </h2>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Conditionally render Username input only during Sign Up */}
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{ 
                padding: '0.8rem', 
                borderRadius: '6px', 
                border: '1px solid #333', 
                background: '#1a1a1a', 
                color: '#fff' 
              }}
            />
          )}
          
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ 
              padding: '0.8rem', 
              borderRadius: '6px', 
              border: '1px solid #333', 
              background: '#1a1a1a', 
              color: '#fff' 
            }}
          />
          
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ 
              padding: '0.8rem', 
              borderRadius: '6px', 
              border: '1px solid #333', 
              background: '#1a1a1a', 
              color: '#fff' 
            }}
          />
          
          {error && <div style={{ color: '#fc4646', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}
          
          <button type="submit" disabled={loading} style={{ marginTop: '0.5rem', padding: '0.8rem' }}>
            {loading ? 'Processing...' : (mode === 'signup' ? 'Sign Up' : 'Log In')}
          </button>
        </form>
      </div>
    </div>
  )
}