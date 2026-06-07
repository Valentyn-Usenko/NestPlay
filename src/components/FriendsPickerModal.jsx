import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import ChatModal from './ChatModal'

const AVATAR_MAP = {
  purple: 'linear-gradient(135deg, #646cff, #a78bfa)',
  red:    'linear-gradient(135deg, #fc4646, #ff8c00)',
  green:  'linear-gradient(135deg, #11998e, #38ef7d)',
  blue:   'linear-gradient(135deg, #2193b0, #6dd5ed)',
  pink:   'linear-gradient(135deg, #f953c6, #b91d73)',
  gold:   'linear-gradient(135deg, #f7971e, #ffd200)',
}

export default function FriendsPickerModal({ session, onClose }) {
  const [friends, setFriends] = useState([])
  const [unreadMap, setUnreadMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [chatFriend, setChatFriend] = useState(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    async function loadAll() {
      const myId = session.user.id

      const { data: friendRows } = await supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)

      const friendIds = (friendRows || []).map(r =>
        r.sender_id === myId ? r.receiver_id : r.sender_id
      )

      let friendProfiles = []
      if (friendIds.length > 0) {
        const { data: fp } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, avatar_color')
          .in('id', friendIds)
        friendProfiles = (fp || []).map(p => {
          const row = friendRows.find(r => r.sender_id === p.id || r.receiver_id === p.id)
          return { ...p, requestId: row?.id }
        })
      }

      const { data: unreadRows } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', myId)
        .or('read.eq.false,read.is.null')

      const counts = {}
      for (const row of (unreadRows || [])) {
        counts[row.sender_id] = (counts[row.sender_id] || 0) + 1
      }

      if (mountedRef.current) {
        setFriends(friendProfiles)
        setUnreadMap(counts)
        setLoading(false)
      }
    }

    loadAll()

    return () => { mountedRef.current = false }
  }, [session])

  const handleOpenChat = (friend) => {
    setUnreadMap(prev => ({ ...prev, [friend.id]: 0 }))
    setChatFriend(friend)
  }

  if (chatFriend) {
    return <ChatModal session={session} friend={chatFriend} onClose={() => setChatFriend(null)} />
  }

  return (
    <div className="modal-overlay">
      <div className="modal inbox-modal" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2 className="settings-title">Messages</h2>

        {loading && <div className="global-loading"><div className="dot" /><div className="dot" /><div className="dot" /></div>}

        {!loading && friends.length === 0 && (
          <div className="profile-empty" style={{ padding: '2rem 0' }}>
            <span style={{ fontSize: '2rem' }}>👥</span>
            <p>Add some friends to start messaging!</p>
          </div>
        )}

        {!loading && friends.map(f => {
          const letter = (f.username || '?').charAt(0).toUpperCase()
          const gradient = AVATAR_MAP[f.avatar_color || 'purple']
          const unread = unreadMap[f.id] || 0
          return (
            <div key={f.id} className="inbox-request-card" style={{ cursor: 'pointer' }} onClick={() => handleOpenChat(f)}>
              <div className="inbox-request-left">
                {f.avatar_url
                  ? <img src={f.avatar_url} alt="avatar" className="inbox-avatar" />
                  : <div className="inbox-avatar" style={{ background: gradient }}>{letter}</div>
                }
                <span className="inbox-sender-name">{f.username || 'Unknown'}</span>
                {unread > 0 && <span className="msg-unread-badge">{unread}</span>}
              </div>
              <span style={{ color: '#555', fontSize: '0.85rem' }}>💬</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}