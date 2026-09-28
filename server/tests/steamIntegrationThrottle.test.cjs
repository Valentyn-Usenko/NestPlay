/* global process, require */

const test =
  require('node:test')

const assert =
  require('node:assert/strict')

const {
  _test
} = require('../steamIntegration')

const {
  createSteamLink
} = _test


test(
  'throttles repeated Steam link starts without replacing the first state',
  async () => {
    const originalCallbackUrl =
      process.env.STEAM_CALLBACK_URL

    process.env.STEAM_CALLBACK_URL =
      'http://localhost:3001/api/integrations/steam/callback'

    let recentCheckCount = 0
    let insertCount = 0
    let deleteUserStateCount = 0
    let rollbackCount = 0

    const client = {
      async query(
        sql
      ) {
        const text =
          String(sql)
            .replace(/\s+/g, ' ')
            .trim()

        if (
          text ===
          'BEGIN'
        ) {
          return {
            rows: []
          }
        }

        if (
          text.includes(
            'SELECT id FROM profiles'
          ) &&
          text.includes(
            'FOR UPDATE'
          )
        ) {
          return {
            rows: [
              {
                id:
                  '11111111-1111-4111-8111-111111111111'
              }
            ]
          }
        }

        if (
          text.includes(
            'SELECT 1 FROM external_account_link_states'
          ) &&
          text.includes(
            'created_at >'
          )
        ) {
          recentCheckCount += 1

          return {
            rows:
              recentCheckCount === 1
                ? []
                : [
                    {
                      exists: 1
                    }
                  ]
          }
        }

        if (
          text.includes(
            'DELETE FROM external_account_link_states'
          ) &&
          text.includes(
            'user_id = $1'
          )
        ) {
          deleteUserStateCount += 1

          return {
            rows: []
          }
        }

        if (
          text.startsWith(
            'DELETE FROM external_account_link_states'
          )
        ) {
          return {
            rows: []
          }
        }

        if (
          text.includes(
            'INSERT INTO external_account_link_states'
          )
        ) {
          insertCount += 1

          return {
            rows: []
          }
        }

        if (
          text ===
          'COMMIT'
        ) {
          return {
            rows: []
          }
        }

        if (
          text ===
          'ROLLBACK'
        ) {
          rollbackCount += 1

          return {
            rows: []
          }
        }

        throw new Error(
          `Unexpected SQL in test: ${text}`
        )
      },

      release() {}
    }

    const fakePool = {
      async connect() {
        return client
      }
    }

    const userId =
      '11111111-1111-4111-8111-111111111111'

    try {
      const first =
        await createSteamLink(
          fakePool,
          userId
        )

      assert.match(
        first.authorizationUrl,
        /^https:\/\/steamcommunity\.com\/openid\/login/
      )

      assert.equal(
        insertCount,
        1
      )

      await assert.rejects(
        () =>
          createSteamLink(
            fakePool,
            userId
          ),
        error => {
          assert.equal(
            error.statusCode,
            429
          )

          assert.match(
            error.message,
            /wait a few seconds/i
          )

          return true
        }
      )

      assert.equal(
        insertCount,
        1,
        'Second request must not create another state'
      )

      assert.equal(
        deleteUserStateCount,
        1,
        'Second request must not replace the first state'
      )

      assert.equal(
        rollbackCount,
        1
      )
    } finally {
      if (
        originalCallbackUrl ===
        undefined
      ) {
        delete process.env
          .STEAM_CALLBACK_URL
      } else {
        process.env
          .STEAM_CALLBACK_URL =
          originalCallbackUrl
      }
    }
  }
)