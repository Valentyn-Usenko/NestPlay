/* global require, process */

require('dotenv').config()

const express = require('express')
const cors = require('cors')
const multer = require('multer')

const {
  randomUUID
} = require('crypto')

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} = require('@aws-sdk/client-s3')

const {
  getSignedUrl
} = require('@aws-sdk/s3-request-presigner')

const pool = require('./db')

const {
  verifyAuthToken
} = require('./auth')

const {
  createAchievementService,
  registerAchievementRoutes
} = require('./achievements')

const {
  registerPresenceRoutes
} = require('./presence')

const app = express()

const PORT =
  process.env.PORT || 3001


// ==================================================
// MIDDLEWARE
// ==================================================

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL
  })
)

app.use(express.json())


// ==================================================
// AMAZON S3
// ==================================================

const s3 = new S3Client({
  region:
    process.env.AWS_REGION
})


// ==================================================
// AVATAR UPLOAD CONFIG
// ==================================================

const avatarUpload = multer({
  storage:
    multer.memoryStorage(),

  limits: {
    fileSize:
      5 * 1024 * 1024
  },

  fileFilter: (
    req,
    file,
    cb
  ) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/avif',
      'image/heic',
      'image/heif',
      'image/bmp'
    ]

    if (
      !allowedTypes.includes(
        file.mimetype
      )
    ) {
      return cb(
        new Error(
          'Unsupported image type'
        )
      )
    }

    cb(
      null,
      true
    )
  }
})


// ==================================================
// AUTH HELPERS
// ==================================================

function getBearerToken(req) {
  const header =
    req.headers.authorization

  if (!header) {
    return null
  }

  if (
    !header.startsWith(
      'Bearer '
    )
  ) {
    return null
  }

  return header.slice(7)
}


async function requireAuth(
  req,
  res,
  next
) {
  try {
    const token =
      getBearerToken(req)

    if (!token) {
      return res
        .status(401)
        .json({
          error:
            'Authentication required'
        })
    }

    const user =
      await verifyAuthToken(
        token
      )

    if (!user) {
      return res
        .status(401)
        .json({
          error:
            'Invalid authentication token'
        })
    }

    if (
      user.provider ===
        'cognito' &&
      user.mapped === false
    ) {
      return res
        .status(403)
        .json({
          error:
            'Cognito account is not linked to a NestPlay profile'
        })
    }

    req.user =
      user

    next()
  } catch (error) {
    console.error(
      'Authentication error:',
      error
    )

    res
      .status(401)
      .json({
        error:
          'Authentication failed'
      })
  }
}


async function optionalAuth(
  req,
  res,
  next
) {
  try {
    const token =
      getBearerToken(req)

    if (!token) {
      req.user =
        null

      return next()
    }

    const user =
      await verifyAuthToken(
        token
      )

    if (!user) {
      return res
        .status(401)
        .json({
          error:
            'Invalid authentication token'
        })
    }

    if (
      user.provider ===
        'cognito' &&
      user.mapped === false
    ) {
      return res
        .status(403)
        .json({
          error:
            'Cognito account is not linked to a NestPlay profile'
        })
    }

    req.user =
      user

    next()
  } catch (error) {
    console.error(
      'Optional authentication error:',
      error
    )

    res
      .status(401)
      .json({
        error:
          'Authentication failed'
      })
  }
}

const achievementService =
  createAchievementService(pool)

registerAchievementRoutes({
  app,
  pool,
  requireAuth,
  optionalAuth,
  service:
    achievementService
})

const presenceService =
  registerPresenceRoutes({
    app,
    pool,
    requireAuth,
    signProfile:
      addSignedAvatarUrl
  })

achievementService
  .syncDefinitions()
  .catch(error => {
    console.error(
      'Achievement definition sync failed:',
      error
    )
  })

// ==================================================
// COGNITO NEW USER BOOTSTRAP
//
// Creates a normal NestPlay profile UUID and
// links it to the authenticated Cognito account.
// ==================================================

app.post(
  '/api/auth/cognito/bootstrap',
  async (
    req,
    res
  ) => {
    const client =
      await pool.connect()

    try {
      const token =
        getBearerToken(req)

      if (!token) {
        return res
          .status(401)
          .json({
            error:
              'Authentication required'
          })
      }

      const user =
        await verifyAuthToken(
          token
        )

      if (
        !user ||
        user.provider !==
          'cognito'
      ) {
        return res
          .status(401)
          .json({
            error:
              'Valid Cognito authentication required'
          })
      }

      if (
        user.mapped === true
      ) {
        const existing =
          await pool.query(
            `
            SELECT *
            FROM profiles
            WHERE id = $1
            LIMIT 1
            `,
            [user.id]
          )

        return res.json(
          existing.rows[0]
        )
      }

      const username =
        req.body?.username
          ?.trim()

      if (
        !username ||
        username.length < 3
      ) {
        return res
          .status(400)
          .json({
            error:
              'Username must be at least 3 characters'
          })
      }

      const duplicate =
        await pool.query(
          `
          SELECT id
          FROM profiles
          WHERE LOWER(username) =
                LOWER($1)
          LIMIT 1
          `,
          [username]
        )

      if (
        duplicate.rows.length >
        0
      ) {
        return res
          .status(409)
          .json({
            error:
              'Username is already taken'
          })
      }

      const profileId =
        randomUUID()

      await client.query(
        'BEGIN'
      )

      await client.query(
        `
        INSERT INTO profiles (
          id,
          username
        )
        VALUES (
          $1,
          $2
        )
        `,
        [
          profileId,
          username
        ]
      )

      await client.query(
        `
        INSERT INTO auth_identities (
          provider,
          provider_user_id,
          user_id
        )
        VALUES (
          'cognito',
          $1,
          $2
        )
        `,
        [
          user.cognitoSub,
          profileId
        ]
      )

      await client.query(
        'COMMIT'
      )

      const result =
        await pool.query(
          `
          SELECT *
          FROM profiles
          WHERE id = $1
          LIMIT 1
          `,
          [profileId]
        )

      res
        .status(201)
        .json(
          result.rows[0]
        )
    } catch (error) {
      try {
        await client.query(
          'ROLLBACK'
        )
      } catch {
        // Nothing else to do.
      }

      console.error(
        'Cognito bootstrap error:',
        error
      )

      res
        .status(500)
        .json({
          error:
            'Could not create Cognito profile'
        })
    } finally {
      client.release()
    }
  }
)


// ==================================================
// PROFILE HELPERS
// ==================================================

async function ensureProfile(
  user
) {
  const username =
    user.user_metadata?.username ||
    user.email ||
    'Anonymous'

  await pool.query(
    `
    INSERT INTO profiles (
      id,
      email,
      username
    )

    VALUES (
      $1,
      $2,
      $3
    )

    ON CONFLICT (id)
    DO NOTHING
    `,
    [
      user.id,
      user.email || null,
      username
    ]
  )
}


async function getUsername(
  user
) {
  await ensureProfile(user)

  const result =
    await pool.query(
      `
      SELECT username
      FROM profiles
      WHERE id = $1
      `,
      [
        user.id
      ]
    )

  return (
    result.rows[0]?.username ||
    user.user_metadata?.username ||
    user.email ||
    'Anonymous'
  )
}


// ==================================================
// S3 AVATAR HELPERS
// ==================================================

async function addSignedAvatarUrl(
  profile
) {
  if (!profile) {
    return profile
  }

  if (
    !profile.avatar_url ||
    !profile.avatar_url.startsWith(
      's3:'
    )
  ) {
    return profile
  }

  const key =
    profile.avatar_url.slice(3)

  const signedUrl =
    await getSignedUrl(
      s3,

      new GetObjectCommand({
        Bucket:
          process.env.S3_BUCKET_NAME,

        Key:
          key
      }),

      {
        expiresIn: 3600
      }
    )

  return {
    ...profile,
    avatar_url:
      signedUrl
  }
}


async function addSignedAvatarUrls(
  profiles
) {
  return Promise.all(
    profiles.map(
      profile =>
        addSignedAvatarUrl(
          profile
        )
    )
  )
}


// ==================================================
// FRIENDSHIP HELPER
// ==================================================

async function areFriends(
  userId,
  otherUserId
) {
  const result =
    await pool.query(
      `
      SELECT id

      FROM friend_requests

      WHERE status = 'accepted'

      AND (
        (
          sender_id = $1
          AND receiver_id = $2
        )

        OR

        (
          sender_id = $2
          AND receiver_id = $1
        )
      )

      LIMIT 1
      `,
      [
        userId,
        otherUserId
      ]
    )

  return (
    result.rows.length > 0
  )
}


// ==================================================
// HEALTH
// ==================================================

app.get(
  '/api/health',
  async (
    req,
    res
  ) => {
    try {
      const result =
        await pool.query(
          'SELECT NOW() AS time'
        )

      res.json({
        success: true,
        database:
          'connected',
        time:
          result.rows[0].time
      })
    } catch (error) {
      console.error(
        'Database health error:',
        error
      )

      res
        .status(500)
        .json({
          success: false,
          database:
            'disconnected',
          error:
            error.message
        })
    }
  }
)


// ==================================================
// AUTH TEST
// ==================================================

app.get(
  '/api/auth-check',
  requireAuth,
  (
    req,
    res
  ) => {
    res.json({
      success: true,

      user: {
        id:
          req.user.id,

        email:
          req.user.email
      }
    })
  }
)


// ==================================================
// POSTS
// ==================================================


// --------------------------------------------------
// GET POSTS
// --------------------------------------------------

app.get(
  '/api/posts',
  optionalAuth,
  async (
    req,
    res
  ) => {
    try {
      const userId =
        req.user?.id || null

      const search =
        req.query.search
          ? String(
              req.query.search
            ).trim()
          : ''

      const result =
        await pool.query(
          `
          SELECT
            p.*,

            COALESCE(
              (
                SELECT COUNT(*)::int

                FROM votes v

                WHERE
                  v.post_id = p.id
                  AND v.vote_type = 'up'
              ),
              0
            ) AS "liveUpvotes",

            COALESCE(
              (
                SELECT COUNT(*)::int

                FROM votes v

                WHERE
                  v.post_id = p.id
                  AND v.vote_type = 'down'
              ),
              0
            ) AS "liveDownvotes",

            (
              SELECT v.vote_type

              FROM votes v

              WHERE
                v.post_id = p.id
                AND v.user_id = $1

              LIMIT 1
            ) AS "myVote"

          FROM posts p

          WHERE (
            $2 = ''
            OR p.game_name
              ILIKE '%' || $2 || '%'
          )

          ORDER BY
            p.created_at DESC
          `,
          [
            userId,
            search
          ]
        )

      res.json(
        result.rows
      )
    } catch (error) {
      console.error(
        'Get posts error:',
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


// --------------------------------------------------
// GET ONE POST
// --------------------------------------------------

app.get(
  '/api/posts/:id',
  optionalAuth,
  async (
    req,
    res
  ) => {
    try {
      const userId =
        req.user?.id || null

      const result =
        await pool.query(
          `
          SELECT
            p.*,

            COALESCE(
              (
                SELECT COUNT(*)::int

                FROM votes v

                WHERE
                  v.post_id = p.id
                  AND v.vote_type = 'up'
              ),
              0
            ) AS "liveUpvotes",

            COALESCE(
              (
                SELECT COUNT(*)::int

                FROM votes v

                WHERE
                  v.post_id = p.id
                  AND v.vote_type = 'down'
              ),
              0
            ) AS "liveDownvotes",

            (
              SELECT v.vote_type

              FROM votes v

              WHERE
                v.post_id = p.id
                AND v.user_id = $1

              LIMIT 1
            ) AS "myVote"

          FROM posts p

          WHERE p.id = $2
          `,
          [
            userId,
            req.params.id
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
              'Post not found'
          })
      }

      res.json(
        result.rows[0]
      )
    } catch (error) {
      console.error(
        'Get post error:',
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


// --------------------------------------------------
// CREATE POST
// --------------------------------------------------

app.post(
  '/api/posts',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const {
        title,
        content,
        game_id,
        game_name,
        game_art_url
      } = req.body

      if (
        !title ||
        !String(title).trim()
      ) {
        return res
          .status(400)
          .json({
            error:
              'Post title is required'
          })
      }

      const username =
        await getUsername(
          req.user
        )

      const result =
        await pool.query(
          `
          INSERT INTO posts (
            title,
            name,
            user_id,
            content,
            game_id,
            game_name,
            game_art_url
          )

          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
          )

          RETURNING *
          `,
          [
            String(
              title
            ).trim(),

            username,

            req.user.id,

            content || '',

            game_id || null,

            game_name || null,

            game_art_url ||
              null
          ]
        )
      try {
        await achievementService
          .recordPostCreated(
            pool,
            req.user.id
          )
      } catch (achievementError) {
        console.error(
          'Post achievement error:',
          achievementError
        )
      }


      res
        .status(201)
        .json({
          ...result.rows[0],

          liveUpvotes: 0,
          liveDownvotes: 0,
          myVote: null
        })
    } catch (error) {
      console.error(
        'Create post error:',
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


// --------------------------------------------------
// DELETE POST
// --------------------------------------------------

app.delete(
  '/api/posts/:id',
  requireAuth,
  async (
    req,
    res
  ) => {
    const client =
      await pool.connect()

    try {
      await client.query(
        'BEGIN'
      )

      const postResult =
        await client.query(
          `
          SELECT user_id

          FROM posts

          WHERE id = $1

          FOR UPDATE
          `,
          [
            req.params.id
          ]
        )

      if (
        postResult.rows.length ===
        0
      ) {
        await client.query(
          'ROLLBACK'
        )

        return res
          .status(404)
          .json({
            error:
              'Post not found'
          })
      }

      if (
        postResult.rows[0]
          .user_id !==
        req.user.id
      ) {
        await client.query(
          'ROLLBACK'
        )

        return res
          .status(403)
          .json({
            error:
              'You cannot delete this post'
          })
      }

      await client.query(
        `
        DELETE FROM votes
        WHERE post_id = $1
        `,
        [
          req.params.id
        ]
      )

      await client.query(
        `
        DELETE FROM notifications
        WHERE post_id = $1
        `,
        [
          req.params.id
        ]
      )

      await client.query(
        `
        DELETE FROM comments
        WHERE post_id = $1
        `,
        [
          req.params.id
        ]
      )

      await client.query(
        `
        DELETE FROM posts
        WHERE id = $1
        `,
        [
          req.params.id
        ]
      )

      await client.query(
        'COMMIT'
      )

      res.json({
        success: true
      })
    } catch (error) {
      await client.query(
        'ROLLBACK'
      )

      console.error(
        'Delete post error:',
        error
      )

      res
        .status(500)
        .json({
          error:
            error.message
        })
    } finally {
      client.release()
    }
  }
)

// ==================================================
// GAME HUB COMMUNITIES
// ==================================================


// --------------------------------------------------
// GET COMMUNITY STATUS
//
// Returns:
// - member count
// - whether current user joined
// --------------------------------------------------

app.get(
  '/api/game-hubs/:gameId',
  optionalAuth,
  async (
    req,
    res
  ) => {
    try {
      const gameId =
        String(
          req.params.gameId || ''
        ).trim()

      if (!gameId) {
        return res
          .status(400)
          .json({
            error:
              'Game ID is required'
          })
      }

      const countResult =
        await pool.query(
          `
          SELECT
            COUNT(*)::int AS count

          FROM game_hub_members

          WHERE game_id = $1
          `,
          [
            gameId
          ]
        )

      let joined = false

      if (req.user?.id) {
        const memberResult =
          await pool.query(
            `
            SELECT 1

            FROM game_hub_members

            WHERE
              user_id = $1
              AND game_id = $2

            LIMIT 1
            `,
            [
              req.user.id,
              gameId
            ]
          )

        joined =
          memberResult.rows.length >
          0
      }

      return res.json({
        gameId,

        memberCount:
          countResult.rows[0]
            ?.count || 0,

        joined
      })
    } catch (error) {
      console.error(
        'Get game hub error:',
        error
      )

      return res
        .status(500)
        .json({
          error:
            error.message
        })
    }
  }
)


// --------------------------------------------------
// JOIN COMMUNITY
// --------------------------------------------------

app.post(
  '/api/game-hubs/:gameId/join',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const gameId =
        String(
          req.params.gameId || ''
        ).trim()

      const gameName =
        String(
          req.body.game_name || ''
        ).trim()

      const gameArtUrl =
        req.body.game_art_url ||
        null

      if (!gameId) {
        return res
          .status(400)
          .json({
            error:
              'Game ID is required'
          })
      }

      if (!gameName) {
        return res
          .status(400)
          .json({
            error:
              'Game name is required'
          })
      }

      await ensureProfile(
        req.user
      )

      await pool.query(
        `
        INSERT INTO game_hub_members (
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
          game_name =
            EXCLUDED.game_name,

          game_art_url =
            COALESCE(
              EXCLUDED.game_art_url,
              game_hub_members.game_art_url
            )
        `,
        [
          req.user.id,
          gameId,
          gameName,
          gameArtUrl
        ]
      )

       try {
        await achievementService
          .recordHubJoined(
            pool,
            {
              userId: req.user.id,
              gameId,
              gameName,
              gameArtUrl
            }
          )
      } catch (achievementError) {
        console.error(
          'Game Hub achievement error:',
          achievementError
        )
      }

      const countResult =
        await pool.query(
          `
          SELECT
            COUNT(*)::int AS count

          FROM game_hub_members

          WHERE game_id = $1
          `,
          [
            gameId
          ]
        )

      return res.json({
        joined: true,

        memberCount:
          countResult.rows[0]
            ?.count || 0
      })
    } catch (error) {
      console.error(
        'Join game hub error:',
        error
      )

      return res
        .status(500)
        .json({
          error:
            error.message
        })
    }
  }
)


// --------------------------------------------------
// LEAVE COMMUNITY
// --------------------------------------------------

app.delete(
  '/api/game-hubs/:gameId/join',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const gameId =
        String(
          req.params.gameId || ''
        ).trim()

      if (!gameId) {
        return res
          .status(400)
          .json({
            error:
              'Game ID is required'
          })
      }

      await pool.query(
        `
        DELETE FROM game_hub_members

        WHERE
          user_id = $1
          AND game_id = $2
        `,
        [
          req.user.id,
          gameId
        ]
      )

      const countResult =
        await pool.query(
          `
          SELECT
            COUNT(*)::int AS count

          FROM game_hub_members

          WHERE game_id = $1
          `,
          [
            gameId
          ]
        )

      return res.json({
        joined: false,

        memberCount:
          countResult.rows[0]
            ?.count || 0
      })
    } catch (error) {
      console.error(
        'Leave game hub error:',
        error
      )

      return res
        .status(500)
        .json({
          error:
            error.message
        })
    }
  }
)

// ==================================================
// VOTES
// ==================================================

app.post(
  '/api/posts/:id/vote',
  requireAuth,
  async (
    req,
    res
  ) => {
    const voteType =
      req.body.vote_type

    if (
      voteType !== 'up' &&
      voteType !== 'down'
    ) {
      return res
        .status(400)
        .json({
          error:
            'vote_type must be up or down'
        })
    }

    const client =
      await pool.connect()

    try {
      await client.query(
        'BEGIN'
      )

      const postResult =
        await client.query(
          `
          SELECT user_id

          FROM posts

          WHERE id = $1

          FOR UPDATE
          `,
          [
            req.params.id
          ]
        )

      if (
        postResult.rows.length ===
        0
      ) {
        await client.query(
          'ROLLBACK'
        )

        return res
          .status(404)
          .json({
            error:
              'Post not found'
          })
      }

      const postOwnerId =
        postResult.rows[0]
          .user_id

      const voteResult =
        await client.query(
          `
          SELECT vote_type

          FROM votes

          WHERE
            user_id = $1
            AND post_id = $2

          LIMIT 1

          FOR UPDATE
          `,
          [
            req.user.id,
            req.params.id
          ]
        )

      const existingVote =
        voteResult.rows[0] ||
        null

      let newVote = null

      if (
        existingVote &&
        existingVote.vote_type ===
          voteType
      ) {
        await client.query(
          `
          DELETE FROM votes

          WHERE
            user_id = $1
            AND post_id = $2
          `,
          [
            req.user.id,
            req.params.id
          ]
        )
      } else if (
        existingVote
      ) {
        await client.query(
          `
          UPDATE votes

          SET vote_type = $3

          WHERE
            user_id = $1
            AND post_id = $2
          `,
          [
            req.user.id,
            req.params.id,
            voteType
          ]
        )

        newVote =
          voteType
      } else {
        await client.query(
          `
          INSERT INTO votes (
            user_id,
            post_id,
            vote_type
          )

          VALUES (
            $1,
            $2,
            $3
          )
          `,
          [
            req.user.id,
            req.params.id,
            voteType
          ]
        )

        newVote =
          voteType
      }

      const countsResult =
        await client.query(
          `
          SELECT
            COUNT(*) FILTER (
              WHERE vote_type = 'up'
            )::int AS upvotes,

            COUNT(*) FILTER (
              WHERE vote_type = 'down'
            )::int AS downvotes

          FROM votes

          WHERE post_id = $1
          `,
          [
            req.params.id
          ]
        )

      const upvotes =
        countsResult.rows[0]
          .upvotes

      const downvotes =
        countsResult.rows[0]
          .downvotes

      await client.query(
        `
        UPDATE posts

        SET
          upvotes = $2,
          downvotes = $3

        WHERE id = $1
        `,
        [
          req.params.id,
          upvotes,
          downvotes
        ]
      )

      const shouldNotify =
        voteType === 'up' &&
        existingVote?.vote_type !==
          'up' &&
        postOwnerId !==
          req.user.id

      if (shouldNotify) {
        await client.query(
          `
          INSERT INTO notifications (
            user_id,
            actor_id,
            type,
            post_id,
            read
          )

          VALUES (
            $1,
            $2,
            'like',
            $3,
            false
          )
          `,
          [
            postOwnerId,
            req.user.id,
            req.params.id
          ]
        )
      }

      await client.query(
        'COMMIT'
      )

      res.json({
        vote:
          newVote,

        liveUpvotes:
          upvotes,

        liveDownvotes:
          downvotes
      })
    } catch (error) {
      await client.query(
        'ROLLBACK'
      )

      console.error(
        'Vote error:',
        error
      )

      res
        .status(500)
        .json({
          error:
            error.message
        })
    } finally {
      client.release()
    }
  }
)


// ==================================================
// COMMENTS
// ==================================================


// --------------------------------------------------
// GET COMMENTS
// --------------------------------------------------

app.get(
  '/api/posts/:postId/comments',
  async (
    req,
    res
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT *

          FROM comments

          WHERE post_id = $1

          ORDER BY created_at ASC
          `,
          [
            req.params.postId
          ]
        )

      res.json(
        result.rows
      )
    } catch (error) {
      console.error(
        'Get comments error:',
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


// --------------------------------------------------
// CREATE COMMENT
// --------------------------------------------------

app.post(
  '/api/posts/:postId/comments',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const content =
        String(
          req.body.content ||
            ''
        ).trim()

      if (!content) {
        return res
          .status(400)
          .json({
            error:
              'Comment cannot be empty'
          })
      }

      const username =
        await getUsername(
          req.user
        )

      const result =
        await pool.query(
          `
          INSERT INTO comments (
            post_id,
            name,
            content,
            user_id
          )

          VALUES (
            $1,
            $2,
            $3,
            $4
          )

          RETURNING *
          `,
          [
            req.params.postId,
            username,
            content,
            req.user.id
          ]
        )

      res
        .status(201)
        .json(
          result.rows[0]
        )
    } catch (error) {
      console.error(
        'Create comment error:',
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


// --------------------------------------------------
// DELETE COMMENT
// --------------------------------------------------

app.delete(
  '/api/comments/:commentId',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            c.id,
            c.user_id,
            p.user_id AS post_owner_id

          FROM comments c

          JOIN posts p
            ON p.id = c.post_id

          WHERE c.id = $1
          `,
          [
            req.params.commentId
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
              'Comment not found'
          })
      }

      const comment =
        result.rows[0]

      const canDelete =
        comment.user_id ===
          req.user.id ||
        comment.post_owner_id ===
          req.user.id

      if (!canDelete) {
        return res
          .status(403)
          .json({
            error:
              'You cannot delete this comment'
          })
      }

      await pool.query(
        `
        DELETE FROM comments
        WHERE id = $1
        `,
        [
          req.params.commentId
        ]
      )

      res.json({
        success: true
      })
    } catch (error) {
      console.error(
        'Delete comment error:',
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


// ==================================================
// NOTIFICATIONS
// ==================================================


// --------------------------------------------------
// GET NOTIFICATIONS
// --------------------------------------------------

app.get(
  '/api/notifications',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            id,
            user_id,
            actor_id,
            type,
            post_id,
            read,
            created_at

          FROM notifications

          WHERE user_id = $1

          ORDER BY
            created_at DESC

          LIMIT 50
          `,
          [
            req.user.id
          ]
        )

      res.json(
        result.rows
      )
    } catch (error) {
      console.error(
        'Get notifications error:',
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


// --------------------------------------------------
// UNREAD NOTIFICATION COUNT
// --------------------------------------------------

app.get(
  '/api/notifications/unread-count',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT COUNT(*)::int
            AS count

          FROM notifications

          WHERE
            user_id = $1

            AND (
              read = false
              OR read IS NULL
            )
          `,
          [
            req.user.id
          ]
        )

      res.json({
        count:
          result.rows[0].count
      })
    } catch (error) {
      console.error(
        'Notification count error:',
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


// --------------------------------------------------
// MARK NOTIFICATIONS READ
// --------------------------------------------------

app.patch(
  '/api/notifications/read',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      await pool.query(
        `
        UPDATE notifications

        SET read = true

        WHERE
          user_id = $1

          AND (
            read = false
            OR read IS NULL
          )
        `,
        [
          req.user.id
        ]
      )

      res.json({
        success: true
      })
    } catch (error) {
      console.error(
        'Mark notifications read error:',
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

// ==================================================
// FRIEND REQUESTS
// ==================================================


// --------------------------------------------------
// PENDING REQUESTS
// --------------------------------------------------

app.get(
  '/api/friend-requests/pending',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            id,
            sender_id,
            receiver_id,
            status,
            created_at

          FROM friend_requests

          WHERE
            receiver_id = $1
            AND status = 'pending'

          ORDER BY
            created_at DESC
          `,
          [
            req.user.id
          ]
        )

      res.json(
        result.rows
      )
    } catch (error) {
      console.error(
        'Get pending requests error:',
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


// --------------------------------------------------
// PENDING REQUEST COUNT
// --------------------------------------------------

app.get(
  '/api/friend-requests/pending-count',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT COUNT(*)::int
            AS count

          FROM friend_requests

          WHERE
            receiver_id = $1
            AND status = 'pending'
          `,
          [
            req.user.id
          ]
        )

      res.json({
        count:
          result.rows[0].count
      })
    } catch (error) {
      console.error(
        'Friend request count error:',
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


// --------------------------------------------------
// CURRENT USER FRIENDS
// --------------------------------------------------

app.get(
  '/api/friends',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            id,

            CASE
              WHEN sender_id = $1
                THEN receiver_id
              ELSE sender_id
            END AS friend_id,

            created_at

          FROM friend_requests

          WHERE
            status = 'accepted'

            AND (
              sender_id = $1
              OR receiver_id = $1
            )

          ORDER BY
            created_at DESC
          `,
          [
            req.user.id
          ]
        )

      res.json(
        result.rows
      )
    } catch (error) {
      console.error(
        'Get friends error:',
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


// --------------------------------------------------
// ANOTHER USER'S FRIENDS
// --------------------------------------------------

app.get(
  '/api/users/:userId/friends',
  optionalAuth,
  async (
    req,
    res
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            id,

            CASE
              WHEN sender_id = $1
                THEN receiver_id
              ELSE sender_id
            END AS friend_id,

            created_at

          FROM friend_requests

          WHERE
            status = 'accepted'

            AND (
              sender_id = $1
              OR receiver_id = $1
            )

          ORDER BY
            created_at DESC
          `,
          [
            req.params.userId
          ]
        )

      res.json(
        result.rows
      )
    } catch (error) {
      console.error(
        'Get user friends error:',
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


// --------------------------------------------------
// FRIEND STATUS
// --------------------------------------------------

app.get(
  '/api/friend-status/:userId',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const otherUserId =
        req.params.userId

      if (
        otherUserId ===
        req.user.id
      ) {
        return res.json({
          status: 'self'
        })
      }

      const result =
        await pool.query(
          `
          SELECT
            id,
            sender_id,
            receiver_id,
            status

          FROM friend_requests

          WHERE (
            (
              sender_id = $1
              AND receiver_id = $2
            )

            OR

            (
              sender_id = $2
              AND receiver_id = $1
            )
          )

          ORDER BY
            created_at DESC

          LIMIT 1
          `,
          [
            req.user.id,
            otherUserId
          ]
        )

      if (
        result.rows.length ===
        0
      ) {
        return res.json({
          status: null
        })
      }

      const request =
        result.rows[0]

      if (
        request.status ===
        'accepted'
      ) {
        return res.json({
          status:
            'friends'
        })
      }

      if (
        request.status ===
        'pending'
      ) {
        if (
          request.sender_id ===
          req.user.id
        ) {
          return res.json({
            status:
              'sent'
          })
        }

        return res.json({
          status:
            'received'
        })
      }

      res.json({
        status: null
      })
    } catch (error) {
      console.error(
        'Friend status error:',
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


// --------------------------------------------------
// SEND FRIEND REQUEST
// --------------------------------------------------

app.post(
  '/api/friend-requests',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const receiverId =
        req.body.receiver_id

      if (!receiverId) {
        return res
          .status(400)
          .json({
            error:
              'receiver_id is required'
          })
      }

      if (
        receiverId ===
        req.user.id
      ) {
        return res
          .status(400)
          .json({
            error:
              'You cannot add yourself'
          })
      }

      const existing =
        await pool.query(
          `
          SELECT *

          FROM friend_requests

          WHERE (
            (
              sender_id = $1
              AND receiver_id = $2
            )

            OR

            (
              sender_id = $2
              AND receiver_id = $1
            )
          )

          LIMIT 1
          `,
          [
            req.user.id,
            receiverId
          ]
        )

      if (
        existing.rows.length >
        0
      ) {
        const row =
          existing.rows[0]

        if (
          row.status ===
          'accepted'
        ) {
          return res
            .status(409)
            .json({
              error:
                'You are already friends'
            })
        }

        if (
          row.status ===
          'pending'
        ) {
          return res
            .status(409)
            .json({
              error:
                'A friend request already exists'
            })
        }
      }

      const result =
        await pool.query(
          `
          INSERT INTO friend_requests (
            sender_id,
            receiver_id,
            status
          )

          VALUES (
            $1,
            $2,
            'pending'
          )

          RETURNING *
          `,
          [
            req.user.id,
            receiverId
          ]
        )

      res
        .status(201)
        .json(
          result.rows[0]
        )
    } catch (error) {
      console.error(
        'Send friend request error:',
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


// --------------------------------------------------
// ACCEPT FRIEND REQUEST
// --------------------------------------------------

app.patch(
  '/api/friend-requests/:id/accept',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const result =
        await pool.query(
          `
          UPDATE friend_requests

          SET status = 'accepted'

          WHERE
            id = $1
            AND receiver_id = $2
            AND status = 'pending'

          RETURNING *
          `,
          [
            req.params.id,
            req.user.id
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
              'Friend request not found'
          })
      }

      res.json(
        result.rows[0]
      )
    } catch (error) {
      console.error(
        'Accept friend request error:',
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


// --------------------------------------------------
// DELETE / DECLINE / REMOVE FRIEND
// --------------------------------------------------

app.delete(
  '/api/friend-requests/:id',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const result =
        await pool.query(
          `
          DELETE FROM friend_requests

          WHERE
            id = $1

            AND (
              sender_id = $2
              OR receiver_id = $2
            )

          RETURNING *
          `,
          [
            req.params.id,
            req.user.id
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
              'Friend request not found'
          })
      }

      res.json({
        success: true
      })
    } catch (error) {
      console.error(
        'Delete friend request error:',
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


// ==================================================
// MESSAGES
//
// IMPORTANT:
// unread routes MUST be before /:friendId
// ==================================================


// --------------------------------------------------
// UNREAD MESSAGE COUNT
// --------------------------------------------------

app.get(
  '/api/messages/unread-count',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT COUNT(*)::int
            AS count

          FROM messages

          WHERE
            receiver_id = $1

            AND (
              read = false
              OR read IS NULL
            )
          `,
          [
            req.user.id
          ]
        )

      res.json({
        count:
          result.rows[0].count
      })
    } catch (error) {
      console.error(
        'Unread message count error:',
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


// --------------------------------------------------
// UNREAD MESSAGES GROUPED BY SENDER
// --------------------------------------------------

app.get(
  '/api/messages/unread-by-sender',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            sender_id,
            COUNT(*)::int AS count

          FROM messages

          WHERE
            receiver_id = $1

            AND (
              read = false
              OR read IS NULL
            )

          GROUP BY
            sender_id
          `,
          [
            req.user.id
          ]
        )

      const counts = {}

      for (
        const row of result.rows
      ) {
        counts[
          row.sender_id
        ] = row.count
      }

      res.json(
        counts
      )
    } catch (error) {
      console.error(
        'Unread-by-sender error:',
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


// --------------------------------------------------
// GET CONVERSATION
// --------------------------------------------------

app.get(
  '/api/messages/:friendId',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const friendId =
        req.params.friendId

      const friends =
        await areFriends(
          req.user.id,
          friendId
        )

      if (!friends) {
        return res
          .status(403)
          .json({
            error:
              'You can only message friends'
          })
      }

      const result =
        await pool.query(
          `
          SELECT *

          FROM messages

          WHERE (
            (
              sender_id = $1
              AND receiver_id = $2
            )

            OR

            (
              sender_id = $2
              AND receiver_id = $1
            )
          )

          ORDER BY
            created_at ASC
          `,
          [
            req.user.id,
            friendId
          ]
        )

      res.json(
        result.rows
      )
    } catch (error) {
      console.error(
        'Get messages error:',
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


// --------------------------------------------------
// SEND MESSAGE
// --------------------------------------------------

app.post(
  '/api/messages/:friendId',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const friendId =
        req.params.friendId

      const content =
        String(
          req.body.content ||
            ''
        ).trim()

      if (!content) {
        return res
          .status(400)
          .json({
            error:
              'Message cannot be empty'
          })
      }

      const friends =
        await areFriends(
          req.user.id,
          friendId
        )

      if (!friends) {
        return res
          .status(403)
          .json({
            error:
              'You can only message friends'
          })
      }

      const result =
        await pool.query(
          `
          INSERT INTO messages (
            sender_id,
            receiver_id,
            content,
            read
          )

          VALUES (
            $1,
            $2,
            $3,
            false
          )

          RETURNING *
          `,
          [
            req.user.id,
            friendId,
            content
          ]
        )

      res
        .status(201)
        .json(
          result.rows[0]
        )
    } catch (error) {
      console.error(
        'Send message error:',
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


// --------------------------------------------------
// MARK CONVERSATION READ
// --------------------------------------------------

app.patch(
  '/api/messages/:friendId/read',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      const friendId =
        req.params.friendId

      await pool.query(
        `
        UPDATE messages

        SET read = true

        WHERE
          sender_id = $1
          AND receiver_id = $2

          AND (
            read = false
            OR read IS NULL
          )
        `,
        [
          friendId,
          req.user.id
        ]
      )

      res.json({
        success: true
      })
    } catch (error) {
      console.error(
        'Mark messages read error:',
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

// ==================================================
// PROFILES
// ==================================================


// --------------------------------------------------
// GET MY PROFILE
// --------------------------------------------------

app.get(
  '/api/profile',
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
            id,
            email,
            username,
            avatar_url,
            avatar_color,
            is_private,
            created_at

          FROM profiles

          WHERE id = $1
          `,
          [
            req.user.id
          ]
        )

      const profile =
        await addSignedAvatarUrl(
          result.rows[0]
        )

      res.json(
        profile
      )
    } catch (error) {
      console.error(
        'Get my profile error:',
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


// --------------------------------------------------
// GET MULTIPLE PROFILES
//
// /api/profiles?ids=id1,id2,id3
// --------------------------------------------------

app.get(
  '/api/profiles',
  optionalAuth,
  async (
    req,
    res
  ) => {
    try {
      const idsString =
        req.query.ids || ''

      if (!idsString) {
        return res.json([])
      }

      const ids =
        String(idsString)
          .split(',')
          .map(
            id =>
              id.trim()
          )
          .filter(Boolean)

      if (
        ids.length === 0
      ) {
        return res.json([])
      }

      if (
        ids.length > 100
      ) {
        return res
          .status(400)
          .json({
            error:
              'Too many profile IDs'
          })
      }

      const result =
        await pool.query(
          `
          SELECT
            id,
            username,
            avatar_url,
            avatar_color,
            is_private,
            created_at

          FROM profiles

          WHERE
            id = ANY(
              $1::uuid[]
            )
          `,
          [
            ids
          ]
        )

      const profiles =
        await addSignedAvatarUrls(
          result.rows
        )

      res.json(
        profiles
      )
    } catch (error) {
      console.error(
        'Get profiles error:',
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


// --------------------------------------------------
// GET ONE PUBLIC PROFILE
// --------------------------------------------------

app.get(
  '/api/profiles/:userId',
  optionalAuth,
  async (
    req,
    res
  ) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            id,
            username,
            avatar_url,
            avatar_color,
            is_private,
            created_at

          FROM profiles

          WHERE id = $1
          `,
          [
            req.params.userId
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
              'Profile not found'
          })
      }

      const profile =
        await addSignedAvatarUrl(
          result.rows[0]
        )

      res.json(
        profile
      )
    } catch (error) {
      console.error(
        'Get profile error:',
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


// --------------------------------------------------
// UPDATE MY PROFILE
// --------------------------------------------------

app.patch(
  '/api/profile',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      await ensureProfile(
        req.user
      )

      const allowedFields = [
        'username',
        'avatar_url',
        'avatar_color',
        'is_private'
      ]

      const updates = []
      const values = []

      for (
        const field of
          allowedFields
      ) {
        if (
          Object.prototype
            .hasOwnProperty
            .call(
              req.body,
              field
            )
        ) {
          let value =
            req.body[field]

          if (
            field ===
            'username'
          ) {
            if (
              typeof value !==
                'string' ||
              !value.trim()
            ) {
              return res
                .status(400)
                .json({
                  error:
                    'Username cannot be empty'
                })
            }

            value =
              value.trim()
          }

          if (
            field ===
              'is_private' &&
            typeof value !==
              'boolean'
          ) {
            return res
              .status(400)
              .json({
                error:
                  'is_private must be a boolean'
              })
          }

          values.push(
            value
          )

          updates.push(
            `${field} = $${values.length}`
          )
        }
      }

      if (
        updates.length ===
        0
      ) {
        return res
          .status(400)
          .json({
            error:
              'No profile fields provided'
          })
      }

      values.push(
        req.user.id
      )

      const result =
        await pool.query(
          `
          UPDATE profiles

          SET
            ${updates.join(', ')}

          WHERE id =
            $${values.length}

          RETURNING
            id,
            email,
            username,
            avatar_url,
            avatar_color,
            is_private,
            created_at
          `,
          values
        )

      const profile =
        await addSignedAvatarUrl(
          result.rows[0]
        )

      res.json(
        profile
      )
    } catch (error) {
      console.error(
        'Update profile error:',
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


// ==================================================
// AVATAR STORAGE — AMAZON S3
// ==================================================


// --------------------------------------------------
// UPLOAD / REPLACE AVATAR
//
// FormData field must be named:
// avatar
// --------------------------------------------------

app.post(
  '/api/profile/avatar',
  requireAuth,
  avatarUpload.single(
    'avatar'
  ),
  async (
    req,
    res
  ) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({
            error:
              'No avatar file provided'
          })
      }

      await ensureProfile(
        req.user
      )

      const key =
        `avatars/${req.user.id}`

      await s3.send(
        new PutObjectCommand({
          Bucket:
            process.env
              .S3_BUCKET_NAME,

          Key:
            key,

          Body:
            req.file.buffer,

          ContentType:
            req.file.mimetype,

          CacheControl:
            'no-cache'
        })
      )

      const storedValue =
        `s3:${key}`

      const result =
        await pool.query(
          `
          UPDATE profiles

          SET avatar_url = $1

          WHERE id = $2

          RETURNING
            id,
            email,
            username,
            avatar_url,
            avatar_color,
            is_private,
            created_at
          `,
          [
            storedValue,
            req.user.id
          ]
        )

      const profile =
        await addSignedAvatarUrl(
          result.rows[0]
        )

      res.json(
        profile
      )
    } catch (error) {
      console.error(
        'Avatar upload error:',
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


// --------------------------------------------------
// DELETE AVATAR
// --------------------------------------------------

app.delete(
  '/api/profile/avatar',
  requireAuth,
  async (
    req,
    res
  ) => {
    try {
      await ensureProfile(
        req.user
      )

      const key =
        `avatars/${req.user.id}`

      await s3.send(
        new DeleteObjectCommand({
          Bucket:
            process.env
              .S3_BUCKET_NAME,

          Key:
            key
        })
      )

      const result =
        await pool.query(
          `
          UPDATE profiles

          SET avatar_url = NULL

          WHERE id = $1

          RETURNING
            id,
            email,
            username,
            avatar_url,
            avatar_color,
            is_private,
            created_at
          `,
          [
            req.user.id
          ]
        )

      res.json(
        result.rows[0]
      )
    } catch (error) {
      console.error(
        'Avatar delete error:',
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

// ==================================================
// MULTER / GENERAL ERROR HANDLER
// ==================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    void req
    void next

    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        'LIMIT_FILE_SIZE'
      ) {
        return res
          .status(400)
          .json({
            error:
              'Avatar must be 5 MB or smaller'
          })
      }

      return res
        .status(400)
        .json({
          error:
            error.message
        })
    }

    if (
      error?.message ===
      'Unsupported image type'
    ) {
      return res
        .status(400)
        .json({
          error:
            error.message
        })
    }

    console.error(
      'Unhandled server error:',
      error
    )

    res
      .status(500)
      .json({
        error:
          error?.message ||
          'Internal server error'
      })
  }
)


// ==================================================
// RAWG GAME SEARCH
//
// Browser
// ↓
// NestPlay backend
// ↓
// RAWG
//
// RAWG API key stays server-side.
// ==================================================

app.get(
  '/api/games/search',
  requireAuth,
  async (req, res) => {
    try {
      const query =
        String(
          req.query.q || ''
        ).trim()

      if (!query) {
        return res.json({
          results: []
        })
      }

      if (
        !process.env.RAWG_API_KEY
      ) {
        console.error(
          'RAWG_API_KEY is missing'
        )

        return res.status(500).json({
          error:
            'Game search is not configured'
        })
      }

      const rawgUrl =
        new URL(
          'https://api.rawg.io/api/games'
        )

      rawgUrl.searchParams.set(
        'search',
        query
      )

      rawgUrl.searchParams.set(
        'key',
        process.env.RAWG_API_KEY
      )

      rawgUrl.searchParams.set(
        'page_size',
        '10'
      )

      const response =
        await fetch(
          rawgUrl
        )

      if (!response.ok) {
        console.error(
          'RAWG request failed:',
          response.status
        )

        return res.status(502).json({
          error:
            'RAWG game search failed'
        })
      }

      const data =
        await response.json()

      const results =
        (data.results || []).map(
          game => ({
            id:
              game.id,

            name:
              game.name,

            background_image:
              game.background_image ||
              null
          })
        )

      return res.json({
        results
      })
    } catch (error) {
      console.error(
        'RAWG search error:',
        error
      )

      return res.status(500).json({
        error:
          'Game search failed'
      })
    }
  }
)


// ==================================================
// START SERVER
// ==================================================

app.listen(
  PORT,
  () => {
    console.log(
      `GameSocial API running on http://localhost:${PORT}`
    )
  }
)