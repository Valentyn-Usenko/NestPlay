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

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function InboxModal({ session, onClose }) {
  const [tab, setTab] = useState('requests')
  const [requests, setRequests] = useState([])
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const userId = session.user.id

    async function loadAll() {
      const [reqResult, notifResult] = await Promise.all([
        supabase
          .from('friend_requests')
          .select('id, status, created_at, sender_id')
          .eq('receiver_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('notifications')
          .select('id, type, read, created_at, actor_id, post_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50)
      ])

      if (!mountedRef.current) return

      const reqData = reqResult.data || []
      const notifData = notifResult.data || []

      if (reqData.length > 0) {
        const senderIds = reqData.map(r => r.sender_id)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, avatar_color')
          .in('id', senderIds)
        const profileMap = {}
        for (const p of (profiles || [])) profileMap[p.id] = p
        if (mountedRef.current) setRequests(reqData.map(r => ({ ...r, senderProfile: profileMap[r.sender_id] || null })))
      }

      if (notifData.length > 0) {
        const actorIds = [...new Set(notifData.map(n => n.actor_id))]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, avatar_color')
          .in('id', actorIds)
        const profileMap = {}
        for (const p of (profiles || [])) profileMap[p.id] = p
        if (mountedRef.current) setNotifications(notifData.map(n => ({ ...n, actorProfile: profileMap[n.actor_id] || null })))

        const unreadIds = notifData.filter(n => !n.read).map(n => n.id)
        if (unreadIds.length > 0) {
          await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
        }
      }

      if (mountedRef.current) setLoading(false)
    }

    loadAll()

    return () => { mountedRef.current = false }
  }, [session.user.id])

  const handleAccept = async (requestId) => {
    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', requestId)
    if (mountedRef.current) setRequests(prev => prev.filter(r => r.id !== requestId))
  }

  const handleDecline = async (requestId) => {
    await supabase.from('friend_requests').delete().eq('id', requestId)
    if (mountedRef.current) setRequests(prev => prev.filter(r => r.id !== requestId))
  }

  const unreadNotifCount = notifications.filter(n => !n.read).length

  function renderAvatar(profile) {
    const name = profile?.username || '?'
    const letter = name.charAt(0).toUpperCase()
    const gradient = AVATAR_COLORS[profile?.avatar_color || 'purple']
    if (profile?.avatar_url) return <img src={profile.avatar_url} alt="avatar" className="inbox-avatar" />
    return <div className="inbox-avatar" style={{ background: gradient }}>{letter}</div>
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal inbox-modal" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2 className="settings-title">Inbox</h2>

        <div className="inbox-tabs">
          <button
            className={`inbox-tab${tab === 'requests' ? ' active' : ''}`}
            onClick={() => setTab('requests')}
          >
            Friend Requests
            {requests.length > 0 && <span className="inbox-tab-badge">{requests.length}</span>}
          </button>
          <button
            className={`inbox-tab${tab === 'notifications' ? ' active' : ''}`}
            onClick={() => setTab('notifications')}
          >
            Notifications
            {unreadNotifCount > 0 && <span className="inbox-tab-badge">{unreadNotifCount}</span>}
          </button>
        </div>

        {loading && <div className="global-loading"><div className="dot" /><div className="dot" /><div className="dot" /></div>}

        {!loading && tab === 'requests' && (
          <>
            {requests.length === 0 && (
              <div className="profile-empty" style={{ padding: '2rem 0' }}>
                <span style={{ fontSize: '2rem' }}>📭</span>
                <p>No pending friend requests.</p>
              </div>
            )}
            {requests.map(req => {
              const p = req.senderProfile
              return (
                <div key={req.id} className="inbox-request-card">
                  <div className="inbox-request-left">
                    {renderAvatar(p)}
                    <span className="inbox-sender-name">{p?.username || 'Unknown'}</span>
                  </div>
                  <div className="inbox-request-actions">
                    <button className="btn-primary inbox-btn" onClick={() => handleAccept(req.id)}>Accept</button>
                    <button className="btn-ghost inbox-btn" onClick={() => handleDecline(req.id)}>Decline</button>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {!loading && tab === 'notifications' && (
          <>
            {notifications.length === 0 && (
              <div className="profile-empty" style={{ padding: '2rem 0' }}>
                <span style={{ fontSize: '2rem' }}>🔔</span>
                <p>No notifications yet.</p>
              </div>
            )}
            {notifications.map(n => {
              const p = n.actorProfile
              return (
                <div key={n.id} className={`inbox-notif-card${n.read ? '' : ' unread'}`}>
                  {renderAvatar(p)}
                  <div className="inbox-notif-text">
                    <span className="inbox-sender-name">{p?.username || 'Someone'}</span>
                    {n.type === 'like' && <span className="inbox-notif-action"> liked your post ❤️</span>}
                  </div>
                  <span className="inbox-notif-time">{timeAgo(n.created_at)}</span>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}