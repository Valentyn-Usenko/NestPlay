/* global require, process */

require('dotenv').config()

const pool = require('../db')

const {
  createAchievementService
} = require('../achievements')

const service =
  createAchievementService(pool)

async function tableExists(
  client,
  tableName
) {
  const result =
    await client.query(
      `
      SELECT to_regclass($1) AS table_name
      `,
      [`public.${tableName}`]
    )

  return Boolean(
    result.rows[0]
      ?.table_name
  )
}

async function rebuildStats() {
  const client =
    await pool.connect()

  try {
    console.log(
      'Syncing achievement definitions...'
    )

    await service.syncDefinitions(
      client
    )

    console.log(
      'Rebuilding achievement counters...'
    )

    await client.query('BEGIN')

    await client.query(
      `
      INSERT INTO user_achievement_stats (
        user_id
      )
      SELECT id
      FROM profiles
      ON CONFLICT (user_id)
      DO NOTHING
      `
    )

    await client.query(
      `
      UPDATE user_achievement_stats
      SET
        total_posts = 0,
        accepted_friend_count = 0,
        joined_hub_count = 0,
        total_upvotes_received = 0,
        total_comments = 0,
        updated_at = NOW()
      `
    )

    await client.query(
      `
      UPDATE user_achievement_stats stats
      SET
        total_posts = source.count,
        updated_at = NOW()
      FROM (
        SELECT
          user_id,
          COUNT(*)::bigint AS count
        FROM posts
        WHERE user_id IS NOT NULL
        GROUP BY user_id
      ) source
      WHERE stats.user_id = source.user_id
      `
    )

    await client.query(
      `
      UPDATE user_achievement_stats stats
      SET
        accepted_friend_count = source.count,
        updated_at = NOW()
      FROM (
        SELECT
          user_id,
          COUNT(*)::bigint AS count
        FROM (
          SELECT sender_id AS user_id
          FROM friend_requests
          WHERE status = 'accepted'

          UNION ALL

          SELECT receiver_id AS user_id
          FROM friend_requests
          WHERE status = 'accepted'
        ) accepted
        GROUP BY user_id
      ) source
      WHERE stats.user_id = source.user_id
      `
    )

    await client.query(
      `
      UPDATE user_achievement_stats stats
      SET
        total_upvotes_received = source.count,
        updated_at = NOW()
      FROM (
        SELECT
          p.user_id,
          COUNT(*)::bigint AS count
        FROM votes v
        JOIN posts p
          ON p.id = v.post_id
        WHERE
          v.vote_type = 'up'
          AND p.user_id IS NOT NULL
          AND v.user_id IS DISTINCT FROM p.user_id
        GROUP BY p.user_id
      ) source
      WHERE stats.user_id = source.user_id
      `
    )

    await client.query(
      `
      UPDATE user_achievement_stats stats
      SET
        total_comments = source.count,
        updated_at = NOW()
      FROM (
        SELECT
          user_id,
          COUNT(*)::bigint AS count
        FROM comments
        WHERE user_id IS NOT NULL
        GROUP BY user_id
      ) source
      WHERE stats.user_id = source.user_id
      `
    )

    await client.query(
      `
      DELETE FROM post_achievement_stats
      `
    )

    await client.query(
      `
      INSERT INTO post_achievement_stats (
        post_id,
        owner_user_id,
        reply_count,
        updated_at
      )
      SELECT
        p.id::text,
        p.user_id,
        COUNT(c.id) FILTER (
          WHERE
            c.user_id IS NOT NULL
            AND c.user_id IS DISTINCT FROM p.user_id
        )::bigint,
        NOW()
      FROM posts p
      LEFT JOIN comments c
        ON c.post_id = p.id
      WHERE p.user_id IS NOT NULL
      GROUP BY
        p.id,
        p.user_id
      ON CONFLICT (post_id)
      DO UPDATE SET
        owner_user_id = EXCLUDED.owner_user_id,
        reply_count = EXCLUDED.reply_count,
        updated_at = NOW()
      `
    )

    const hasGameHubMembers =
      await tableExists(
        client,
        'game_hub_members'
      )

    if (hasGameHubMembers) {
      console.log(
        'Backfilling current Game Hub memberships...'
      )

      await client.query(
        `
        INSERT INTO achievement_hub_history (
          user_id,
          game_id,
          game_name,
          game_art_url,
          first_joined_at
        )
        SELECT
          user_id,
          game_id::text,
          game_name,
          game_art_url,
          COALESCE(
            joined_at,
            NOW()
          )
        FROM game_hub_members
        ON CONFLICT (
          user_id,
          game_id
        )
        DO UPDATE SET
          game_name = COALESCE(
            EXCLUDED.game_name,
            achievement_hub_history.game_name
          ),
          game_art_url = COALESCE(
            EXCLUDED.game_art_url,
            achievement_hub_history.game_art_url
          ),
          first_joined_at = LEAST(
            achievement_hub_history.first_joined_at,
            EXCLUDED.first_joined_at
          )
        `
      )
    } else {
      console.log(
        'game_hub_members does not exist; Game Hub backfill skipped.'
      )
    }

    await client.query(
      `
      UPDATE user_achievement_stats stats
      SET
        joined_hub_count = source.count,
        updated_at = NOW()
      FROM (
        SELECT
          user_id,
          COUNT(*)::bigint AS count
        FROM achievement_hub_history
        GROUP BY user_id
      ) source
      WHERE stats.user_id = source.user_id
      `
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
}

async function evaluateExistingUsers() {
  let offset = 0
  const batchSize = 100
  let totalEvaluated = 0

  for (;;) {
    const result =
      await pool.query(
        `
        SELECT id
        FROM profiles
        ORDER BY created_at ASC, id ASC
        LIMIT $1
        OFFSET $2
        `,
        [
          batchSize,
          offset
        ]
      )

    if (result.rows.length === 0) {
      break
    }

    for (const row of result.rows) {
      await service.evaluateUser(
        pool,
        row.id
      )

      totalEvaluated += 1
    }

    console.log(
      `Evaluated ${totalEvaluated} profiles...`
    )

    offset +=
      result.rows.length
  }
}

async function main() {
  try {
    await rebuildStats()
    await evaluateExistingUsers()

    console.log(
      'Achievement backfill complete.'
    )
  } catch (error) {
    console.error(
      'Achievement backfill failed:',
      error
    )

    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
