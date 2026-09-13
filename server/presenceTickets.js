const crypto = require('node:crypto')

const DEFAULT_TTL_MS = 60 * 1000
const MAX_CLOCK_SKEW_MS = 10 * 1000

function getSecret(secret) {
  const value =
    secret ||
    process.env.PRESENCE_TICKET_SECRET

  if (!value) {
    throw new Error(
      'PRESENCE_TICKET_SECRET is required'
    )
  }

  return value
}

function signatureFor(
  payload,
  secret
) {
  return crypto
    .createHmac(
      'sha256',
      getSecret(secret)
    )
    .update(payload)
    .digest('base64url')
}

function createPresenceTicket(
  userId,
  options = {}
) {
  if (!userId) {
    throw new Error(
      'userId is required'
    )
  }

  const now =
    options.now ?? Date.now()

  const ttlMs =
    options.ttlMs ??
    DEFAULT_TTL_MS

  const payloadData = {
    v: 1,
    userId,
    exp: now + ttlMs,
    nonce: crypto
      .randomBytes(12)
      .toString('base64url')
  }

  const payload = Buffer
    .from(
      JSON.stringify(payloadData),
      'utf8'
    )
    .toString('base64url')

  const signature =
    signatureFor(
      payload,
      options.secret
    )

  return `${payload}.${signature}`
}

function safeEqual(
  left,
  right
) {
  const leftBuffer =
    Buffer.from(left)

  const rightBuffer =
    Buffer.from(right)

  if (
    leftBuffer.length !==
    rightBuffer.length
  ) {
    return false
  }

  return crypto.timingSafeEqual(
    leftBuffer,
    rightBuffer
  )
}

function verifyPresenceTicket(
  ticket,
  options = {}
) {
  if (
    typeof ticket !== 'string' ||
    !ticket.includes('.')
  ) {
    throw new Error(
      'Invalid presence ticket'
    )
  }

  const [
    payload,
    suppliedSignature
  ] = ticket.split('.')

  if (
    !payload ||
    !suppliedSignature
  ) {
    throw new Error(
      'Invalid presence ticket'
    )
  }

  const expectedSignature =
    signatureFor(
      payload,
      options.secret
    )

  if (
    !safeEqual(
      suppliedSignature,
      expectedSignature
    )
  ) {
    throw new Error(
      'Invalid presence ticket signature'
    )
  }

  let decoded

  try {
    decoded = JSON.parse(
      Buffer
        .from(
          payload,
          'base64url'
        )
        .toString('utf8')
    )
  } catch {
    throw new Error(
      'Invalid presence ticket payload'
    )
  }

  if (
    decoded?.v !== 1 ||
    !decoded?.userId ||
    !Number.isFinite(decoded?.exp)
  ) {
    throw new Error(
      'Invalid presence ticket payload'
    )
  }

  const now =
    options.now ?? Date.now()

  if (
    decoded.exp +
      MAX_CLOCK_SKEW_MS <
    now
  ) {
    throw new Error(
      'Presence ticket expired'
    )
  }

  return decoded
}

module.exports = {
  createPresenceTicket,
  verifyPresenceTicket
}
