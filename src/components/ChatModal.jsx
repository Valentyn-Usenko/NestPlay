import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../supabaseClient'

const AVATAR_MAP = {
  purple: 'linear-gradient(135deg, #646cff, #a78bfa)',
  red:    'linear-gradient(135deg, #fc4646, #ff8c00)',
  green:  'linear-gradient(135deg, #11998e, #38ef7d)',
  blue:   'linear-gradient(135deg, #2193b0, #6dd5ed)',
  pink:   'linear-gradient(135deg, #f953c6, #b91d73)',
  gold:   'linear-gradient(135deg, #f7971e, #ffd200)',
}

const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
const formatDate = (ts) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function groupMessages(messages) {
  const grouped = []
  let lastDate = null
  for (const msg of messages) {
    const msgDate = formatDate(msg.created_at)
    if (msgDate !== lastDate) {
      grouped.push({ type: 'divider', date: msgDate, id: `divider-${msg.id}` })
      lastDate = msgDate
    }
    grouped.push({ type: 'message', msg })
  }
  return grouped
}

export default function ChatModal({ session, friend, onClose }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef()
  const mountedRef = useRef(true)

  const myId = session.user.id
  const friendLetter = (friend.username || '?').charAt(0).toUpperCase()
  const friendGradient = AVATAR_MAP[friend.avatar_color || 'purple']

  useEffect(() => {
    mountedRef.current = true

    async function loadMessages() {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${myId},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${myId})`)
        .order('created_at', { ascending: true })

      if (mountedRef.current) setMessages(data || [])

      await supabase
        .from('messages')
        .update({ read: true })
        .eq('receiver_id', myId)
        .eq('sender_id', friend.id)
        .eq('read', false)
    }

    loadMessages()

    const channel = supabase
      .channel(`chat-${myId}-${friend.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const msg = payload.new
        const fromFriend = msg.sender_id === friend.id && msg.receiver_id === myId
        if (fromFriend && mountedRef.current) {
          setMessages(prev => [...prev, msg])
        }
      })
      .subscribe()

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
    }
  }, [myId, friend.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    const content = text.trim()
    setText('')

    const optimistic = {
      id: `temp-${Date.now()}`,
      sender_id: myId,
      receiver_id: friend.id,
      content,
      created_at: new Date().toISOString(),
      read: false,
    }
    setMessages(prev => [...prev, optimistic])

    await supabase.from('messages').insert({
      sender_id: myId,
      receiver_id: friend.id,
      content,
    })

    setSending(false)
  }

  const grouped = groupMessages(messages)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal chat-modal" onClick={e => e.stopPropagation()}>

        <div className="chat-header">
          <div className="chat-header-left">
            {friend.avatar_url
              ? <img src={friend.avatar_url} alt="avatar" className="chat-friend-avatar" />
              : <div className="chat-friend-avatar" style={{ background: friendGradient }}>{friendLetter}</div>
            }
            <span className="chat-friend-name">{friend.username || 'Unknown'}</span>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="chat-messages">
          {grouped.length === 0 && (
            <div className="chat-empty">
              <span style={{ fontSize: '2rem' }}>💬</span>
              <p>Start the conversation!</p>
            </div>
          )}
          {grouped.map(item => {
            if (item.type === 'divider') {
              return <div key={item.id} className="chat-date-divider">{item.date}</div>
            }
            const { msg } = item
            const mine = msg.sender_id === myId
            return (
              <div key={msg.id} className={`chat-bubble-row ${mine ? 'mine' : 'theirs'}`}>
                <div className={`chat-bubble ${mine ? 'bubble-mine' : 'bubble-theirs'}`}>
                  <span className="chat-bubble-text">{msg.content}</span>
                  <span className="chat-bubble-time">{formatTime(msg.created_at)}</span>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div className="chat-input-row">
          <input
            className="chat-input"
            placeholder="Type a message…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          />
          <button className="chat-send-btn" onClick={handleSend} disabled={sending || !text.trim()}>
            ➤
          </button>
        </div>

      </div>
    </div>
  )
}