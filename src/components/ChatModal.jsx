import React, {
  useEffect,
  useState,
  useRef
} from 'react'

import {
  getMessages,
  sendMessage,
  markMessagesRead
} from '../api'

import useEscapeKey from '../hooks/useEscapeKey'


const AVATAR_MAP = {
  purple:
    'linear-gradient(135deg, #646cff, #a78bfa)',

  red:
    'linear-gradient(135deg, #fc4646, #ff8c00)',

  green:
    'linear-gradient(135deg, #11998e, #38ef7d)',

  blue:
    'linear-gradient(135deg, #2193b0, #6dd5ed)',

  pink:
    'linear-gradient(135deg, #f953c6, #b91d73)',

  gold:
    'linear-gradient(135deg, #f7971e, #ffd200)'
}


const formatTime = ts =>
  new Date(ts).toLocaleTimeString(
    'en-US',
    {
      hour:
        '2-digit',

      minute:
        '2-digit'
    }
  )


const formatDate = ts =>
  new Date(ts).toLocaleDateString(
    'en-US',
    {
      month:
        'short',

      day:
        'numeric'
    }
  )


function groupMessages(messages) {
  const grouped = []

  let lastDate = null

  for (const msg of messages) {
    const msgDate =
      formatDate(
        msg.created_at
      )

    if (
      msgDate !==
      lastDate
    ) {
      grouped.push({
        type:
          'divider',

        date:
          msgDate,

        id:
          `divider-${msg.id}`
      })

      lastDate =
        msgDate
    }

    grouped.push({
      type:
        'message',

      msg
    })
  }

  return grouped
}


export default function ChatModal({
  session,
  friend,
  onClose
}) {
  useEscapeKey(onClose)
  
  const [
    messages,
    setMessages
  ] = useState([])

  const [
    text,
    setText
  ] = useState('')

  const [
    sending,
    setSending
  ] = useState(false)

  const [
    loading,
    setLoading
  ] = useState(true)

  const bottomRef =
    useRef()

  const mountedRef =
    useRef(true)

  const myId =
    session.user.id

  const friendLetter =
    (
      friend.username ||
      '?'
    )
      .charAt(0)
      .toUpperCase()

  const friendGradient =
    AVATAR_MAP[
      friend.avatar_color ||
        'purple'
    ]


  // ------------------------------------------------
  // LOCK BACKGROUND SCROLL WHILE CHAT IS OPEN
  // ------------------------------------------------

  useEffect(() => {
    const previousBodyOverflow =
      document.body.style.overflow

    const previousHtmlOverflow =
      document.documentElement
        .style
        .overflow

    document.body.style.overflow =
      'hidden'

    document.documentElement
      .style
      .overflow =
      'hidden'

    return () => {
      document.body.style.overflow =
        previousBodyOverflow

      document.documentElement
        .style
        .overflow =
        previousHtmlOverflow
    }
  }, [])


  // ------------------------------------------------
  // LOAD + POLL MESSAGES FROM AWS
  // ------------------------------------------------

  useEffect(() => {
    mountedRef.current =
      true

    async function loadMessages(
      showLoading = false
    ) {
      if (showLoading) {
        setLoading(true)
      }

      try {
        const data =
          await getMessages(
            friend.id
          )

        if (
          mountedRef.current
        ) {
          setMessages(
            data || []
          )
        }

        // Mark messages from this friend as read
        await markMessagesRead(
          friend.id
        )
      } catch (error) {
        console.error(
          'Error loading AWS messages:',
          error
        )
      } finally {
        if (
          showLoading &&
          mountedRef.current
        ) {
          setLoading(false)
        }
      }
    }

    // Initial load
    loadMessages(true)

    // Poll AWS every 2 seconds
    const poll =
      setInterval(
        () => {
          loadMessages(false)
        },
        2000
      )

    return () => {
      mountedRef.current =
        false

      clearInterval(
        poll
      )
    }
  }, [friend.id])


  // ------------------------------------------------
  // SCROLL TO BOTTOM
  // ------------------------------------------------

  useEffect(() => {
    bottomRef.current
      ?.scrollIntoView({
        behavior:
          'smooth'
      })
  }, [messages])


  // ------------------------------------------------
  // SEND MESSAGE TO AWS
  // ------------------------------------------------

  const handleSend =
    async () => {
      if (
        !text.trim() ||
        sending
      ) {
        return
      }

      const content =
        text.trim()

      setSending(true)

      setText('')

      // Show message immediately
      const tempId =
        `temp-${Date.now()}`

      const optimistic = {
        id:
          tempId,

        sender_id:
          myId,

        receiver_id:
          friend.id,

        content,

        created_at:
          new Date()
            .toISOString(),

        read:
          false
      }

      setMessages(
        prev => [
          ...prev,
          optimistic
        ]
      )

      try {
        const savedMessage =
          await sendMessage(
            friend.id,
            content
          )

        if (
          mountedRef.current
        ) {
          setMessages(
            prev =>
              prev.map(
                message =>
                  message.id ===
                  tempId
                    ? savedMessage
                    : message
              )
          )
        }
      } catch (error) {
        console.error(
          'Error sending AWS message:',
          error
        )

        if (
          mountedRef.current
        ) {
          // Remove failed optimistic message
          setMessages(
            prev =>
              prev.filter(
                message =>
                  message.id !==
                  tempId
              )
          )

          // Put the text back
          setText(
            content
          )
        }

        alert(
          'Could not send message: ' +
          error.message
        )
      } finally {
        if (
          mountedRef.current
        ) {
          setSending(false)
        }
      }
    }


  const grouped =
    groupMessages(
      messages
    )


  return (
    <div className="modal-overlay">
      <div
        className="modal chat-modal"
        onClick={
          e =>
            e.stopPropagation()
        }
      >
        <div className="chat-header">
          <div className="chat-header-left">
            {friend.avatar_url ? (
              <img
                src={
                  friend.avatar_url
                }
                alt="avatar"
                className="chat-friend-avatar"
              />
            ) : (
              <div
                className="chat-friend-avatar"
                style={{
                  background:
                    friendGradient
                }}
              >
                {friendLetter}
              </div>
            )}

            <span className="chat-friend-name">
              {
                friend.username ||
                'Unknown'
              }
            </span>
          </div>

          <button
            className="close-btn"
            onClick={
              onClose
            }
          >
            ✕
          </button>
        </div>


        <div className="chat-messages">
          {loading && (
            <div className="global-loading">
              <div className="dot" />
              <div className="dot" />
              <div className="dot" />
            </div>
          )}

          {!loading &&
            grouped.length ===
              0 && (
              <div className="chat-empty">
                <span
                  style={{
                    fontSize:
                      '2rem'
                  }}
                >
                  💬
                </span>

                <p>
                  Start the conversation!
                </p>
              </div>
            )}

          {!loading &&
            grouped.map(
              item => {
                if (
                  item.type ===
                  'divider'
                ) {
                  return (
                    <div
                      key={
                        item.id
                      }
                      className="chat-date-divider"
                    >
                      {
                        item.date
                      }
                    </div>
                  )
                }

                const {
                  msg
                } = item

                const mine =
                  msg.sender_id ===
                  myId

                return (
                  <div
                    key={
                      msg.id
                    }
                    className={
                      `chat-bubble-row ${
                        mine
                          ? 'mine'
                          : 'theirs'
                      }`
                    }
                  >
                    <div
                      className={
                        `chat-bubble ${
                          mine
                            ? 'bubble-mine'
                            : 'bubble-theirs'
                        }`
                      }
                    >
                      <span className="chat-bubble-text">
                        {
                          msg.content
                        }
                      </span>

                      <span className="chat-bubble-time">
                        {
                          formatTime(
                            msg.created_at
                          )
                        }
                      </span>
                    </div>
                  </div>
                )
              }
            )}

          <div
            ref={
              bottomRef
            }
          />
        </div>


        <div className="chat-input-row">
          <input
            className="chat-input"
            placeholder="Type a message…"
            value={
              text
            }
            onChange={
              e =>
                setText(
                  e.target.value
                )
            }
            onKeyDown={
              e => {
                if (
                  e.key ===
                    'Enter' &&
                  !e.shiftKey
                ) {
                  handleSend()
                }
              }
            }
          />

          <button
            className="chat-send-btn"
            onClick={
              handleSend
            }
            disabled={
              sending ||
              !text.trim()
            }
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}