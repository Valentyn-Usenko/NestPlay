import {
  getPresenceTicket
} from './api'

const HEARTBEAT_MS = 20 * 1000
const MAX_RECONNECT_MS = 15 * 1000

let socket = null
let stopped = true
let heartbeatTimer = null
let reconnectTimer = null
let reconnectAttempt = 0
let connectPromise = null

const listeners = new Set()
const stateByUser = new Map()

function emit(event) {
  if (
    event?.type ===
      'presence:update' &&
    event?.friend?.id
  ) {
    stateByUser.set(
      event.friend.id,
      event
    )
  }

  for (const listener of listeners) {
    try {
      listener(event)
    } catch (error) {
      console.error(
        'Presence listener error:',
        error
      )
    }
  }
}

function clearHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(
      heartbeatTimer
    )
    heartbeatTimer = null
  }
}

function clearReconnect() {
  if (reconnectTimer) {
    clearTimeout(
      reconnectTimer
    )
    reconnectTimer = null
  }
}

function sendHeartbeat() {
  if (
    socket?.readyState !==
    WebSocket.OPEN
  ) {
    return
  }

  socket.send(
    JSON.stringify({
      action: 'heartbeat'
    })
  )
}

function scheduleReconnect() {
  if (
    stopped ||
    reconnectTimer
  ) {
    return
  }

  const baseDelay = Math.min(
    1000 *
      2 ** reconnectAttempt,
    MAX_RECONNECT_MS
  )

  const jitter =
    Math.floor(
      Math.random() * 400
    )

  reconnectAttempt += 1

  reconnectTimer = setTimeout(
    () => {
      reconnectTimer = null
      void connectPresence()
    },
    baseDelay + jitter
  )
}

async function openSocket() {
  const wsUrl =
    import.meta.env
      .VITE_PRESENCE_WS_URL

  if (!wsUrl) {
    throw new Error(
      'VITE_PRESENCE_WS_URL is missing'
    )
  }

  const result =
    await getPresenceTicket()

  if (!result?.ticket) {
    throw new Error(
      'Presence ticket was not returned'
    )
  }

  if (stopped) {
    return
  }

  const separator =
    wsUrl.includes('?')
      ? '&'
      : '?'

  const nextSocket =
    new WebSocket(
      `${wsUrl}${separator}ticket=${encodeURIComponent(
        result.ticket
      )}`
    )

  socket = nextSocket

  nextSocket.addEventListener(
    'open',
    () => {
      if (
        socket !== nextSocket
      ) {
        return
      }

      reconnectAttempt = 0
      clearReconnect()
      clearHeartbeat()

      heartbeatTimer =
        setInterval(
          sendHeartbeat,
          HEARTBEAT_MS
        )

      sendHeartbeat()

      emit({
        type:
          'presence:connected'
      })
    }
  )

  nextSocket.addEventListener(
    'message',
    event => {
      try {
        const parsed =
          JSON.parse(
            event.data
          )

        emit(parsed)
      } catch {
        // Ignore non-JSON WebSocket messages.
      }
    }
  )

  nextSocket.addEventListener(
    'close',
    () => {
      if (
        socket === nextSocket
      ) {
        socket = null
      }

      clearHeartbeat()

      emit({
        type:
          'presence:disconnected'
      })

      scheduleReconnect()
    }
  )

  nextSocket.addEventListener(
    'error',
    () => {
      // The close event handles reconnection.
    }
  )
}

export async function connectPresence() {
  if (!stopped) {
    if (
      socket &&
      (
        socket.readyState ===
          WebSocket.OPEN ||
        socket.readyState ===
          WebSocket.CONNECTING
      )
    ) {
      return
    }
  }

  stopped = false

  if (connectPromise) {
    return connectPromise
  }

  connectPromise =
    openSocket()
      .catch(error => {
        console.error(
          'Presence connection failed:',
          error
        )

        scheduleReconnect()
      })
      .finally(() => {
        connectPromise = null
      })

  return connectPromise
}

export function disconnectPresence() {
  stopped = true
  clearReconnect()
  clearHeartbeat()
  stateByUser.clear()

  if (socket) {
    const currentSocket = socket
    socket = null

    try {
      currentSocket.close(
        1000,
        'logout'
      )
    } catch {
      // Nothing else to do.
    }
  }
}

export function touchPresence() {
  sendHeartbeat()
}

export function subscribePresence(
  listener
) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function getPresenceState() {
  return new Map(stateByUser)
}

if (
  typeof window !== 'undefined'
) {
  window.addEventListener(
    'online',
    () => {
      if (!stopped) {
        void connectPresence()
      }
    }
  )

  window.addEventListener(
    'focus',
    touchPresence
  )

  document.addEventListener(
    'visibilitychange',
    () => {
      if (
        document.visibilityState ===
        'visible'
      ) {
        touchPresence()
      }
    }
  )
}

