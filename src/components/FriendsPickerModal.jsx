import React, { useEffect, useState, useRef } from 'react'
import {
  getFriends,
  getProfiles,
  getUnreadMessagesBySender
} from '../api'
import ChatModal from './ChatModal'

import useEscapeKey from '../hooks/useEscapeKey'

const AVATAR_MAP = {
  purple: 'linear-gradient(135deg, #646cff, #a78bfa)',
  red: 'linear-gradient(135deg, #fc4646, #ff8c00)',
  green: 'linear-gradient(135deg, #11998e, #38ef7d)',
  blue: 'linear-gradient(135deg, #2193b0, #6dd5ed)',
  pink: 'linear-gradient(135deg, #f953c6, #b91d73)',
  gold: 'linear-gradient(135deg, #f7971e, #ffd200)'
}

export default function FriendsPickerModal({
  session,
  onClose
}) {
  useEscapeKey(onClose)
  const [friends, setFriends] = useState([])
  const [unreadMap, setUnreadMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [chatFriend, setChatFriend] = useState(null)

  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    async function loadFriends() {
      setLoading(true)

      try {
        // --------------------------------------------
        // FRIENDSHIPS — AWS
        // --------------------------------------------

        const friendRows =
          await getFriends()

        const friendIds =
          friendRows.map(
            row => row.friend_id
          )

        // --------------------------------------------
        // FRIEND PROFILES — AWS
        // --------------------------------------------

        let friendProfiles = []

        if (friendIds.length > 0) {
          friendProfiles =
            await getProfiles(
              friendIds
            )
        }

        // --------------------------------------------
        // UNREAD MESSAGES — AWS
        // --------------------------------------------

        const unreadCounts =
          await getUnreadMessagesBySender()

        if (!mountedRef.current) {
          return
        }

        setFriends(
          friendProfiles
        )

        setUnreadMap(
          unreadCounts || {}
        )
      } catch (error) {
        console.error(
          'Error loading message list:',
          error
        )
      } finally {
        if (mountedRef.current) {
          setLoading(false)
        }
      }
    }

    async function refreshUnreadCounts() {
      try {
        const unreadCounts =
          await getUnreadMessagesBySender()

        if (mountedRef.current) {
          setUnreadMap(
            unreadCounts || {}
          )
        }
      } catch (error) {
        console.error(
          'Error refreshing unread messages:',
          error
        )
      }
    }

    loadFriends()

    const unreadPoll =
      setInterval(() => {
        refreshUnreadCounts()
      }, 2000)

    return () => {
      mountedRef.current = false

      clearInterval(
        unreadPoll
      )
    }
  }, [session.user.id])

  const handleOpenChat = friend => {
    setUnreadMap(prev => ({
      ...prev,
      [friend.id]: 0
    }))

    setChatFriend(friend)
  }

  if (chatFriend) {
    return (
      <ChatModal
        session={session}
        friend={chatFriend}
        onClose={() =>
          setChatFriend(null)
        }
      />
    )
  }

  return (
    <div className="modal-overlay">
      <div
        className="modal inbox-modal"
        onClick={e =>
          e.stopPropagation()
        }
      >
        <button
          className="close-btn"
          onClick={onClose}
        >
          ✕
        </button>

        <h2 className="settings-title">
          Messages
        </h2>

        {loading && (
          <div className="global-loading">
            <div className="dot" />
            <div className="dot" />
            <div className="dot" />
          </div>
        )}

        {!loading &&
          friends.length === 0 && (
            <div
              className="profile-empty"
              style={{
                padding: '2rem 0'
              }}
            >
              <span
                style={{
                  fontSize: '2rem'
                }}
              >
                👥
              </span>

              <p>
                Add some friends to start messaging!
              </p>
            </div>
          )}

        {!loading &&
          friends.map(friend => {
            const letter =
              (
                friend.username ||
                '?'
              )
                .charAt(0)
                .toUpperCase()

            const gradient =
              AVATAR_MAP[
                friend.avatar_color ||
                  'purple'
              ]

            const unread =
              unreadMap[
                friend.id
              ] || 0

            return (
              <div
                key={friend.id}
                className="inbox-request-card"
                style={{
                  cursor: 'pointer'
                }}
                onClick={() =>
                  handleOpenChat(
                    friend
                  )
                }
              >
                <div className="inbox-request-left">
                  {friend.avatar_url ? (
                    <img
                      src={
                        friend.avatar_url
                      }
                      alt="avatar"
                      className="inbox-avatar"
                    />
                  ) : (
                    <div
                      className="inbox-avatar"
                      style={{
                        background:
                          gradient
                      }}
                    >
                      {letter}
                    </div>
                  )}

                  <span className="inbox-sender-name">
                    {friend.username ||
                      'Unknown'}
                  </span>

                  {unread > 0 && (
                    <span className="msg-unread-badge">
                      {unread}
                    </span>
                  )}
                </div>

                <span
                  style={{
                    color: '#555',
                    fontSize: '0.85rem'
                  }}
                >
                  💬
                </span>
              </div>
            )
          })}
      </div>
    </div>
  )
}