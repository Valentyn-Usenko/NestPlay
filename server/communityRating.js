/* global module */

// NESTPLAY_COMMUNITY_RATING

const {
  parseProviderGameId
} = require('./gameContext')


function createCommunityRatingError(
  message,
  statusCode,
  publicMessage
) {
  const error =
    new Error(message)

  error.statusCode =
    statusCode

  error.publicMessage =
    publicMessage

  return error
}


function normalizeCommunityRating(
  value
) {
  if (
    typeof value !==
      'number' ||
    !Number.isInteger(
      value
    ) ||
    value < 1 ||
    value > 5
  ) {
    throw createCommunityRatingError(
      'Community Rating must be an integer from 1 to 5',
      400,
      'Rating must be a whole number from 1 to 5'
    )
  }

  return value
}


function normalizeCommunityGameId(
  value
) {
  const parsed =
    parseProviderGameId(
      value
    )

  if (!parsed.supported) {
    throw createCommunityRatingError(
      `Unsupported Community Rating game ID: ${parsed.raw}`,
      400,
      'A valid IGDB game ID is required'
    )
  }

  return parsed.raw
}


function normalizeUserId(
  value
) {
  const userId =
    String(
      value || ''
    ).trim()

  if (!userId) {
    throw createCommunityRatingError(
      'Community Rating user ID is required',
      401,
      'Authentication required'
    )
  }

  return userId
}


function createCommunityRatingService(
  pool
) {
  if (
    !pool ||
    typeof pool.query !==
      'function'
  ) {
    throw new Error(
      'Community Rating requires a database pool'
    )
  }


  async function getCommunityRating({
    gameId,
    userId = null
  }) {
    const normalizedGameId =
      normalizeCommunityGameId(
        gameId
      )

    const normalizedUserId =
      userId
        ? normalizeUserId(
            userId
          )
        : null

    const result =
      await pool.query(
        `
        SELECT
          ROUND(
            AVG(rating)::numeric,
            2
          )::double precision
            AS average,

          COUNT(*)::int
            AS count,

          MAX(rating) FILTER (
            WHERE
              user_id =
                $2::uuid
          ) AS "myRating"

        FROM game_ratings

        WHERE game_id = $1
        `,
        [
          normalizedGameId,
          normalizedUserId
        ]
      )

    const row =
      result.rows[0] ||
      {}

    return {
      gameId:
        normalizedGameId,

      average:
        row.average ??
        null,

      count:
        Number(
          row.count || 0
        ),

      myRating:
        row.myRating ??
        null
    }
  }


  async function setCommunityRating({
    gameId,
    userId,
    rating
  }) {
    const normalizedGameId =
      normalizeCommunityGameId(
        gameId
      )

    const normalizedUserId =
      normalizeUserId(
        userId
      )

    const normalizedRating =
      normalizeCommunityRating(
        rating
      )

    await pool.query(
      `
      INSERT INTO game_ratings (
        user_id,
        game_id,
        rating
      )

      VALUES (
        $1,
        $2,
        $3
      )

      ON CONFLICT (
        user_id,
        game_id
      )

      DO UPDATE SET
        rating =
          EXCLUDED.rating,

        updated_at =
          NOW()
      `,
      [
        normalizedUserId,
        normalizedGameId,
        normalizedRating
      ]
    )

    return getCommunityRating({
      gameId:
        normalizedGameId,

      userId:
        normalizedUserId
    })
  }


  async function deleteCommunityRating({
    gameId,
    userId
  }) {
    const normalizedGameId =
      normalizeCommunityGameId(
        gameId
      )

    const normalizedUserId =
      normalizeUserId(
        userId
      )

    await pool.query(
      `
      DELETE FROM game_ratings

      WHERE
        user_id = $1
        AND game_id = $2
      `,
      [
        normalizedUserId,
        normalizedGameId
      ]
    )

    return getCommunityRating({
      gameId:
        normalizedGameId,

      userId:
        normalizedUserId
    })
  }


  return {
    getCommunityRating,
    setCommunityRating,
    deleteCommunityRating
  }
}


module.exports = {
  createCommunityRatingService,

  _test: {
    createCommunityRatingError,
    normalizeCommunityRating,
    normalizeCommunityGameId,
    normalizeUserId
  }
}
