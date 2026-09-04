import React, { useEffect, useState, useRef } from 'react'
import {
  getNotifications,
  markNotificationsRead,
  getPendingFriendRequests,
  acceptFriendRequest,
  deleteFriendRequest,
  getProfiles
} from '../api'

import useEscapeKey from '../hooks/useEscapeKey'

const AVATAR_COLORS = {
  purple: 'linear-gradient(135deg, #646cff, #a78bfa)',
  red: 'linear-gradient(135deg, #fc4646, #ff8c00)',
  green: 'linear-gradient(135deg, #11998e, #38ef7d)',
  blue: 'linear-gradient(135deg, #2193b0, #6dd5ed)',
  pink: 'linear-gradient(135deg, #f953c6, #b91d73)',
  gold: 'linear-gradient(135deg, #f7971e, #ffd200)'
}

function timeAgo(dateStr) {
  const diff =
    Date.now() -
    new Date(dateStr).getTime()

  const mins =
    Math.floor(diff / 60000)

  if (mins < 1) {
    return 'just now'
  }

  if (mins < 60) {
    return `${mins}m ago`
  }

  const hrs =
    Math.floor(mins / 60)

  if (hrs < 24) {
    return `${hrs}h ago`
  }

  return `${Math.floor(hrs / 24)}d ago`
}

export default function InboxModal({
  session,
  onClose,
  onOpenPost,
  onNotificationsRead
}) {
  useEscapeKey(onClose)
  
  const [tab, setTab] =
    useState('requests')

  const [requests, setRequests] =
    useState([])

  const [notifications, setNotifications] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const mountedRef =
    useRef(true)

  useEffect(() => {
    mountedRef.current = true

    async function loadAll() {
      setLoading(true)

      try {
        // --------------------------------------------
        // FRIEND REQUESTS — AWS
        // --------------------------------------------

        let reqData = []

        try {
          reqData =
            await getPendingFriendRequests()
        } catch (error) {
          console.error(
            'Error loading AWS friend requests:',
            error
          )
        }

        // --------------------------------------------
        // NOTIFICATIONS — AWS
        // --------------------------------------------

        let notifData = []

        try {
          notifData =
            await getNotifications()
        } catch (error) {
          console.error(
            'Error loading AWS notifications:',
            error
          )
        }

        // --------------------------------------------
        // COLLECT ALL PROFILE IDS
        // --------------------------------------------

        const profileIds = [
          ...new Set([
            ...reqData.map(
              request =>
                request.sender_id
            ),

            ...notifData.map(
              notification =>
                notification.actor_id
            )
          ].filter(Boolean))
        ]

        // --------------------------------------------
        // PROFILE INFO — AWS
        // --------------------------------------------

        let profiles = []

        if (
          profileIds.length > 0
        ) {
          try {
            profiles =
              await getProfiles(
                profileIds
              )
          } catch (error) {
            console.error(
              'Error loading AWS inbox profiles:',
              error
            )
          }
        }

        const profileMap = {}

        for (
          const profile of profiles
        ) {
          profileMap[
            profile.id
          ] = profile
        }

        // --------------------------------------------
        // ENRICH FRIEND REQUESTS
        // --------------------------------------------

        const enrichedRequests =
          reqData.map(
            request => ({
              ...request,

              senderProfile:
                profileMap[
                  request.sender_id
                ] || null
            })
          )

        // --------------------------------------------
        // ENRICH NOTIFICATIONS
        // --------------------------------------------

        const enrichedNotifications =
          notifData.map(
            notification => ({
              ...notification,

              actorProfile:
                profileMap[
                  notification.actor_id
                ] || null
            })
          )

        if (
          !mountedRef.current
        ) {
          return
        }

        setRequests(
          enrichedRequests
        )

        setNotifications(
          enrichedNotifications
        )
      } catch (error) {
        console.error(
          'Error loading inbox:',
          error
        )
      } finally {
        if (
          mountedRef.current
        ) {
          setLoading(false)
        }
      }
    }

    loadAll()

    return () => {
      mountedRef.current =
        false
    }
  }, [session.user.id])

  // --------------------------------------------
  // OPEN NOTIFICATIONS TAB
  // --------------------------------------------

  const handleOpenNotifications =
    async () => {
      setTab(
        'notifications'
      )

      const hasUnread =
        notifications.some(
          notification =>
            !notification.read
        )

      if (!hasUnread) {
        return
      }

      try {
        await markNotificationsRead()

        if (
          mountedRef.current
        ) {
          setNotifications(
            prev =>
              prev.map(
                notification => ({
                  ...notification,
                  read: true
                })
              )
          )
        }

        if (
          onNotificationsRead
        ) {
          onNotificationsRead()
        }
      } catch (error) {
        console.error(
          'Error marking notifications read:',
          error
        )
      }
    }

  // --------------------------------------------
  // CLICK NOTIFICATION
  // --------------------------------------------

  const handleNotificationClick =
    notification => {
      if (
        !notification.post_id
      ) {
        return
      }

      if (onOpenPost) {
        onOpenPost(
          notification.post_id
        )
      }
    }

  // --------------------------------------------
  // ACCEPT FRIEND REQUEST — AWS
  // --------------------------------------------

  const handleAccept =
    async requestId => {
      try {
        await acceptFriendRequest(
          requestId
        )

        if (
          mountedRef.current
        ) {
          setRequests(
            prev =>
              prev.filter(
                request =>
                  request.id !==
                  requestId
              )
          )
        }
      } catch (error) {
        console.error(
          'Error accepting friend request:',
          error
        )

        alert(
          'Could not accept friend request: ' +
          error.message
        )
      }
    }

  // --------------------------------------------
  // DECLINE FRIEND REQUEST — AWS
  // --------------------------------------------

  const handleDecline =
    async requestId => {
      try {
        await deleteFriendRequest(
          requestId
        )

        if (
          mountedRef.current
        ) {
          setRequests(
            prev =>
              prev.filter(
                request =>
                  request.id !==
                  requestId
              )
          )
        }
      } catch (error) {
        console.error(
          'Error declining friend request:',
          error
        )

        alert(
          'Could not decline friend request: ' +
          error.message
        )
      }
    }

  const unreadNotifCount =
    notifications.filter(
      notification =>
        !notification.read
    ).length

  function renderAvatar(
    profile
  ) {
    const name =
      profile?.username ||
      '?'

    const letter =
      name
        .charAt(0)
        .toUpperCase()

    const gradient =
      AVATAR_COLORS[
        profile?.avatar_color ||
          'purple'
      ]

    if (
      profile?.avatar_url
    ) {
      return (
        <img
          src={
            profile.avatar_url
          }
          alt="avatar"
          className="inbox-avatar"
        />
      )
    }

    return (
      <div
        className="inbox-avatar"
        style={{
          background:
            gradient
        }}
      >
        {letter}
      </div>
    )
  }

  return (
    <div
      className="modal-overlay"
  
    >
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
          Inbox
        </h2>

        <div className="inbox-tabs">
          <button
            className={
              `inbox-tab${
                tab ===
                'requests'
                  ? ' active'
                  : ''
              }`
            }
            onClick={() =>
              setTab(
                'requests'
              )
            }
          >
            Friend Requests

            {requests.length >
              0 && (
              <span
                className="inbox-tab-badge"
                style={{
                  marginLeft:
                    '8px'
                }}
              >
                {requests.length}
              </span>
            )}
          </button>

          <button
            className={
              `inbox-tab${
                tab ===
                'notifications'
                  ? ' active'
                  : ''
              }`
            }
            onClick={
              handleOpenNotifications
            }
          >
            Notifications

            {unreadNotifCount >
              0 && (
              <span
                className="inbox-tab-badge"
                style={{
                  marginLeft:
                    '8px'
                }}
              >
                {unreadNotifCount}
              </span>
            )}
          </button>
        </div>

        {loading && (
          <div className="global-loading">
            <div className="dot" />
            <div className="dot" />
            <div className="dot" />
          </div>
        )}

        {!loading &&
          tab ===
            'requests' && (
            <>
              {requests.length ===
                0 && (
                <div
                  className="profile-empty"
                  style={{
                    padding:
                      '2rem 0'
                  }}
                >
                  <span
                    style={{
                      fontSize:
                        '2rem'
                    }}
                  >
                    📭
                  </span>

                  <p>
                    No pending friend requests.
                  </p>
                </div>
              )}

              {requests.map(
                request => {
                  const profile =
                    request.senderProfile

                  return (
                    <div
                      key={
                        request.id
                      }
                      className="inbox-request-card"
                    >
                      <div className="inbox-request-left">
                        {renderAvatar(
                          profile
                        )}

                        <span className="inbox-sender-name">
                          {profile?.username ||
                            'Unknown'}
                        </span>
                      </div>

                      <div className="inbox-request-actions">
                        <button
                          className="btn-primary inbox-btn"
                          onClick={() =>
                            handleAccept(
                              request.id
                            )
                          }
                        >
                          Accept
                        </button>

                        <button
                          className="btn-ghost inbox-btn"
                          onClick={() =>
                            handleDecline(
                              request.id
                            )
                          }
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  )
                }
              )}
            </>
          )}

        {!loading &&
          tab ===
            'notifications' && (
            <>
              {notifications.length ===
                0 && (
                <div
                  className="profile-empty"
                  style={{
                    padding:
                      '2rem 0'
                  }}
                >
                  <span
                    style={{
                      fontSize:
                        '2rem'
                    }}
                  >
                    🔔
                  </span>

                  <p>
                    No notifications yet.
                  </p>
                </div>
              )}

              {notifications.map(
                notification => {
                  const profile =
                    notification.actorProfile

                  return (
                    <div
                      key={
                        notification.id
                      }
                      className={
                        `inbox-notif-card${
                          notification.read
                            ? ''
                            : ' unread'
                        }`
                      }
                      onClick={() =>
                        handleNotificationClick(
                          notification
                        )
                      }
                      style={{
                        cursor:
                          notification.post_id
                            ? 'pointer'
                            : 'default'
                      }}
                    >
                      {renderAvatar(
                        profile
                      )}

                      <div className="inbox-notif-text">
                        <div>
                          <span className="inbox-sender-name">
                            {profile?.username ||
                              'Someone'}
                          </span>

                          {notification.type ===
                            'like' && (
                            <span className="inbox-notif-action">
                              {' '}liked your post ❤️
                            </span>
                          )}
                        </div>

                        {notification.post_id && (
                          <div
                            style={{
                              marginTop:
                                '4px',
                              fontSize:
                                '0.75rem',
                              color:
                                '#646cff',
                              fontWeight:
                                '600'
                            }}
                          >
                            View post →
                          </div>
                        )}
                      </div>

                      <span className="inbox-notif-time">
                        {timeAgo(
                          notification.created_at
                        )}
                      </span>
                    </div>
                  )
                }
              )}
            </>
          )}
      </div>
    </div>
  )
}