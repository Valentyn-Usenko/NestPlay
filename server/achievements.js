const {
  ACHIEVEMENT_DEFINITIONS
} = require('./achievementDefinitions')

const DAY_MS =
  24 * 60 * 60 * 1000

function createAchievementService(pool) {
  async function syncDefinitions(
    db = pool,
    definitions = ACHIEVEMENT_DEFINITIONS
  ) {
    for (const definition of definitions) {
      await db.query(
        `
        INSERT INTO achievement_definitions (
          slug,
          name,
          description,
          category,
          rarity,
          icon,
          requirement_type,
          requirement_value,
          hidden,
          manual_only,
          auto_evaluable,
          game_id,
          hub_id,
          is_active,
          metadata,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15::jsonb,
          NOW()
        )
        ON CONFLICT (slug)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          rarity = EXCLUDED.rarity,
          icon = EXCLUDED.icon,
          requirement_type = EXCLUDED.requirement_type,
          requirement_value = EXCLUDED.requirement_value,
          hidden = EXCLUDED.hidden,
          manual_only = EXCLUDED.manual_only,
          auto_evaluable = EXCLUDED.auto_evaluable,
          game_id = EXCLUDED.game_id,
          hub_id = EXCLUDED.hub_id,
          is_active = EXCLUDED.is_active,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        `,
        [
          definition.slug,
          definition.name,
          definition.description,
          definition.category,
          definition.rarity,
          definition.icon,
          definition.requirementType,
          definition.requirementValue,
          Boolean(definition.hidden),
          Boolean(definition.manualOnly),
          Boolean(definition.autoEvaluable),
          definition.gameId == null
            ? null
            : String(definition.gameId),
          definition.hubId == null
            ? null
            : String(definition.hubId),
          definition.active !== false,
          JSON.stringify(
            definition.metadata || {}
          )
        ]
      )
    }
  }

  async function ensureStatsRow(
    db,
    userId
  ) {
    await db.query(
      `
      INSERT INTO user_achievement_stats (
        user_id
      )
      VALUES ($1)
      ON CONFLICT (user_id)
      DO NOTHING
      `,
      [userId]
    )
  }

  async function getDefinition(
    db,
    slug
  ) {
    let result =
      await db.query(
        `
        SELECT *
        FROM achievement_definitions
        WHERE slug = $1
        LIMIT 1
        `,
        [slug]
      )

    if (result.rows.length === 0) {
      await syncDefinitions(db)

      result =
        await db.query(
          `
          SELECT *
          FROM achievement_definitions
          WHERE slug = $1
          LIMIT 1
          `,
          [slug]
        )
    }

    return result.rows[0] || null
  }

  async function upsertProgress(
    db,
    userId,
    slug,
    currentValue,
    targetValue,
    mode = 'set'
  ) {
    const definition =
      await getDefinition(
        db,
        slug
      )

    if (!definition) {
      return null
    }

    const safeCurrent =
      Math.max(
        0,
        Number(currentValue) || 0
      )

    const safeTarget =
      targetValue == null
        ? null
        : Math.max(
            1,
            Number(targetValue) || 1
          )

    const updateExpression =
      mode === 'max'
        ? 'GREATEST(achievement_progress.current_value, EXCLUDED.current_value)'
        : 'EXCLUDED.current_value'

    const result =
      await db.query(
        `
        INSERT INTO achievement_progress (
          user_id,
          achievement_id,
          current_value,
          target_value,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          NOW()
        )
        ON CONFLICT (
          user_id,
          achievement_id
        )
        DO UPDATE SET
          current_value = ${updateExpression},
          target_value = EXCLUDED.target_value,
          updated_at = NOW()
        RETURNING *
        `,
        [
          userId,
          definition.id,
          safeCurrent,
          safeTarget
        ]
      )

    return result.rows[0] || null
  }

  async function awardAchievement(
    db,
    userId,
    slug,
    context = {}
  ) {
    const definition =
      await getDefinition(
        db,
        slug
      )

    if (
      !definition ||
      !definition.is_active
    ) {
      return null
    }

    const inserted =
      await db.query(
        `
        INSERT INTO user_achievements (
          user_id,
          achievement_id,
          context
        )
        VALUES (
          $1,
          $2,
          $3::jsonb
        )
        ON CONFLICT (
          user_id,
          achievement_id
        )
        DO NOTHING
        RETURNING
          user_id,
          achievement_id,
          unlocked_at,
          context
        `,
        [
          userId,
          definition.id,
          JSON.stringify(context || {})
        ]
      )

    if (inserted.rows.length === 0) {
      return null
    }

    await db.query(
      `
      INSERT INTO achievement_notifications (
        user_id,
        achievement_id
      )
      VALUES ($1, $2)
      ON CONFLICT (
        user_id,
        achievement_id
      )
      DO NOTHING
      `,
      [
        userId,
        definition.id
      ]
    )

    return {
      ...definition,
      unlockedAt:
        inserted.rows[0]
          .unlocked_at
    }
  }

  async function evaluateThreshold(
    db,
    userId,
    slug,
    currentValue,
    targetValue,
    context = {},
    progressMode = 'set'
  ) {
    await upsertProgress(
      db,
      userId,
      slug,
      currentValue,
      targetValue,
      progressMode
    )

    if (
      Number(currentValue) >=
      Number(targetValue)
    ) {
      return awardAchievement(
        db,
        userId,
        slug,
        context
      )
    }

    return null
  }

  async function evaluateStatsAchievements(
    db,
    userId
  ) {
    await ensureStatsRow(
      db,
      userId
    )

    const result =
      await db.query(
        `
        SELECT
          total_posts,
          accepted_friend_count,
          joined_hub_count,
          total_upvotes_received,
          total_comments
        FROM user_achievement_stats
        WHERE user_id = $1
        `,
        [userId]
      )

    const stats =
      result.rows[0] || {}

    await evaluateThreshold(
      db,
      userId,
      'first-post',
      stats.total_posts || 0,
      1
    )

    await evaluateThreshold(
      db,
      userId,
      'first-friend',
      stats.accepted_friend_count || 0,
      1
    )

    await evaluateThreshold(
      db,
      userId,
      'party-up',
      stats.accepted_friend_count || 0,
      10
    )

    await evaluateThreshold(
      db,
      userId,
      'first-steps',
      stats.joined_hub_count || 0,
      1
    )

    await evaluateThreshold(
      db,
      userId,
      'hub-explorer',
      stats.joined_hub_count || 0,
      5
    )

    await evaluateThreshold(
      db,
      userId,
      'crowd-favorite',
      stats.total_upvotes_received || 0,
      100
    )

    await evaluateThreshold(
      db,
      userId,
      'fan-favorite',
      stats.total_upvotes_received || 0,
      1000
    )
  }

  async function evaluateConversationStarter(
    db,
    userId
  ) {
    const result =
      await db.query(
        `
        SELECT COALESCE(
          MAX(reply_count),
          0
        )::bigint AS max_replies
        FROM post_achievement_stats
        WHERE owner_user_id = $1
        `,
        [userId]
      )

    const maxReplies =
      Number(
        result.rows[0]
          ?.max_replies || 0
      )

    await evaluateThreshold(
      db,
      userId,
      'conversation-starter',
      maxReplies,
      10,
      {},
      'set'
    )
  }

  async function evaluateTimeAchievements(
    db,
    userId
  ) {
    const result =
      await db.query(
        `
        SELECT
          username,
          created_at
        FROM profiles
        WHERE id = $1
        LIMIT 1
        `,
        [userId]
      )

    const profile =
      result.rows[0]

    if (!profile) {
      return
    }

    const profileReady =
      Boolean(
        String(
          profile.username || ''
        ).trim()
      )

    await upsertProgress(
      db,
      userId,
      'welcome-to-nestplay',
      profileReady ? 1 : 0,
      1
    )

    if (profileReady) {
      await awardAchievement(
        db,
        userId,
        'welcome-to-nestplay'
      )
    }

    if (!profile.created_at) {
      return
    }

    const createdAt =
      new Date(
        profile.created_at
      )

    const ageDays =
      Math.max(
        0,
        Math.floor(
          (
            Date.now() -
            createdAt.getTime()
          ) /
          DAY_MS
        )
      )

    await evaluateThreshold(
      db,
      userId,
      'one-month-in',
      ageDays,
      30
    )

    await evaluateThreshold(
      db,
      userId,
      'one-year-club',
      ageDays,
      365
    )
  }

  async function evaluateUser(
    db,
    userId
  ) {
    await Promise.all([
      evaluateStatsAchievements(
        db,
        userId
      ),
      evaluateConversationStarter(
        db,
        userId
      ),
      evaluateTimeAchievements(
        db,
        userId
      )
    ])
  }

  async function recordProfileReady(
    db,
    userId
  ) {
    await ensureStatsRow(
      db,
      userId
    )

    await evaluateTimeAchievements(
      db,
      userId
    )
  }

  async function recordPostCreated(
    db,
    userId
  ) {
    await ensureStatsRow(
      db,
      userId
    )

    await db.query(
      `
      UPDATE user_achievement_stats
      SET
        total_posts = total_posts + 1,
        updated_at = NOW()
      WHERE user_id = $1
      `,
      [userId]
    )

    await evaluateStatsAchievements(
      db,
      userId
    )
  }

  async function syncFriendCount(
    db,
    userId
  ) {
    await ensureStatsRow(
      db,
      userId
    )

    const countResult =
      await db.query(
        `
        SELECT COUNT(*)::bigint AS count
        FROM friend_requests
        WHERE
          status = 'accepted'
          AND (
            sender_id = $1
            OR receiver_id = $1
          )
        `,
        [userId]
      )

    await db.query(
      `
      UPDATE user_achievement_stats
      SET
        accepted_friend_count = $2,
        updated_at = NOW()
      WHERE user_id = $1
      `,
      [
        userId,
        Number(
          countResult.rows[0]
            ?.count || 0
        )
      ]
    )

    await evaluateStatsAchievements(
      db,
      userId
    )
  }

  async function recordFriendshipAccepted(
    db,
    senderId,
    receiverId
  ) {
    await syncFriendCount(
      db,
      senderId
    )

    await syncFriendCount(
      db,
      receiverId
    )
  }

  async function recordFriendshipRemoved(
    db,
    senderId,
    receiverId
  ) {
    await syncFriendCount(
      db,
      senderId
    )

    await syncFriendCount(
      db,
      receiverId
    )
  }

  async function recordHubJoined(
    db,
    {
      userId,
      gameId,
      gameName = null,
      gameArtUrl = null
    }
  ) {
    if (
      !userId ||
      gameId == null
    ) {
      return
    }

    await ensureStatsRow(
      db,
      userId
    )

    await db.query(
      `
      INSERT INTO achievement_hub_history (
        user_id,
        game_id,
        game_name,
        game_art_url
      )
      VALUES (
        $1,
        $2,
        $3,
        $4
      )
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
        )
      `,
      [
        userId,
        String(gameId),
        gameName,
        gameArtUrl
      ]
    )

    const countResult =
      await db.query(
        `
        SELECT COUNT(*)::bigint AS count
        FROM achievement_hub_history
        WHERE user_id = $1
        `,
        [userId]
      )

    await db.query(
      `
      UPDATE user_achievement_stats
      SET
        joined_hub_count = $2,
        updated_at = NOW()
      WHERE user_id = $1
      `,
      [
        userId,
        Number(
          countResult.rows[0]
            ?.count || 0
        )
      ]
    )

    await evaluateStatsAchievements(
      db,
      userId
    )
  }

  async function recordVoteDelta(
    db,
    {
      ownerId,
      actorId,
      upvoteDelta
    }
  ) {
    if (
      !ownerId ||
      !actorId ||
      ownerId === actorId ||
      !upvoteDelta
    ) {
      return
    }

    await ensureStatsRow(
      db,
      ownerId
    )

    await db.query(
      `
      UPDATE user_achievement_stats
      SET
        total_upvotes_received =
          GREATEST(
            total_upvotes_received + $2,
            0
          ),
        updated_at = NOW()
      WHERE user_id = $1
      `,
      [
        ownerId,
        Number(upvoteDelta)
      ]
    )

    await evaluateStatsAchievements(
      db,
      ownerId
    )
  }

  async function recordCommentCreated(
    db,
    {
      postId,
      commenterId
    }
  ) {
    if (!postId || !commenterId) {
      return
    }

    await ensureStatsRow(
      db,
      commenterId
    )

    await db.query(
      `
      UPDATE user_achievement_stats
      SET
        total_comments = total_comments + 1,
        updated_at = NOW()
      WHERE user_id = $1
      `,
      [commenterId]
    )

    const postResult =
      await db.query(
        `
        SELECT user_id
        FROM posts
        WHERE id = $1
        LIMIT 1
        `,
        [postId]
      )

    const ownerId =
      postResult.rows[0]
        ?.user_id

    if (
      !ownerId ||
      ownerId === commenterId
    ) {
      return
    }

    const statResult =
      await db.query(
        `
        INSERT INTO post_achievement_stats (
          post_id,
          owner_user_id,
          reply_count,
          updated_at
        )
        VALUES (
          $1,
          $2,
          1,
          NOW()
        )
        ON CONFLICT (post_id)
        DO UPDATE SET
          owner_user_id = EXCLUDED.owner_user_id,
          reply_count = post_achievement_stats.reply_count + 1,
          updated_at = NOW()
        RETURNING reply_count
        `,
        [
          String(postId),
          ownerId
        ]
      )

    const replyCount =
      Number(
        statResult.rows[0]
          ?.reply_count || 0
      )

    await evaluateThreshold(
      db,
      ownerId,
      'conversation-starter',
      replyCount,
      10,
      {
        postId:
          String(postId)
      },
      'max'
    )
  }

  async function recordCommentDeleted(
    db,
    {
      postId,
      commenterId,
      postOwnerId
    }
  ) {
    if (commenterId) {
      await ensureStatsRow(
        db,
        commenterId
      )

      await db.query(
        `
        UPDATE user_achievement_stats
        SET
          total_comments = GREATEST(
            total_comments - 1,
            0
          ),
          updated_at = NOW()
        WHERE user_id = $1
        `,
        [commenterId]
      )
    }

    if (
      !postId ||
      !postOwnerId ||
      !commenterId ||
      commenterId === postOwnerId
    ) {
      return
    }

    await db.query(
      `
      UPDATE post_achievement_stats
      SET
        reply_count = GREATEST(
          reply_count - 1,
          0
        ),
        updated_at = NOW()
      WHERE post_id = $1
      `,
      [String(postId)]
    )

    await evaluateConversationStarter(
      db,
      postOwnerId
    )
  }

  async function getCollection(
    db,
    userId,
    viewerUserId = null
  ) {
    const profileResult =
      await db.query(
        `
        SELECT
          id,
          is_private
        FROM profiles
        WHERE id = $1
        LIMIT 1
        `,
        [userId]
      )

    if (profileResult.rows.length === 0) {
      const error =
        new Error(
          'Profile not found'
        )

      error.statusCode = 404
      throw error
    }

    const isOwner =
      viewerUserId === userId

    const isPrivate =
      Boolean(
        profileResult.rows[0]
          .is_private
      )

    if (
      isPrivate &&
      !isOwner
    ) {
      return {
        private: true,
        totalUnlocked: 0,
        featured: [],
        achievements: []
      }
    }

    if (isOwner) {
      await evaluateUser(
        db,
        userId
      )
    }

    const [
      definitionsResult,
      unlockedResult,
      progressResult,
      featuredResult
    ] = await Promise.all([
      db.query(
        `
        SELECT *
        FROM achievement_definitions
        WHERE is_active = TRUE
        ORDER BY
          category ASC,
          id ASC
        `
      ),
      db.query(
        `
        SELECT
          ua.achievement_id,
          ua.unlocked_at,
          ua.context
        FROM user_achievements ua
        WHERE ua.user_id = $1
        `,
        [userId]
      ),
      db.query(
        `
        SELECT
          achievement_id,
          current_value,
          target_value
        FROM achievement_progress
        WHERE user_id = $1
        `,
        [userId]
      ),
      db.query(
        `
        SELECT
          achievement_id,
          display_order
        FROM featured_achievements
        WHERE user_id = $1
        ORDER BY display_order ASC
        `,
        [userId]
      )
    ])

    const unlockedMap =
      new Map(
        unlockedResult.rows.map(
          row => [
            String(
              row.achievement_id
            ),
            row
          ]
        )
      )

    const progressMap =
      new Map(
        progressResult.rows.map(
          row => [
            String(
              row.achievement_id
            ),
            row
          ]
        )
      )

    const featuredOrderMap =
      new Map(
        featuredResult.rows.map(
          row => [
            String(
              row.achievement_id
            ),
            Number(
              row.display_order
            )
          ]
        )
      )

    const achievements =
      definitionsResult.rows.map(
        definition => {
          const key =
            String(
              definition.id
            )

          const unlocked =
            unlockedMap.get(key)

          const progress =
            progressMap.get(key)

          const featuredOrder =
            featuredOrderMap.get(key) ||
            null

          const lockedHidden =
            definition.hidden &&
            !unlocked

          if (lockedHidden) {
            return {
              id:
                definition.id,
              slug:
                definition.slug,
              name:
                'Hidden Achievement',
              description:
                'Keep exploring NestPlay to discover this achievement.',
              category:
                definition.category,
              rarity:
                null,
              icon:
                '?',
              hidden: true,
              locked: true,
              unlocked: false,
              unlockedAt: null,
              currentValue: null,
              targetValue: null,
              featuredOrder: null,
              gameId: null,
              hubId: null,
              metadata: {}
            }
          }

          return {
            id:
              definition.id,
            slug:
              definition.slug,
            name:
              definition.name,
            description:
              definition.description,
            category:
              definition.category,
            rarity:
              definition.rarity,
            icon:
              definition.icon,
            hidden:
              Boolean(
                definition.hidden
              ),
            manualOnly:
              Boolean(
                definition.manual_only
              ),
            autoEvaluable:
              Boolean(
                definition.auto_evaluable
              ),
            unlocked:
              Boolean(unlocked),
            locked:
              !unlocked,
            unlockedAt:
              unlocked
                ?.unlocked_at ||
              null,
            currentValue:
              progress == null
                ? null
                : Number(
                    progress.current_value
                  ),
            targetValue:
              progress
                ?.target_value == null
                ? definition.requirement_value == null
                  ? null
                  : Number(
                      definition.requirement_value
                    )
                : Number(
                    progress.target_value
                  ),
            featuredOrder,
            gameId:
              definition.game_id,
            hubId:
              definition.hub_id,
            metadata:
              definition.metadata || {},
            context:
              unlocked
                ?.context ||
              {}
          }
        }
      )

    const featured =
      achievements
        .filter(
          achievement =>
            achievement.unlocked &&
            achievement.featuredOrder
        )
        .sort(
          (a, b) =>
            a.featuredOrder -
            b.featuredOrder
        )

    return {
      private: false,
      totalUnlocked:
        unlockedResult.rows.length,
      featured,
      achievements
    }
  }

  async function setFeatured(
    db,
    userId,
    achievementIds
  ) {
    if (!Array.isArray(achievementIds)) {
      const error =
        new Error(
          'achievementIds must be an array'
        )

      error.statusCode = 400
      throw error
    }

    if (achievementIds.length > 3) {
      const error =
        new Error(
          'You can feature at most 3 achievements'
        )

      error.statusCode = 400
      throw error
    }

    const normalized =
      achievementIds.map(
        value => String(value)
      )

    if (
      new Set(normalized).size !==
      normalized.length
    ) {
      const error =
        new Error(
          'Featured achievements must be unique'
        )

      error.statusCode = 400
      throw error
    }

    if (normalized.length > 0) {
      const unlockedResult =
        await db.query(
          `
          SELECT achievement_id::text AS achievement_id
          FROM user_achievements
          WHERE
            user_id = $1
            AND achievement_id::text = ANY($2::text[])
          `,
          [
            userId,
            normalized
          ]
        )

      if (
        unlockedResult.rows.length !==
        normalized.length
      ) {
        const error =
          new Error(
            'Only unlocked achievements can be featured'
          )

        error.statusCode = 400
        throw error
      }
    }

    await db.query(
      `
      DELETE FROM featured_achievements
      WHERE user_id = $1
      `,
      [userId]
    )

    for (
      let index = 0;
      index < normalized.length;
      index += 1
    ) {
      await db.query(
        `
        INSERT INTO featured_achievements (
          user_id,
          achievement_id,
          display_order
        )
        VALUES (
          $1,
          $2::bigint,
          $3
        )
        `,
        [
          userId,
          normalized[index],
          index + 1
        ]
      )
    }
  }

  async function getPendingToasts(
    db,
    userId
  ) {
    const result =
      await db.query(
        `
        SELECT
          n.id,
          n.created_at,
          d.id AS achievement_id,
          d.slug,
          d.name,
          d.description,
          d.rarity,
          d.icon,
          d.game_id,
          d.hub_id,
          d.metadata
        FROM achievement_notifications n
        JOIN achievement_definitions d
          ON d.id = n.achievement_id
        WHERE
          n.user_id = $1
          AND n.delivered_at IS NULL
        ORDER BY n.created_at ASC
        LIMIT 5
        `,
        [userId]
      )

    return result.rows.map(
      row => ({
        id: row.id,
        createdAt:
          row.created_at,
        achievementId:
          row.achievement_id,
        slug:
          row.slug,
        name:
          row.name,
        description:
          row.description,
        rarity:
          row.rarity,
        icon:
          row.icon,
        gameId:
          row.game_id,
        hubId:
          row.hub_id,
        metadata:
          row.metadata || {}
      })
    )
  }

  async function markToastDelivered(
    db,
    userId,
    notificationId
  ) {
    const result =
      await db.query(
        `
        UPDATE achievement_notifications
        SET delivered_at = NOW()
        WHERE
          id = $1
          AND user_id = $2
        RETURNING id
        `,
        [
          notificationId,
          userId
        ]
      )

    return result.rows.length > 0
  }

  return {
    syncDefinitions,
    awardAchievement,
    evaluateUser,
    recordProfileReady,
    recordPostCreated,
    recordFriendshipAccepted,
    recordFriendshipRemoved,
    recordHubJoined,
    recordVoteDelta,
    recordCommentCreated,
    recordCommentDeleted,
    getCollection,
    setFeatured,
    getPendingToasts,
    markToastDelivered
  }
}

function registerAchievementRoutes({
  app,
  pool,
  requireAuth,
  optionalAuth,
  service
}) {
  app.get(
    '/api/achievements/users/:userId',
    optionalAuth,
    async (
      req,
      res
    ) => {
      try {
        const collection =
          await service.getCollection(
            pool,
            req.params.userId,
            req.user?.id || null
          )

        res.json(collection)
      } catch (error) {
        console.error(
          'Get achievements error:',
          error
        )

        res
          .status(
            error.statusCode || 500
          )
          .json({
            error:
              error.message ||
              'Could not load achievements'
          })
      }
    }
  )

  app.patch(
    '/api/achievements/featured',
    requireAuth,
    async (
      req,
      res
    ) => {
      const client =
        await pool.connect()

      try {
        await client.query('BEGIN')

        await service.setFeatured(
          client,
          req.user.id,
          req.body
            ?.achievementIds || []
        )

        await client.query('COMMIT')

        const collection =
          await service.getCollection(
            pool,
            req.user.id,
            req.user.id
          )

        res.json(collection)
      } catch (error) {
        try {
          await client.query(
            'ROLLBACK'
          )
        } catch {
          // Nothing else to do.
        }

        console.error(
          'Update featured achievements error:',
          error
        )

        res
          .status(
            error.statusCode || 500
          )
          .json({
            error:
              error.message ||
              'Could not update featured achievements'
          })
      } finally {
        client.release()
      }
    }
  )

  app.get(
    '/api/achievements/toasts',
    requireAuth,
    async (
      req,
      res
    ) => {
      try {
        const toasts =
          await service.getPendingToasts(
            pool,
            req.user.id
          )

        res.json(toasts)
      } catch (error) {
        console.error(
          'Get achievement toasts error:',
          error
        )

        res
          .status(500)
          .json({
            error:
              error.message
          })
      }
    }
  )

  app.patch(
    '/api/achievements/toasts/:id/delivered',
    requireAuth,
    async (
      req,
      res
    ) => {
      try {
        const updated =
          await service.markToastDelivered(
            pool,
            req.user.id,
            req.params.id
          )

        if (!updated) {
          return res
            .status(404)
            .json({
              error:
                'Achievement notification not found'
            })
        }

        res.json({
          success: true
        })
      } catch (error) {
        console.error(
          'Mark achievement toast delivered error:',
          error
        )

        res
          .status(500)
          .json({
            error:
              error.message
          })
      }
    }
  )
}

module.exports = {
  createAchievementService,
  registerAchievementRoutes
}
