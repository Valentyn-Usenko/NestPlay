import {
  getAuthAccessToken
} from './authSession'

const API_URL = (
  import.meta.env.VITE_API_URL ||
  'http://localhost:3001'
).replace(/\/$/, '')

async function apiFetch(path, options = {}) {
  const accessToken =
    await getAuthAccessToken()

  const headers = {
    ...(options.headers || {})
  }

  if (accessToken) {
    headers.Authorization =
      `Bearer ${accessToken}`
  }

  if (options.body) {
    headers['Content-Type'] =
      'application/json'
  }

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      headers
    }
  )

  const data =
    await response.json()

  if (!response.ok) {
    throw new Error(
      data.error ||
      'Request failed'
    )
  }

  return data
}


// ==================================================
// POSTS
// ==================================================

export function getPosts(search = '') {
  const query = search
    ? `?search=${encodeURIComponent(search)}`
    : ''

  return apiFetch(
    `/api/posts${query}`
  )
}

export function getPost(id) {
  return apiFetch(
    `/api/posts/${id}`
  )
}

export function createPost(post) {
  return apiFetch(
    '/api/posts',
    {
      method: 'POST',
      body: JSON.stringify(post)
    }
  )
}

export function deletePost(id) {
  return apiFetch(
    `/api/posts/${id}`,
    {
      method: 'DELETE'
    }
  )
}

// ==================================================
// GAME HUBS
// ==================================================

export function getGameHub(
  gameId
) {
  return apiFetch(
    `/api/game-hubs/${encodeURIComponent(
      gameId
    )}`
  )
}


export function joinGameHub(
  game
) {
  return apiFetch(
    `/api/game-hubs/${encodeURIComponent(
      game.id
    )}/join`,
    {
      method: 'POST',

      body: JSON.stringify({
        game_name:
          game.name,

        game_art_url:
          game.gameArtUrl ||
          game.game_art_url ||
          game.background_image ||
          null
      })
    }
  )
}


export function leaveGameHub(
  gameId
) {
  return apiFetch(
    `/api/game-hubs/${encodeURIComponent(
      gameId
    )}/join`,
    {
      method: 'DELETE'
    }
  )
}

// ==================================================
// VOTES
// ==================================================

export function voteOnPost(
  id,
  voteType
) {
  return apiFetch(
    `/api/posts/${id}/vote`,
    {
      method: 'POST',

      body: JSON.stringify({
        vote_type: voteType
      })
    }
  )
}


// ==================================================
// COMMENTS
// ==================================================

export function getComments(postId) {
  return apiFetch(
    `/api/posts/${postId}/comments`
  )
}

export function createComment(
  postId,
  content
) {
  return apiFetch(
    `/api/posts/${postId}/comments`,
    {
      method: 'POST',

      body: JSON.stringify({
        content
      })
    }
  )
}

export function deleteComment(
  commentId
) {
  return apiFetch(
    `/api/comments/${commentId}`,
    {
      method: 'DELETE'
    }
  )
}


// ==================================================
// NOTIFICATIONS
// ==================================================

export function getNotifications() {
  return apiFetch(
    '/api/notifications'
  )
}

export function getUnreadNotificationCount() {
  return apiFetch(
    '/api/notifications/unread-count'
  )
}

export function markNotificationsRead() {
  return apiFetch(
    '/api/notifications/read',
    {
      method: 'PATCH'
    }
  )
}


// ==================================================
// FRIEND REQUESTS
// ==================================================

export function getPendingFriendRequests() {
  return apiFetch(
    '/api/friend-requests/pending'
  )
}

export function getPendingFriendRequestCount() {
  return apiFetch(
    '/api/friend-requests/pending-count'
  )
}

export function getFriends() {
  return apiFetch(
    '/api/friends'
  )
}

export function getUserFriends(
  userId
) {
  return apiFetch(
    `/api/users/${userId}/friends`
  )
}

export function getFriendStatus(
  userId
) {
  return apiFetch(
    `/api/friend-status/${userId}`
  )
}

export function sendFriendRequest(
  receiverId
) {
  return apiFetch(
    '/api/friend-requests',
    {
      method: 'POST',

      body: JSON.stringify({
        receiver_id: receiverId
      })
    }
  )
}

export function acceptFriendRequest(
  requestId
) {
  return apiFetch(
    `/api/friend-requests/${requestId}/accept`,
    {
      method: 'PATCH'
    }
  )
}

export function deleteFriendRequest(
  requestId
) {
  return apiFetch(
    `/api/friend-requests/${requestId}`,
    {
      method: 'DELETE'
    }
  )
}


// ==================================================
// MESSAGES
// ==================================================

export function getMessages(
  friendId
) {
  return apiFetch(
    `/api/messages/${friendId}`
  )
}

export function sendMessage(
  friendId,
  content
) {
  return apiFetch(
    `/api/messages/${friendId}`,
    {
      method: 'POST',

      body: JSON.stringify({
        content
      })
    }
  )
}

export function markMessagesRead(
  friendId
) {
  return apiFetch(
    `/api/messages/${friendId}/read`,
    {
      method: 'PATCH'
    }
  )
}

export function getUnreadMessageCount() {
  return apiFetch(
    '/api/messages/unread-count'
  )
}

export function getUnreadMessagesBySender() {
  return apiFetch(
    '/api/messages/unread-by-sender'
  )
}


// ==================================================
// PROFILES
// ==================================================

export function getMyProfile() {
  return apiFetch(
    '/api/profile'
  )
}

export function getProfile(userId) {
  return apiFetch(
    `/api/profiles/${userId}`
  )
}

export function getProfiles(ids) {
  if (!ids || ids.length === 0) {
    return Promise.resolve([])
  }

  const query =
    encodeURIComponent(
      ids.join(',')
    )

  return apiFetch(
    `/api/profiles?ids=${query}`
  )
}

export function updateProfile(fields) {
  return apiFetch(
    '/api/profile',
    {
      method: 'PATCH',
      body: JSON.stringify(fields)
    }
  )
}

export async function uploadAvatar(file) {
  const accessToken =
    await getAuthAccessToken()

  const formData =
    new FormData()

  formData.append(
    'avatar',
    file
  )

  const headers = {}

if (accessToken) {
  headers.Authorization =
    `Bearer ${accessToken}`
}

  const response =
    await fetch(
      `${API_URL}/api/profile/avatar`,
      {
        method: 'POST',
        headers,
        body: formData
      }
    )

  const data =
    await response.json()

  if (!response.ok) {
    throw new Error(
      data.error ||
      'Avatar upload failed'
    )
  }

  return data
}


export function deleteAvatar() {
  return apiFetch(
    '/api/profile/avatar',
    {
      method: 'DELETE'
    }
  )
}

// ==================================================
// ACHIEVEMENTS
// ==================================================

export function getUserAchievements(
  userId
) {
  return apiFetch(
    `/api/achievements/users/${encodeURIComponent(
      userId
    )}`
  )
}

export function setFeaturedAchievements(
  achievementIds
) {
  return apiFetch(
    '/api/achievements/featured',
    {
      method: 'PATCH',
      body: JSON.stringify({
        achievementIds
      })
    }
  )
}

export function getAchievementToasts() {
  return apiFetch(
    '/api/achievements/toasts'
  )
}

export function markAchievementToastDelivered(
  notificationId
) {
  return apiFetch(
    `/api/achievements/toasts/${encodeURIComponent(
      notificationId
    )}/delivered`,
    {
      method: 'PATCH'
    }
  )
}
export function getPresenceTicket() {
  return apiFetch(
    '/api/presence/ticket',
    {
      method: 'POST'
    }
  )
}

export function getOnlineFriends() {
  return apiFetch(
    '/api/presence/friends'
  )
}
