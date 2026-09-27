/* global __dirname, require */

const test =
  require('node:test')

const assert =
  require('node:assert/strict')

const path =
  require('path')

const {
  randomBytes
} = require('crypto')


require('dotenv').config()

require('dotenv').config({
  path:
    path.join(
      __dirname,
      '..',
      '.env'
    )
})


const pool =
  require('../db')

const {
  _test
} = require('../steamIntegration')

const {
  consumeSteamLink,
  hashLinkState
} = _test


function makeState() {
  return randomBytes(32)
    .toString('base64url')
}


test(
  'Steam link states are single-use and expire',
  async () => {
    const createdHashes = []

    try {
      const profileResult =
        await pool.query(
          `
          SELECT id
          FROM profiles
          ORDER BY created_at ASC
          LIMIT 1
          `
        )

      assert.equal(
        profileResult.rows.length,
        1,
        'A NestPlay profile is required for this test'
      )

      const userId =
        profileResult.rows[0].id


      // --------------------------------------------
      // VALID STATE
      // --------------------------------------------

      const validState =
        makeState()

      const validHash =
        hashLinkState(
          validState
        )

      createdHashes.push(
        validHash
      )

      await pool.query(
        `
        INSERT INTO external_account_link_states (
          state_hash,
          user_id,
          provider,
          expires_at
        )
        VALUES (
          $1,
          $2,
          'steam',
          NOW() + INTERVAL '5 minutes'
        )
        `,
        [
          validHash,
          userId
        ]
      )


      // This wrapper uses the real database for
      // consuming the state, but deliberately stops
      // before Steam account linking can begin.
      const stateOnlyPool = {
        query: (
          ...args
        ) =>
          pool.query(
            ...args
          ),

        connect:
          async () => {
            throw new Error(
              'EXPECTED_TEST_STOP_AFTER_STATE_CONSUMPTION'
            )
          }
      }


      await assert.rejects(
        () =>
          consumeSteamLink(
            stateOnlyPool,
            validState,
            '76561198000000000'
          ),
        /EXPECTED_TEST_STOP_AFTER_STATE_CONSUMPTION/
      )


      const consumedResult =
        await pool.query(
          `
          SELECT used_at
          FROM external_account_link_states
          WHERE state_hash = $1
          `,
          [
            validHash
          ]
        )

      assert.equal(
        consumedResult.rows.length,
        1
      )

      assert.ok(
        consumedResult
          .rows[0]
          .used_at,
        'State should remain consumed even though later linking failed'
      )


      // --------------------------------------------
      // REPLAY
      // --------------------------------------------

      await assert.rejects(
        () =>
          consumeSteamLink(
            stateOnlyPool,
            validState,
            '76561198000000000'
          ),
        /invalid, expired, or already used/
      )


      // --------------------------------------------
      // EXPIRED STATE
      // --------------------------------------------

      const expiredState =
        makeState()

      const expiredHash =
        hashLinkState(
          expiredState
        )

      createdHashes.push(
        expiredHash
      )

      await pool.query(
        `
        INSERT INTO external_account_link_states (
          state_hash,
          user_id,
          provider,
          created_at,
          expires_at
        )
        VALUES (
          $1,
          $2,
          'steam',
          NOW() - INTERVAL '2 minutes',
          NOW() - INTERVAL '1 minute'
        )
        `,
        [
          expiredHash,
          userId
        ]
      )

      await assert.rejects(
        () =>
          consumeSteamLink(
            stateOnlyPool,
            expiredState,
            '76561198000000000'
          ),
        /invalid, expired, or already used/
      )


      // --------------------------------------------
      // UNKNOWN STATE
      // --------------------------------------------

      await assert.rejects(
        () =>
          consumeSteamLink(
            stateOnlyPool,
            makeState(),
            '76561198000000000'
          ),
        /invalid, expired, or already used/
      )


      // --------------------------------------------
      // MAKE SURE NO STEAM ACCOUNT WAS CREATED
      // --------------------------------------------

      const accountResult =
        await pool.query(
          `
          SELECT COUNT(*)::int AS count
          FROM user_external_accounts
          `
        )

      assert.equal(
        accountResult.rows[0].count,
        0,
        'Database state test must not create Steam connections'
      )
    } finally {
      if (
        createdHashes.length >
        0
      ) {
        await pool.query(
          `
          DELETE FROM external_account_link_states
          WHERE state_hash = ANY($1::text[])
          `,
          [
            createdHashes
          ]
        )
      }

      await pool.end()
    }
  }
)