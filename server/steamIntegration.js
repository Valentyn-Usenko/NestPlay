/* global fetch, process, require, URL, URLSearchParams, AbortSignal */

const {
  createHash,
  randomBytes
} = require('crypto')

const {
  getCurrentSteamGame
} = require('./steamActivity')

const {
  getSteamFavoriteGames,
  getSteamLibraryForFavorites,
  saveSteamFavoriteGames
} = require('./steamFavorites')


const STEAM_PROVIDER =
  'steam'

const STEAM_OPENID_ENDPOINT =
  'https://steamcommunity.com/openid/login'

const OPENID_NAMESPACE =
  'http://specs.openid.net/auth/2.0'

const OPENID_IDENTIFIER_SELECT =
  'http://specs.openid.net/auth/2.0/identifier_select'

const LINK_STATE_LIFETIME_MINUTES =
  10

const LINK_START_MIN_INTERVAL_SECONDS =
  5


function hashLinkState(
  state
) {
  return createHash(
    'sha256'
  )
    .update(
      state,
      'utf8'
    )
    .digest('hex')
}


function createLinkState() {
  return randomBytes(32)
    .toString('base64url')
}


function getSteamCallbackUrl() {
  const raw =
    String(
      process.env
        .STEAM_CALLBACK_URL ||
      ''
    ).trim()

  if (!raw) {
    const error =
      new Error(
        'STEAM_CALLBACK_URL is not configured'
      )

    error.statusCode = 503

    throw error
  }

  let callbackUrl

  try {
    callbackUrl =
      new URL(raw)
  } catch {
    const error =
      new Error(
        'STEAM_CALLBACK_URL is invalid'
      )

    error.statusCode = 500

    throw error
  }

  const isLocal =
    callbackUrl.hostname ===
      'localhost' ||
    callbackUrl.hostname ===
      '127.0.0.1'

  if (
    callbackUrl.protocol !==
      'https:' &&
    !isLocal
  ) {
    const error =
      new Error(
        'STEAM_CALLBACK_URL must use HTTPS'
      )

    error.statusCode = 500

    throw error
  }

  return callbackUrl
}


function buildSteamLoginUrl(
  state
) {
  const callbackUrl =
    getSteamCallbackUrl()

  callbackUrl.searchParams.set(
    'state',
    state
  )

  const realm =
    `${callbackUrl.protocol}//${callbackUrl.host}/`

  const steamUrl =
    new URL(
      STEAM_OPENID_ENDPOINT
    )

  steamUrl.searchParams.set(
    'openid.ns',
    OPENID_NAMESPACE
  )

  steamUrl.searchParams.set(
    'openid.mode',
    'checkid_setup'
  )

  steamUrl.searchParams.set(
    'openid.return_to',
    callbackUrl.toString()
  )

  steamUrl.searchParams.set(
    'openid.realm',
    realm
  )

  steamUrl.searchParams.set(
    'openid.identity',
    OPENID_IDENTIFIER_SELECT
  )

  steamUrl.searchParams.set(
    'openid.claimed_id',
    OPENID_IDENTIFIER_SELECT
  )

  return steamUrl.toString()
}


function getSingleQueryValue(
  value
) {
  if (
    typeof value !==
    'string'
  ) {
    return null
  }

  return value
}


function extractSteamId(
  claimedId
) {
  if (
    typeof claimedId !==
    'string'
  ) {
    return null
  }

  const match =
    claimedId.match(
      /^https?:\/\/steamcommunity\.com\/openid\/id\/([0-9]+)$/
    )

  if (!match) {
    return null
  }

  const steamId =
    match[1]

  try {
    const value =
      BigInt(steamId)

    if (
      value <= 0n ||
      value >
        18446744073709551615n
    ) {
      return null
    }
  } catch {
    return null
  }

  return steamId
}


function validateOpenIdCallback(
  query,
  state
) {
  const mode =
    getSingleQueryValue(
      query[
        'openid.mode'
      ]
    )

  if (
    mode !==
    'id_res'
  ) {
    throw new Error(
      'Steam did not return a successful OpenID response'
    )
  }

  const namespace =
    getSingleQueryValue(
      query[
        'openid.ns'
      ]
    )

  if (
    namespace !==
    OPENID_NAMESPACE
  ) {
    throw new Error(
      'Invalid Steam OpenID namespace'
    )
  }

  const endpoint =
    getSingleQueryValue(
      query[
        'openid.op_endpoint'
      ]
    )

  if (
    endpoint !==
    STEAM_OPENID_ENDPOINT
  ) {
    throw new Error(
      'Invalid Steam OpenID endpoint'
    )
  }

  const claimedId =
    getSingleQueryValue(
      query[
        'openid.claimed_id'
      ]
    )

  const identity =
    getSingleQueryValue(
      query[
        'openid.identity'
      ]
    )

  if (
    !claimedId ||
    claimedId !== identity
  ) {
    throw new Error(
      'Invalid Steam OpenID identity'
    )
  }

  const steamId =
    extractSteamId(
      claimedId
    )

  if (!steamId) {
    throw new Error(
      'Steam returned an invalid SteamID'
    )
  }

  const returnTo =
    getSingleQueryValue(
      query[
        'openid.return_to'
      ]
    )

  const expectedReturnTo =
    getSteamCallbackUrl()

  expectedReturnTo
    .searchParams
    .set(
      'state',
      state
    )

  if (
    !returnTo ||
    returnTo !==
      expectedReturnTo.toString()
  ) {
    throw new Error(
      'Steam OpenID return URL did not match'
    )
  }

  const signedFieldsRaw =
    getSingleQueryValue(
      query[
        'openid.signed'
      ]
    )

  if (!signedFieldsRaw) {
    throw new Error(
      'Steam OpenID signature information is missing'
    )
  }

  const signedFields =
    new Set(
      signedFieldsRaw
        .split(',')
        .map(
          field =>
            field.trim()
        )
        .filter(Boolean)
    )

  const requiredSignedFields = [
    'op_endpoint',
    'claimed_id',
    'identity',
    'return_to',
    'response_nonce',
    'assoc_handle'
  ]

  for (
    const field of
      requiredSignedFields
  ) {
    if (
      !signedFields.has(
        field
      )
    ) {
      throw new Error(
        `Steam OpenID response did not sign ${field}`
      )
    }
  }

  return steamId
}


async function verifyWithSteam(
  query
) {
  const body =
    new URLSearchParams()

  for (
    const [
      key,
      value
    ] of
      Object.entries(query)
  ) {
    if (
      key.startsWith(
        'openid.'
      ) &&
      typeof value ===
        'string'
    ) {
      body.set(
        key,
        value
      )
    }
  }

  body.set(
    'openid.mode',
    'check_authentication'
  )

  const response =
    await fetch(
      STEAM_OPENID_ENDPOINT,
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded'
        },

        body,

        signal:
          AbortSignal.timeout(
            10000
          )
      }
    )

  if (!response.ok) {
    throw new Error(
      `Steam OpenID verification failed with HTTP ${response.status}`
    )
  }

  const responseText =
    await response.text()

  const values =
    new Map()

  for (
    const line of
      responseText.split(
        /\r?\n/
      )
  ) {
    const separator =
      line.indexOf(':')

    if (separator <= 0) {
      continue
    }

    values.set(
      line.slice(
        0,
        separator
      ),
      line.slice(
        separator + 1
      )
    )
  }

  return (
    values.get(
      'is_valid'
    ) ===
    'true'
  )
}


async function createSteamLink(
  pool,
  userId
) {
  const rawState =
    createLinkState()

  const stateHash =
    hashLinkState(
      rawState
    )

  const client =
    await pool.connect()

  try {
    await client.query(
      'BEGIN'
    )

    await client.query(
      `
      SELECT id
      FROM profiles
      WHERE id = $1
      FOR UPDATE
      `,
      [
        userId
      ]
    )

    const recentState =
      await client.query(
        `
        SELECT 1
        FROM external_account_link_states

        WHERE
          user_id = $1
          AND provider = $2
          AND created_at >
            NOW() -
            ($3 * INTERVAL '1 second')

        LIMIT 1
        `,
        [
          userId,
          STEAM_PROVIDER,
          LINK_START_MIN_INTERVAL_SECONDS
        ]
      )

    if (
      recentState.rows.length >
      0
    ) {
      const error =
        new Error(
          'Please wait a few seconds before trying to connect Steam again'
        )

      error.statusCode = 429

      throw error
    }

    await client.query(
      `
      DELETE FROM external_account_link_states
      WHERE
        expires_at <= NOW()
        OR used_at IS NOT NULL
      `
    )

    await client.query(
      `
      DELETE FROM external_account_link_states
      WHERE
        user_id = $1
        AND provider = $2
      `,
      [
        userId,
        STEAM_PROVIDER
      ]
    )

    await client.query(
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
        $3,
        NOW() +
          ($4 * INTERVAL '1 minute')
      )
      `,
      [
        stateHash,
        userId,
        STEAM_PROVIDER,
        LINK_STATE_LIFETIME_MINUTES
      ]
    )

    await client.query(
      'COMMIT'
    )
  } catch (error) {
    try {
      await client.query(
        'ROLLBACK'
      )
    } catch {
      // Nothing else to do.
    }

    throw error
  } finally {
    client.release()
  }

  return {
    authorizationUrl:
      buildSteamLoginUrl(
        rawState
      )
  }
}


async function assertSteamLinkStateActive(
  pool,
  rawState
) {
  const stateHash =
    hashLinkState(
      rawState
    )

  const result =
    await pool.query(
      `
      SELECT 1
      FROM external_account_link_states

      WHERE
        state_hash = $1
        AND provider = $2
        AND used_at IS NULL
        AND expires_at > NOW()

      LIMIT 1
      `,
      [
        stateHash,
        STEAM_PROVIDER
      ]
    )

  if (
    result.rows.length !==
    1
  ) {
    const error =
      new Error(
        'Steam linking request is invalid, expired, or already used'
      )

    error.statusCode = 400

    throw error
  }
}


async function consumeSteamLink(
  pool,
  rawState,
  steamId
) {
  const stateHash =
    hashLinkState(
      rawState
    )

  const stateResult =
    await pool.query(
      `
      UPDATE external_account_link_states

      SET used_at = NOW()

      WHERE
        state_hash = $1
        AND provider = $2
        AND used_at IS NULL
        AND expires_at > NOW()

      RETURNING user_id
      `,
      [
        stateHash,
        STEAM_PROVIDER
      ]
    )

  if (
    stateResult.rows.length !==
    1
  ) {
    const error =
      new Error(
        'Steam linking request is invalid, expired, or already used'
      )

    error.statusCode = 400

    throw error
  }

  const userId =
    stateResult
      .rows[0]
      .user_id

  const client =
    await pool.connect()

  try {
    await client.query(
      'BEGIN'
    )

    const userConnection =
      await client.query(
        `
        SELECT
          user_id,
          external_user_id

        FROM user_external_accounts

        WHERE
          user_id = $1
          AND provider = $2

        FOR UPDATE
        `,
        [
          userId,
          STEAM_PROVIDER
        ]
      )

    if (
      userConnection.rows.length >
        0 &&
      userConnection
        .rows[0]
        .external_user_id !==
        steamId
    ) {
      const error =
        new Error(
          'This NestPlay account already has a different Steam account connected'
        )

      error.statusCode = 409

      throw error
    }

    const steamConnection =
      await client.query(
        `
        SELECT
          user_id

        FROM user_external_accounts

        WHERE
          provider = $1
          AND external_user_id = $2

        FOR UPDATE
        `,
        [
          STEAM_PROVIDER,
          steamId
        ]
      )

    if (
      steamConnection.rows.length >
        0 &&
      steamConnection
        .rows[0]
        .user_id !==
        userId
    ) {
      const error =
        new Error(
          'This Steam account is already connected to another NestPlay account'
        )

      error.statusCode = 409

      throw error
    }

    if (
      userConnection.rows.length ===
      0
    ) {
      await client.query(
        `
        INSERT INTO user_external_accounts (
          user_id,
          provider,
          external_user_id
        )
        VALUES (
          $1,
          $2,
          $3
        )
        `,
        [
          userId,
          STEAM_PROVIDER,
          steamId
        ]
      )
    } else {
      await client.query(
        `
        UPDATE user_external_accounts

        SET updated_at = NOW()

        WHERE
          user_id = $1
          AND provider = $2
        `,
        [
          userId,
          STEAM_PROVIDER
        ]
      )
    }

    await client.query(
      'COMMIT'
    )

    return {
      userId,
      steamId
    }
  } catch (error) {
    try {
      await client.query(
        'ROLLBACK'
      )
    } catch {
      // Nothing else to do.
    }

    if (
      error.code ===
      '23505'
    ) {
      const conflict =
        new Error(
          'This Steam account or NestPlay account is already connected'
        )

      conflict.statusCode = 409

      throw conflict
    }

    throw error
  } finally {
    client.release()
  }
}

function registerSteamIntegrationRoutes({
  app,
  pool,
  requireAuth,
  ensureProfile
}) {
  function steamPrivacyHeaders(
    req,
    res,
    next
  ) {
    res.set(
      'Cache-Control',
      'private, no-store'
    )

    res.set(
      'Pragma',
      'no-cache'
    )

    res.set(
      'Referrer-Policy',
      'no-referrer'
    )

    next()
  }

  app.use(
    '/api/integrations/steam',
    steamPrivacyHeaders
  )

  app.use(
    '/api/users/:userId/steam/current-game',
    steamPrivacyHeaders
  )

  app.use(
    '/api/users/:userId/steam/favorite-games',
    steamPrivacyHeaders
  )
  app.post(
    '/api/integrations/steam/link/start',
    requireAuth,
    async (
      req,
      res
    ) => {
      try {
        await ensureProfile(
          req.user
        )

        const result =
          await createSteamLink(
            pool,
            req.user.id
          )

        return res.json(
          result
        )
      } catch (error) {
        console.error(
          'Start Steam link error:',
          error
        )

        return res
          .status(
            error.statusCode ||
            500
          )
          .json({
            error:
              error.message ||
              'Could not start Steam linking'
          })
      }
    }
  )


  app.get(
    '/api/integrations/steam',
    requireAuth,
    async (
      req,
      res
    ) => {
      try {
        await ensureProfile(
          req.user
        )

        const result =
          await pool.query(
            `
            SELECT
              external_user_id
                AS "steamId",

              display_name
                AS "displayName",

              activity_sharing_enabled
                AS "activitySharingEnabled",

              connected_at
                AS "connectedAt"

            FROM user_external_accounts

            WHERE
              user_id = $1
              AND provider = $2

            LIMIT 1
            `,
            [
              req.user.id,
              STEAM_PROVIDER
            ]
          )

        if (
          result.rows.length ===
          0
        ) {
          return res.json({
            connected: false,
            activitySharingEnabled:
              false
          })
        }

        return res.json({
          connected: true,
          ...result.rows[0]
        })
      } catch (error) {
        console.error(
          'Steam connection status error:',
          error
        )

        return res
          .status(500)
          .json({
            error:
              'Could not load Steam connection'
          })
      }
    }
  )


  app.get(
    '/api/integrations/steam/current-game',
    requireAuth,
    async (
      req,
      res
    ) => {
      try {
        await ensureProfile(
          req.user
        )

        const result =
          await getCurrentSteamGame(
            pool,
            req.user.id
          )

        return res.json(
          result
        )
      } catch (error) {
        console.error(
          'Steam current-game error:',
          error
        )

        return res
          .status(
            error.statusCode ||
            500
          )
          .json({
            error:
              'Could not load Steam current game'
          })
      }
    }
  )

  app.get(
    '/api/users/:userId/steam/current-game',
    requireAuth,
    async (
      req,
      res
    ) => {
      try {
        const targetUserId =
          String(
            req.params.userId ||
            ''
          ).trim()

        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            targetUserId
          )
        ) {
          return res
            .status(400)
            .json({
              error:
                'Invalid user ID'
            })
        }

        const profileResult =
          await pool.query(
            `
            SELECT is_private
            FROM profiles
            WHERE id = $1
            LIMIT 1
            `,
            [
              targetUserId
            ]
          )

        if (
          profileResult.rows.length === 0 ||
          profileResult.rows[0]
            .is_private
        ) {
          return res.json({
            currentGame: null
          })
        }

        const result =
          await getCurrentSteamGame(
            pool,
            targetUserId
          )

        return res.json({
          currentGame:
            result
              .activitySharingEnabled
              ? result.currentGame
              : null
        })
      } catch (error) {
        console.error(
          'Public Steam current-game error:',
          error
        )

        return res
          .status(
            error.statusCode ||
            500
          )
          .json({
            error:
              'Could not load Steam current game'
          })
      }
    }
  )

  app.get(
    '/api/integrations/steam/library',
    requireAuth,
    async (
      req,
      res
    ) => {
      try {
        await ensureProfile(
          req.user
        )

        const result =
          await getSteamLibraryForFavorites(
            pool,
            req.user.id
          )

        return res.json(
          result
        )
      } catch (error) {
        console.error(
          'Steam library error:',
          error
        )

        const statusCode =
          error.statusCode ||
          500

        return res
          .status(
            statusCode
          )
          .json({
            error:
              statusCode < 500
                ? error.message
                : 'Could not load Steam library'
          })
      }
    }
  )


  app.get(
    '/api/integrations/steam/favorite-games',
    requireAuth,
    async (
      req,
      res
    ) => {
      try {
        await ensureProfile(
          req.user
        )

        const result =
          await getSteamFavoriteGames(
            pool,
            req.user.id
          )

        return res.json(
          result
        )
      } catch (error) {
        console.error(
          'Steam favorite-games load error:',
          error
        )

        return res
          .status(
            error.statusCode ||
            500
          )
          .json({
            error:
              'Could not load Steam favorite games'
          })
      }
    }
  )

  app.put(
    '/api/integrations/steam/favorite-games',
    requireAuth,
    async (
      req,
      res
    ) => {
      try {
        await ensureProfile(
          req.user
        )

        const result =
          await saveSteamFavoriteGames(
            pool,
            req.user.id,
            req.body?.appIds
          )

        return res.json(
          result
        )
      } catch (error) {
        console.error(
          'Steam favorite-games save error:',
          error
        )

        const statusCode =
          error.statusCode ||
          500

        return res
          .status(
            statusCode
          )
          .json({
            error:
              statusCode < 500
                ? error.message
                : 'Could not save Steam favorite games'
          })
      }
    }
  )


  app.get(
    '/api/users/:userId/steam/favorite-games',
    requireAuth,
    async (
      req,
      res
    ) => {
      try {
        const targetUserId =
          String(
            req.params.userId ||
            ''
          ).trim()

        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            targetUserId
          )
        ) {
          return res
            .status(400)
            .json({
              error:
                'Invalid user ID'
            })
        }

        const profileResult =
          await pool.query(
            `
            SELECT is_private
            FROM profiles
            WHERE id = $1
            LIMIT 1
            `,
            [
              targetUserId
            ]
          )

        if (
          profileResult.rows.length ===
            0 ||
          profileResult.rows[0]
            .is_private
        ) {
          return res.json({
            games: []
          })
        }

        const result =
          await getSteamFavoriteGames(
            pool,
            targetUserId
          )

        return res.json({
          games:
            result.visible
              ? result.games
              : []
        })
      } catch (error) {
        console.error(
          'Public Steam favorite-games error:',
          error
        )

        return res
          .status(
            error.statusCode ||
            500
          )
          .json({
            error:
              'Could not load Steam favorite games'
          })
      }
    }
  )

  app.patch(
    '/api/integrations/steam/activity-sharing',
    requireAuth,
    async (
      req,
      res
    ) => {
      try {
        await ensureProfile(
          req.user
        )

        const enabled =
          req.body?.enabled

        if (
          typeof enabled !==
          'boolean'
        ) {
          return res
            .status(400)
            .json({
              error:
                'enabled must be a boolean'
            })
        }

        const result =
          await pool.query(
            `
            UPDATE user_external_accounts

            SET
              activity_sharing_enabled = $1,
              updated_at = NOW()

            WHERE
              user_id = $2
              AND provider = $3

            RETURNING
              activity_sharing_enabled
                AS "activitySharingEnabled"
            `,
            [
              enabled,
              req.user.id,
              STEAM_PROVIDER
            ]
          )

        if (
          result.rows.length ===
          0
        ) {
          return res
            .status(404)
            .json({
              error:
                'Steam account is not connected'
            })
        }

        return res.json({
          connected: true,
          activitySharingEnabled:
            result.rows[0]
              .activitySharingEnabled
        })
      } catch (error) {
        console.error(
          'Steam activity sharing update error:',
          error
        )

        return res
          .status(500)
          .json({
            error:
              'Could not update Steam activity sharing'
          })
      }
    }
  )

  app.delete(
    '/api/integrations/steam',
    requireAuth,
    async (
      req,
      res
    ) => {
      let client = null

      try {
        await ensureProfile(
          req.user
        )

        client =
          await pool.connect()

        await client.query(
          'BEGIN'
        )

        await client.query(
          `
          DELETE FROM external_account_link_states

          WHERE
            user_id = $1
            AND provider = $2
          `,
          [
            req.user.id,
            STEAM_PROVIDER
          ]
        )

        const result =
          await client.query(
            `
            DELETE FROM user_external_accounts

            WHERE
              user_id = $1
              AND provider = $2

            RETURNING id
            `,
            [
              req.user.id,
              STEAM_PROVIDER
            ]
          )

        await client.query(
          'COMMIT'
        )

        return res.json({
          connected: false,
          disconnected:
            result.rows.length > 0
        })
      } catch (error) {
        if (client) {
          try {
            await client.query(
              'ROLLBACK'
            )
          } catch {
            // Nothing else to do.
          }
        }

        console.error(
          'Steam disconnect error:',
          error
        )

        return res
          .status(500)
          .json({
            error:
              'Could not disconnect Steam account'
          })
      } finally {
        client?.release()
      }
    }
  )

  app.get(
    '/api/integrations/steam/callback',
    async (
      req,
      res
    ) => {
      try {
        const state =
          getSingleQueryValue(
            req.query.state
          )

        if (!state) {
          return res
            .status(400)
            .send(
              'Steam linking state is missing.'
            )
        }

        const steamId =
          validateOpenIdCallback(
            req.query,
            state
          )

        await assertSteamLinkStateActive(
          pool,
          state
        )

        const isValid =
          await verifyWithSteam(
            req.query
          )

        if (!isValid) {
          return res
            .status(400)
            .send(
              'Steam could not verify this sign-in.'
            )
        }

        await consumeSteamLink(
          pool,
          state,
          steamId
        )

        const frontendUrl =
          String(
            process.env.FRONTEND_URL ||
            ''
          ).trim()

        if (!frontendUrl) {
          const error =
            new Error(
              'FRONTEND_URL is not configured'
            )

          error.statusCode = 500

          throw error
        }

        const returnUrl =
          new URL(
            frontendUrl
          )

        returnUrl.searchParams.set(
          'steam',
          'connected'
        )

        return res.redirect(
          303,
          returnUrl.toString()
        )
      } catch (error) {
        console.error(
          'Steam callback error:',
          error
        )

        return res
          .status(
            error.statusCode ||
            400
          )
          .send(
            'Steam account could not be connected.'
          )
      }
    }
  )
}


module.exports = {
  registerSteamIntegrationRoutes,

  _test: {
    buildSteamLoginUrl,
    createSteamLink,
    consumeSteamLink,
    extractSteamId,
    hashLinkState,
    validateOpenIdCallback
  }
}