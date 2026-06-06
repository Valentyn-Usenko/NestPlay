import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'

const AVATAR_COLORS = {
  purple: 'linear-gradient(135deg, #646cff, #a78bfa)',
  red:    'linear-gradient(135deg, #fc4646, #ff8c00)',
  green:  'linear-gradient(135deg, #11998e, #38ef7d)',
  blue:   'linear-gradient(135deg, #2193b0, #6dd5ed)',
  pink:   'linear-gradient(135deg, #f953c6, #b91d73)',
  gold:   'linear-gradient(135deg, #f7971e, #ffd200)',
}

export default function InboxModal({ session, onClose }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    async function loadRequests() {
      const { data } = await supabase
        .from('friend_requests')
        .select('id, status, created_at, sender_id')
        .eq('receiver_id', session.user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (!data || data.length === 0) {
        if (mountedRef.current) {
          setRequests([])
          setLoading(false)
        }
        return
      }

      const senderIds = data.map(r => r.sender_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, avatar_color')
        .in('id', senderIds)

      const profileMap = {}
      for (const p of (profiles || [])) profileMap[p.id] = p

      const merged = data.map(r => ({ ...r, senderProfile: profileMap[r.sender_id] || null }))

      if (mountedRef.current) {
        setRequests(merged)
        setLoading(false)
      }
    }

    loadRequests()

    return () => { mountedRef.current = false }
  }, [session])

  const handleAccept = async (requestId) => {
    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', requestId)
    if (mountedRef.current) setRequests(prev => prev.filter(r => r.id !== requestId))
  }

  const handleDecline = async (requestId) => {
    await supabase.from('friend_requests').delete().eq('id', requestId)
    if (mountedRef.current) setRequests(prev => prev.filter(r => r.id !== requestId))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal inbox-modal" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2 className="settings-title">Inbox</h2>

        {loading && <div className="global-loading"><div className="dot" /><div className="dot" /><div className="dot" /></div>}

        {!loading && requests.length === 0 && (
          <div className="profile-empty" style={{ padding: '2rem 0' }}>
            <span style={{ fontSize: '2rem' }}>📭</span>
            <p>No pending friend requests.</p>
          </div>
        )}

        {!loading && requests.map(req => {
          const p = req.senderProfile
          const name = p?.username || 'Unknown'
          const letter = name.charAt(0).toUpperCase()
          const gradient = AVATAR_COLORS[p?.avatar_color || 'purple']

          return (
            <div key={req.id} className="inbox-request-card">
              <div className="inbox-request-left">
                {p?.avatar_url
                  ? <img src={p.avatar_url} alt="avatar" className="inbox-avatar" />
                  : <div className="inbox-avatar" style={{ background: gradient }}>{letter}</div>
                }
                <span className="inbox-sender-name">{name}</span>
              </div>
              <div className="inbox-request-actions">
                <button className="btn-primary inbox-btn" onClick={() => handleAccept(req.id)}>Accept</button>
                <button className="btn-ghost inbox-btn" onClick={() => handleDecline(req.id)}>Decline</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}