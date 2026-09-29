const {
  getOwnedGames
} = require('./steamWebApi')


const STEAM_PROVIDER =
  'steam'

const MAX_FAVORITES = 6

const POSTGRES_BIGINT_MAX =
  9223372036854775807n


function favoriteError(
  message,
  statusCode = 400
) {
  const error =
    new Error(
      message
    )

  error.statusCode =
    statusCode

  return error
}


function normalizeFavoriteAppIds(
  appIds
) {
  if (
    !Array.isArray(
      appIds
    )
  ) {
    throw favoriteError(
      'Favorite games must be an array'
    )
  }

  if (
    appIds.length ===
    0
  ) {
    return []
  }

  if (
    appIds.length >
      MAX_FAVORITES
  ) {
    throw favoriteError(
      'Choose up to 6 favorite games'
    )
  }

  const normalized = []
  const seen =
    new Set()

  for (
    const value of
      appIds
  ) {
    const appId =
      String(
        value ?? ''
      ).trim()

    if (
      !/^\d+$/.test(
        appId
      )
    ) {
      throw favoriteError(
        'Steam app IDs must contain only digits'
      )
    }

    let numericAppId

    try {
      numericAppId =
        BigInt(
          appId
        )
    } catch {
      throw favoriteError(
        'Steam app ID is invalid'
      )
    }

    if (
      numericAppId <= 0n ||
      numericAppId >
        POSTGRES_BIGINT_MAX
    ) {
      throw favoriteError(
        'Steam app ID is outside the supported range'
      )
    }

    if (
      seen.has(
        appId
      )
    ) {
      throw favoriteError(
        'Favorite games must be unique'
      )
    }

    seen.add(
      appId
    )

    normalized.push(
      appId
    )
  }

  return normalized
}


async function getLinkedSteamId(
  pool,
  userId
) {
  const result =
    await pool.query(
      `
      SELECT
        external_user_id

      FROM user_external_accounts

      WHERE
        user_id = $1
        AND provider = $2

      LIMIT 1
      `,
      [
        userId,
        STEAM_PROVIDER
      ]
    )

  if (
    result.rows.length ===
    0
  ) {
    throw favoriteError(
      'Connect Steam before managing favorite games',
      409
    )
  }

  return String(
    result
      .rows[0]
      .external_user_id
  )
}


async function getSavedFavoriteAppIds(
  pool,
  userId
) {
  const result =
    await pool.query(
      `
      SELECT
        steam_app_id::text
          AS "appId"

      FROM user_steam_favorite_games

      WHERE
        user_id = $1

      ORDER BY
        sort_order ASC
      `,
      [
        userId
      ]
    )

  return result.rows.map(
    row =>
      row.appId
  )
}


function mapFavoriteGames(
  appIds,
  games
) {
  const gamesById =
    new Map(
      games.map(
        game => [
          game.appId,
          game
        ]
      )
    )

  return appIds
    .map(
      appId =>
        gamesById.get(
          appId
        ) ||
        null
    )
    .filter(Boolean)
}


async function getSteamLibraryForFavorites(
  pool,
  userId,
  options = {}
) {
  const getOwnedGamesImpl =
    options.getOwnedGamesImpl ||
    getOwnedGames

  const [
    steamId,
    selectedAppIds
  ] =
    await Promise.all([
      getLinkedSteamId(
        pool,
        userId
      ),

      getSavedFavoriteAppIds(
        pool,
        userId
      )
    ])

  const library =
    await getOwnedGamesImpl(
      steamId
    )

  return {
    visible:
      Boolean(
        library.visible
      ),

    games:
      library.games ||
      [],

    selectedAppIds
  }
}


async function getSteamFavoriteGames(
  pool,
  userId,
  options = {}
) {
  const selectedAppIds =
    await getSavedFavoriteAppIds(
      pool,
      userId
    )

  if (
    selectedAppIds.length ===
    0
  ) {
    return {
      visible: true,
      games: []
    }
  }

  let steamId

  try {
    steamId =
      await getLinkedSteamId(
        pool,
        userId
      )
  } catch (
    error
  ) {
    if (
      error.statusCode ===
      409
    ) {
      return {
        visible: false,
        games: []
      }
    }

    throw error
  }

  const getOwnedGamesImpl =
    options.getOwnedGamesImpl ||
    getOwnedGames

  const library =
    await getOwnedGamesImpl(
      steamId
    )

  if (
    !library.visible
  ) {
    return {
      visible: false,
      games: []
    }
  }

  return {
    visible: true,

    games:
      mapFavoriteGames(
        selectedAppIds,
        library.games ||
          []
      )
  }
}


async function saveSteamFavoriteGames(
  pool,
  userId,
  appIds,
  options = {}
) {
  const normalized =
    normalizeFavoriteAppIds(
      appIds
    )

  let favoriteGames = []

  if (
    normalized.length >
    0
  ) {
    const steamId =
      await getLinkedSteamId(
        pool,
        userId
      )

    const getOwnedGamesImpl =
      options.getOwnedGamesImpl ||
      getOwnedGames

    const library =
      await getOwnedGamesImpl(
        steamId
      )

    if (
      !library.visible
    ) {
      throw favoriteError(
        'Your Steam game details are private or unavailable',
        403
      )
    }

    const ownedGames =
      new Map(
        (
          library.games ||
          []
        ).map(
          game => [
            game.appId,
            game
          ]
        )
      )

    for (
      const appId of
        normalized
    ) {
      if (
        !ownedGames.has(
          appId
        )
      ) {
        throw favoriteError(
          'A selected game was not found in your Steam library',
          400
        )
      }
    }

    favoriteGames =
      normalized.map(
        appId =>
          ownedGames.get(
            appId
          )
      )
  }

  const client =
    await pool.connect()

  try {
    await client.query(
      'BEGIN'
    )

    await client.query(
      `
      DELETE FROM
        user_steam_favorite_games

      WHERE
        user_id = $1
      `,
      [
        userId
      ]
    )

    for (
      let index = 0;
      index <
        normalized.length;
      index += 1
    ) {
      await client.query(
        `
        INSERT INTO
          user_steam_favorite_games (
            user_id,
            steam_app_id,
            sort_order
          )

        VALUES (
          $1,
          $2,
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

    await client.query(
      'COMMIT'
    )
  } catch (
    error
  ) {
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
    games:
      favoriteGames
  }
}


module.exports = {
  getSteamFavoriteGames,
  getSteamLibraryForFavorites,
  saveSteamFavoriteGames,

  _test: {
    getLinkedSteamId,
    getSavedFavoriteAppIds,
    mapFavoriteGames,
    normalizeFavoriteAppIds
  }
}