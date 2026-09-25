function currentGameError(
  message,
  statusCode = 400
) {
  const error =
    new Error(message)

  error.statusCode =
    statusCode

  return error
}

function normalizeCurrentGames(
  games
) {
  if (!Array.isArray(games)) {
    throw currentGameError(
      'games must be an array'
    )
  }

  if (games.length > 3) {
    throw currentGameError(
      'You can select up to 3 currently playing games'
    )
  }

  const seen =
    new Set()

  return games.map(
    (game, index) => {
      const gameId =
        String(
          game?.id ??
          game?.gameId ??
          game?.game_id ??
          ''
        ).trim()

      const name =
        String(
          game?.name ??
          game?.game_name ??
          ''
        ).trim()

      const rawArt =
        game?.background_image ??
        game?.gameArtUrl ??
        game?.game_art_url ??
        null

      const gameArtUrl =
        rawArt == null
          ? null
          : String(
              rawArt
            ).trim() ||
            null

      if (!gameId) {
        throw currentGameError(
          'Each game must have an ID'
        )
      }

      if (!name) {
        throw currentGameError(
          'Each game must have a name'
        )
      }

      if (gameId.length > 200) {
        throw currentGameError(
          'Game ID is too long'
        )
      }

      if (name.length > 240) {
        throw currentGameError(
          'Game name is too long'
        )
      }

      if (seen.has(gameId)) {
        throw currentGameError(
          'The same game cannot be selected twice'
        )
      }

      seen.add(gameId)

      return {
        gameId,
        name,
        gameArtUrl,
        position:
          index + 1
      }
    }
  )
}

function serializeCurrentGame(
  row
) {
  return {
    gameId:
      row.game_id,

    name:
      row.game_name,

    gameArtUrl:
      row.game_art_url ||
      null,

    position:
      Number(
        row.position
      ),

    source:
      row.source,

    sourceRef:
      row.source_ref ||
      null
  }
}

async function getCurrentGames(
  db,
  userId
) {
  const result =
    await db.query(
      `
      SELECT
        game_id,
        game_name,
        game_art_url,
        position,
        source,
        source_ref

      FROM user_current_games

      WHERE user_id = $1

      ORDER BY
        position ASC,
        created_at ASC

      LIMIT 3
      `,
      [
        userId
      ]
    )

  return result.rows.map(
    serializeCurrentGame
  )
}

async function getCurrentGamesForUsers(
  db,
  userIds
) {
  if (
    !Array.isArray(userIds) ||
    userIds.length === 0
  ) {
    return new Map()
  }

  const result =
    await db.query(
      `
      SELECT
        user_id,
        game_id,
        game_name,
        game_art_url,
        position,
        source,
        source_ref

      FROM user_current_games

      WHERE
        user_id = ANY(
          $1::uuid[]
        )

      ORDER BY
        user_id,
        position ASC,
        created_at ASC
      `,
      [
        userIds
      ]
    )

  const byUser =
    new Map()

  for (const row of result.rows) {
    const userId =
      String(
        row.user_id
      )

    if (!byUser.has(userId)) {
      byUser.set(
        userId,
        []
      )
    }

    const games =
      byUser.get(userId)

    if (games.length < 3) {
      games.push(
        serializeCurrentGame(
          row
        )
      )
    }
  }

  return byUser
}

async function replaceManualCurrentGames(
  db,
  userId,
  games
) {
  const normalized =
    normalizeCurrentGames(
      games
    )

  await db.query(
    `
    DELETE FROM user_current_games

    WHERE
      user_id = $1
      AND source = 'manual'
    `,
    [
      userId
    ]
  )

  if (
    normalized.length === 0
  ) {
    return []
  }

  await db.query(
    `
    INSERT INTO user_current_games (
      user_id,
      game_id,
      game_name,
      game_art_url,
      position,
      source,
      created_at,
      updated_at
    )

    SELECT
      $1,
      input.game_id,
      input.game_name,
      input.game_art_url,
      input.position,
      'manual',
      NOW(),
      NOW()

    FROM UNNEST(
      $2::text[],
      $3::text[],
      $4::text[],
      $5::smallint[]
    ) AS input(
      game_id,
      game_name,
      game_art_url,
      position
    )
    `,
    [
      userId,

      normalized.map(
        game =>
          game.gameId
      ),

      normalized.map(
        game =>
          game.name
      ),

      normalized.map(
        game =>
          game.gameArtUrl
      ),

      normalized.map(
        game =>
          game.position
      )
    ]
  )

  return getCurrentGames(
    db,
    userId
  )
}

module.exports = {
  normalizeCurrentGames,
  getCurrentGames,
  getCurrentGamesForUsers,
  replaceManualCurrentGames
}
