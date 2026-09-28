/* global process, require */

const test =
  require('node:test')

const assert =
  require('node:assert/strict')

process.env.STEAM_CALLBACK_URL =
  'http://localhost:3001/api/integrations/steam/callback'

const {
  _test
} = require('../steamIntegration')

const {
  buildSteamLoginUrl,
  extractSteamId,
  hashLinkState,
  validateOpenIdCallback
} = _test


function validCallbackQuery(
  state
) {
  const claimedId =
    'https://steamcommunity.com/openid/id/76561198000000000'

  const returnTo =
    new URL(
      process.env.STEAM_CALLBACK_URL
    )

  returnTo.searchParams.set(
    'state',
    state
  )

  return {
    'openid.ns':
      'http://specs.openid.net/auth/2.0',

    'openid.mode':
      'id_res',

    'openid.op_endpoint':
      'https://steamcommunity.com/openid/login',

    'openid.claimed_id':
      claimedId,

    'openid.identity':
      claimedId,

    'openid.return_to':
      returnTo.toString(),

    'openid.response_nonce':
      '2026-09-27T05:00:00Zexample',

    'openid.assoc_handle':
      'example',

    'openid.signed':
      [
        'op_endpoint',
        'claimed_id',
        'identity',
        'return_to',
        'response_nonce',
        'assoc_handle'
      ].join(','),

    'openid.sig':
      'not-used-in-local-validation'
  }
}


test(
  'builds a Steam OpenID login URL',
  () => {
    const state =
      'example-state'

    const result =
      new URL(
        buildSteamLoginUrl(
          state
        )
      )

    assert.equal(
      result.origin,
      'https://steamcommunity.com'
    )

    assert.equal(
      result.pathname,
      '/openid/login'
    )

    assert.equal(
      result.searchParams.get(
        'openid.mode'
      ),
      'checkid_setup'
    )

    const returnTo =
      new URL(
        result.searchParams.get(
          'openid.return_to'
        )
      )

    assert.equal(
      returnTo.searchParams.get(
        'state'
      ),
      state
    )
  }
)


test(
  'extracts a valid HTTPS SteamID',
  () => {
    assert.equal(
      extractSteamId(
        'https://steamcommunity.com/openid/id/76561198000000000'
      ),
      '76561198000000000'
    )
  }
)


test(
  'accepts the documented HTTP claimed ID form',
  () => {
    assert.equal(
      extractSteamId(
        'http://steamcommunity.com/openid/id/76561198000000000'
      ),
      '76561198000000000'
    )
  }
)


test(
  'rejects a forged Steam domain',
  () => {
    assert.equal(
      extractSteamId(
        'https://steamcommunity.com.evil.example/openid/id/76561198000000000'
      ),
      null
    )
  }
)


test(
  'rejects a malformed SteamID',
  () => {
    assert.equal(
      extractSteamId(
        'https://steamcommunity.com/openid/id/not-a-steamid'
      ),
      null
    )
  }
)


test(
  'hashes state deterministically without storing raw state',
  () => {
    const raw =
      'secret-link-state'

    const hash =
      hashLinkState(
        raw
      )

    assert.notEqual(
      hash,
      raw
    )

    assert.equal(
      hash.length,
      64
    )

    assert.equal(
      hash,
      hashLinkState(
        raw
      )
    )
  }
)


test(
  'accepts a structurally valid Steam callback',
  () => {
    const state =
      'valid-state'

    const steamId =
      validateOpenIdCallback(
        validCallbackQuery(
          state
        ),
        state
      )

    assert.equal(
      steamId,
      '76561198000000000'
    )
  }
)


test(
  'rejects altered return_to values',
  () => {
    const state =
      'valid-state'

    const query =
      validCallbackQuery(
        state
      )

    query[
      'openid.return_to'
    ] =
      'http://localhost:3001/api/integrations/steam/callback?state=attacker-state'

    assert.throws(
      () =>
        validateOpenIdCallback(
          query,
          state
        ),
      /return URL/
    )
  }
)


test(
  'rejects callbacks where identity differs from claimed_id',
  () => {
    const state =
      'valid-state'

    const query =
      validCallbackQuery(
        state
      )

    query[
      'openid.identity'
    ] =
      'https://steamcommunity.com/openid/id/76561198000000001'

    assert.throws(
      () =>
        validateOpenIdCallback(
          query,
          state
        ),
      /identity/
    )
  }
)


test(
  'rejects callbacks that did not sign claimed_id',
  () => {
    const state =
      'valid-state'

    const query =
      validCallbackQuery(
        state
      )

    query[
      'openid.signed'
    ] =
      [
        'op_endpoint',
        'identity',
        'return_to',
        'response_nonce',
        'assoc_handle'
      ].join(',')

    assert.throws(
      () =>
        validateOpenIdCallback(
          query,
          state
        ),
      /claimed_id/
    )
  }
)