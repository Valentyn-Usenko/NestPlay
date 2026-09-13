const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createPresenceTicket,
  verifyPresenceTicket
} = require('../presenceTickets')

const SECRET =
  'test-presence-secret-that-is-long-enough'

test(
  'creates and verifies a presence ticket',
  () => {
    const now = 100000

    const ticket =
      createPresenceTicket(
        '11111111-1111-1111-1111-111111111111',
        {
          now,
          ttlMs: 60000,
          secret: SECRET
        }
      )

    const decoded =
      verifyPresenceTicket(
        ticket,
        {
          now: now + 1000,
          secret: SECRET
        }
      )

    assert.equal(
      decoded.userId,
      '11111111-1111-1111-1111-111111111111'
    )
  }
)

test(
  'rejects a tampered presence ticket',
  () => {
    const ticket =
      createPresenceTicket(
        '11111111-1111-1111-1111-111111111111',
        {
          now: 100000,
          secret: SECRET
        }
      )

    assert.throws(
      () =>
        verifyPresenceTicket(
          ticket + 'x',
          {
            now: 100001,
            secret: SECRET
          }
        ),
      /signature/
    )
  }
)

test(
  'rejects an expired presence ticket',
  () => {
    const ticket =
      createPresenceTicket(
        '11111111-1111-1111-1111-111111111111',
        {
          now: 100000,
          ttlMs: 1000,
          secret: SECRET
        }
      )

    assert.throws(
      () =>
        verifyPresenceTicket(
          ticket,
          {
            now: 112000,
            secret: SECRET
          }
        ),
      /expired/
    )
  }
)
