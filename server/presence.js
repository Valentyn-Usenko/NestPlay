const crypto = require('node:crypto')

const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand
} = require(
  '@aws-sdk/client-apigatewaymanagementapi'
)

const {
  createPresenceTicket,
  verifyPresenceTicket
} = require('./presenceTickets')

const CONNECTION_TTL_SECONDS = 75
const SWEEP_INTERVAL_MS = 10 * 1000
const OFFLINE_GRACE_MS = 12 * 1000

function timingSafeStringEqual(
  left,
  right
) {
  const leftBuffer = Buffer.from(
    String(left || '')
  )

  const rightBuffer = Buffer.from(
    String(right || '')
  )

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

function createPresenceService(
  pool,
  options = {}
) {
  if (!pool) {
    throw new Error(
      'Presence service requires a database pool'
    )
  }

  const signProfile =
    options.signProfile ||
    (async profile => profile)

  const gatewayClients =
    new Map()

  function gatewayClient(
    domainName,
    stage
  ) {
    const key =
      `${domainName}/${stage}`

    if (
      !gatewayClients.has(key)
    ) {
      gatewayClients.set(
        key,
        new ApiGatewayManagementApiClient({
          endpoint:
            `https://${domainName}/${stage}`
        })
      )
    }

    return gatewayClients.get(key)
  }

  async function removeConnection(
    connectionId
  ) {
    await pool.query(
      `
      DELETE FROM presence_connections
      WHERE connection_id = $1
      `,
      [connectionId]
    )
  }

  async function postToConnection(
    connection,
    payload
  ) {
    const client = gatewayClient(
      connection.gateway_domain,
      connection.gateway_stage
    )

    try {
      await client.send(
        new PostToConnectionCommand({
          ConnectionId:
            connection.connection_id,

          Data: Buffer.from(
            JSON.stringify(payload)
          )
        })
      )

      return true
    } catch (error) {
      const statusCode =
        error?.$metadata
          ?.httpStatusCode

      if (
        statusCode === 410 ||
        error?.name ===
          'GoneException'
      ) {
        await removeConnection(
          connection.connection_id
        )

        return false
      }

      console.error(
        'Presence push error:',
        error
      )

      return false
    }
  }

  async function getProfile(
    userId
  ) {
    const result = await pool.query(
      `
      SELECT
        id,
        username,
        avatar_url,
        avatar_color,
        show_online_status
      FROM profiles
      WHERE id = $1
      LIMIT 1
      `,
      [userId]
    )

    if (!result.rows[0]) {
      return null
    }

    return signProfile(
      result.rows[0]
    )
  }

  async function isUserOnline(
    userId
  ) {
    const result = await pool.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM presence_connections
        WHERE
          user_id = $1
          AND expires_at > NOW()
      ) AS online
      `,
      [userId]
    )

    return Boolean(
      result.rows[0]?.online
    )
  }

  async function getFriendViewerConnections(
    userId
  ) {
    const result = await pool.query(
      `
      WITH friend_ids AS (
        SELECT
          CASE
            WHEN sender_id = $1
              THEN receiver_id
            ELSE sender_id
          END AS friend_id
        FROM friend_requests
        WHERE
          status = 'accepted'
          AND (
            sender_id = $1
            OR receiver_id = $1
          )
      )
      SELECT DISTINCT
        pc.connection_id,
        pc.gateway_domain,
        pc.gateway_stage
      FROM friend_ids f
      JOIN presence_connections pc
        ON pc.user_id = f.friend_id
      WHERE pc.expires_at > NOW()
      `,
      [userId]
    )

    return result.rows
  }

  async function notifyAcceptedFriends(
    userId,
    status,
    at = new Date()
  ) {
    const profile =
      await getProfile(userId)

    if (
      !profile ||
      profile.show_online_status ===
        false
    ) {
      return
    }

    const connections =
      await getFriendViewerConnections(
        userId
      )

    if (
      connections.length === 0
    ) {
      return
    }

    const payload = {
      type: 'presence:update',
      status,
      lastActiveAt:
        at.toISOString(),
      graceMs:
        OFFLINE_GRACE_MS,
      friend: {
        id: profile.id,
        username:
          profile.username ||
          'Unknown',
        avatar_url:
          profile.avatar_url ||
          null,
        avatar_color:
          profile.avatar_color ||
          'purple'
      }
    }

    await Promise.allSettled(
      connections.map(
        connection =>
          postToConnection(
            connection,
            payload
          )
      )
    )
  }

  async function getOnlineFriends(
    userId
  ) {
    const result = await pool.query(
      `
      WITH friend_ids AS (
        SELECT
          CASE
            WHEN sender_id = $1
              THEN receiver_id
            ELSE sender_id
          END AS friend_id
        FROM friend_requests
        WHERE
          status = 'accepted'
          AND (
            sender_id = $1
            OR receiver_id = $1
          )
      ),
      online_friends AS (
        SELECT
          p.id,
          p.username,
          p.avatar_url,
          p.avatar_color,
          MAX(
            pc.last_active_at
          ) AS last_active_at
        FROM friend_ids f
        JOIN profiles p
          ON p.id = f.friend_id
        JOIN presence_connections pc
          ON pc.user_id = p.id
        WHERE
          p.show_online_status = TRUE
          AND pc.expires_at > NOW()
        GROUP BY
          p.id,
          p.username,
          p.avatar_url,
          p.avatar_color
      )
      SELECT *
      FROM online_friends
      ORDER BY
        last_active_at DESC,
        LOWER(username) ASC
      `,
      [userId]
    )

    return Promise.all(
      result.rows.map(
        async row => {
          const signed =
            await signProfile(row)

          return {
            id: signed.id,
            username:
              signed.username ||
              'Unknown',
            avatar_url:
              signed.avatar_url ||
              null,
            avatar_color:
              signed.avatar_color ||
              'purple',
            lastActiveAt:
              signed.last_active_at
          }
        }
      )
    )
  }

  async function connect({
    connectionId,
    domainName,
    stage,
    ticket
  }) {
    const decoded =
      verifyPresenceTicket(ticket)

    const userId =
      decoded.userId

    const client =
      await pool.connect()

    let wasOnline = false

    try {
      await client.query('BEGIN')

      await client.query(
        `
        SELECT pg_advisory_xact_lock(
          hashtext($1)::bigint
        )
        `,
        [userId]
      )

      const previous =
        await client.query(
          `
          SELECT EXISTS (
            SELECT 1
            FROM presence_connections
            WHERE
              user_id = $1
              AND expires_at > NOW()
          ) AS online
          `,
          [userId]
        )

      wasOnline = Boolean(
        previous.rows[0]?.online
      )

      await client.query(
        `
        INSERT INTO presence_connections (
          connection_id,
          user_id,
          gateway_domain,
          gateway_stage,
          connected_at,
          last_active_at,
          expires_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          NOW(),
          NOW(),
          NOW() +
            ($5 * INTERVAL '1 second')
        )
        ON CONFLICT (
          connection_id
        )
        DO UPDATE SET
          user_id = EXCLUDED.user_id,
          gateway_domain =
            EXCLUDED.gateway_domain,
          gateway_stage =
            EXCLUDED.gateway_stage,
          last_active_at = NOW(),
          expires_at =
            NOW() +
            ($5 * INTERVAL '1 second')
        `,
        [
          connectionId,
          userId,
          domainName,
          stage,
          CONNECTION_TTL_SECONDS
        ]
      )

      await client.query('COMMIT')
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

    if (!wasOnline) {
      await notifyAcceptedFriends(
        userId,
        'online'
      )
    }

    return {
      userId,
      online: true
    }
  }

  async function disconnect(
    connectionId
  ) {
    const client =
      await pool.connect()

    let userId = null
    let stillOnline = false

    try {
      await client.query('BEGIN')

      const found =
        await client.query(
          `
          SELECT user_id
          FROM presence_connections
          WHERE connection_id = $1
          FOR UPDATE
          `,
          [connectionId]
        )

      userId =
        found.rows[0]?.user_id ||
        null

      if (!userId) {
        await client.query('COMMIT')

        return {
          online: false,
          ignored: true
        }
      }

      await client.query(
        `
        SELECT pg_advisory_xact_lock(
          hashtext($1)::bigint
        )
        `,
        [userId]
      )

      await client.query(
        `
        DELETE FROM presence_connections
        WHERE connection_id = $1
        `,
        [connectionId]
      )

      const remaining =
        await client.query(
          `
          SELECT EXISTS (
            SELECT 1
            FROM presence_connections
            WHERE
              user_id = $1
              AND expires_at > NOW()
          ) AS online
          `,
          [userId]
        )

      stillOnline = Boolean(
        remaining.rows[0]?.online
      )

      await client.query('COMMIT')
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

    if (
      userId &&
      !stillOnline
    ) {
      await notifyAcceptedFriends(
        userId,
        'recently_offline'
      )
    }

    return {
      userId,
      online: stillOnline
    }
  }

  async function heartbeat(
    connectionId
  ) {
    const result = await pool.query(
      `
      UPDATE presence_connections
      SET
        last_active_at = NOW(),
        expires_at =
          NOW() +
          ($2 * INTERVAL '1 second')
      WHERE connection_id = $1
      RETURNING user_id
      `,
      [
        connectionId,
        CONNECTION_TTL_SECONDS
      ]
    )

    return {
      ok: result.rowCount > 0
    }
  }

  async function sweepExpired() {
    try {
      const expired =
        await pool.query(
          `
          DELETE FROM presence_connections
          WHERE expires_at <= NOW()
          RETURNING user_id
          `
        )

      const userIds = [
        ...new Set(
          expired.rows.map(
            row => row.user_id
          )
        )
      ]

      for (const userId of userIds) {
        const online =
          await isUserOnline(userId)

        if (!online) {
          await notifyAcceptedFriends(
            userId,
            'recently_offline'
          )
        }
      }
    } catch (error) {
      console.error(
        'Presence stale-session sweep failed:',
        error
      )
    }
  }

  const sweepTimer = setInterval(
    sweepExpired,
    SWEEP_INTERVAL_MS
  )

  if (
    typeof sweepTimer.unref ===
    'function'
  ) {
    sweepTimer.unref()
  }

  function stop() {
    clearInterval(sweepTimer)
  }

  return {
    connect,
    disconnect,
    heartbeat,
    getOnlineFriends,
    notifyAcceptedFriends,
    stop
  }
}

function registerPresenceRoutes({
  app,
  pool,
  requireAuth,
  signProfile
}) {
  const service =
    createPresenceService(
      pool,
      {
        signProfile
      }
    )

  function requireBridge(
    req,
    res,
    next
  ) {
    const expected =
      process.env
        .PRESENCE_BRIDGE_KEY

    if (!expected) {
      return res.status(503).json({
        error:
          'Presence bridge is not configured'
      })
    }

    const supplied =
      req.get(
        'x-presence-bridge-key'
      )

    if (
      !timingSafeStringEqual(
        supplied,
        expected
      )
    ) {
      return res.status(401).json({
        error: 'Unauthorized'
      })
    }

    next()
  }

  app.post(
    '/api/presence/ticket',
    requireAuth,
    async (req, res) => {
      try {
        const ticket =
          createPresenceTicket(
            req.user.id
          )

        res.json({ ticket })
      } catch (error) {
        console.error(
          'Presence ticket error:',
          error
        )

        res.status(500).json({
          error:
            'Could not create presence ticket'
        })
      }
    }
  )

  app.get(
    '/api/presence/friends',
    requireAuth,
    async (req, res) => {
      try {
        const friends =
          await service
            .getOnlineFriends(
              req.user.id
            )

        res.json({ friends })
      } catch (error) {
        console.error(
          'Online friends error:',
          error
        )

        res.status(500).json({
          error:
            'Could not load online friends'
        })
      }
    }
  )

  app.post(
    '/api/presence/ws/connect',
    requireBridge,
    async (req, res) => {
      try {
        const result =
          await service.connect({
            connectionId:
              req.body?.connectionId,
            domainName:
              req.body?.domainName,
            stage:
              req.body?.stage,
            ticket:
              req.body?.ticket
          })

        res.json(result)
      } catch (error) {
        console.error(
          'Presence connect error:',
          error
        )

        res.status(401).json({
          error:
            'Presence connection rejected'
        })
      }
    }
  )

  app.post(
    '/api/presence/ws/disconnect',
    requireBridge,
    async (req, res) => {
      try {
        const result =
          await service.disconnect(
            req.body?.connectionId
          )

        res.json(result)
      } catch (error) {
        console.error(
          'Presence disconnect error:',
          error
        )

        res.status(500).json({
          error:
            'Could not close presence connection'
        })
      }
    }
  )

  app.post(
    '/api/presence/ws/heartbeat',
    requireBridge,
    async (req, res) => {
      try {
        const result =
          await service.heartbeat(
            req.body?.connectionId
          )

        res.json(result)
      } catch (error) {
        console.error(
          'Presence heartbeat error:',
          error
        )

        res.status(500).json({
          error:
            'Could not refresh presence'
        })
      }
    }
  )

  return service
}

module.exports = {
  createPresenceService,
  registerPresenceRoutes
}
