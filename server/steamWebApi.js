const STEAM_WEB_API_BASE_URL =
  'https://api.steampowered.com'

const MAX_STEAM_IDS = 100

const UINT64_MAX =
  18446744073709551615n


function getSteamWebApiKey() {
  const key =
    process.env
      .STEAM_WEB_API_KEY
      ?.trim()

  if (!key) {
    const error =
      new Error(
        'Steam Web API is not configured'
      )

    error.statusCode = 503

    throw error
  }

  return key
}


function normalizeSteamIds(
  steamIds
) {
  if (
    !Array.isArray(
      steamIds
    ) ||
    steamIds.length === 0
  ) {
    throw new Error(
      'At least one SteamID is required'
    )
  }

  if (
    steamIds.length >
    MAX_STEAM_IDS
  ) {
    throw new Error(
      'A maximum of 100 SteamIDs can be requested'
    )
  }

  const normalized = []

  const seen =
    new Set()

  for (
    const value of
      steamIds
  ) {
    const steamId =
      String(
        value ?? ''
      ).trim()

    if (
      !/^\d+$/.test(
        steamId
      )
    ) {
      throw new Error(
        'SteamID must contain only digits'
      )
    }

    let numericId

    try {
      numericId =
        BigInt(
          steamId
        )
    } catch {
      throw new Error(
        'SteamID is invalid'
      )
    }

    if (
      numericId <= 0n ||
      numericId >
        UINT64_MAX
    ) {
      throw new Error(
        'SteamID is outside the uint64 range'
      )
    }

    if (
      !seen.has(
        steamId
      )
    ) {
      seen.add(
        steamId
      )

      normalized.push(
        steamId
      )
    }
  }

  return normalized
}


function normalizePlayer(
  player
) {
  if (
    !player ||
    typeof player !==
      'object'
  ) {
    return null
  }

  const steamId =
    typeof player.steamid ===
      'string'
      ? player.steamid
      : null

  if (!steamId) {
    return null
  }

  return {
    steamId,

    personaName:
      typeof player.personaname ===
        'string'
        ? player.personaname
        : null,

    profileUrl:
      typeof player.profileurl ===
        'string'
        ? player.profileurl
        : null,

    avatarUrl:
      typeof player.avatar ===
        'string'
        ? player.avatar
        : null,

    avatarMediumUrl:
      typeof player.avatarmedium ===
        'string'
        ? player.avatarmedium
        : null,

    avatarFullUrl:
      typeof player.avatarfull ===
        'string'
        ? player.avatarfull
        : null,

    communityVisibilityState:
      Number.isInteger(
        player.communityvisibilitystate
      )
        ? player.communityvisibilitystate
        : null,

    profileState:
      Number.isInteger(
        player.profilestate
      )
        ? player.profilestate
        : null,

    lastLogoff:
      Number.isInteger(
        player.lastlogoff
      )
        ? player.lastlogoff
        : null,

    currentGame:
      typeof player.gameid ===
        'string' &&
      /^\d+$/.test(
        player.gameid
      ) &&
      typeof player.gameextrainfo ===
        'string' &&
      player.gameextrainfo.trim()
        ? {
            appId:
              player.gameid,

            name:
              player.gameextrainfo.trim()
          }
        : null
  }
}


async function getPlayerSummaries(
  steamIds,
  options = {}
) {
  const ids =
    normalizeSteamIds(
      steamIds
    )

  const apiKey =
    getSteamWebApiKey()

  const fetchImpl =
    options.fetchImpl ||
    fetch

  const url =
    new URL(
      '/ISteamUser/GetPlayerSummaries/v2/',
      STEAM_WEB_API_BASE_URL
    )

  url.searchParams.set(
    'steamids',
    ids.join(',')
  )

  let response

  try {
    response =
      await fetchImpl(
        url,
        {
          method: 'GET',

          headers: {
            'x-webapi-key':
              apiKey,

            accept:
              'application/json'
          },

          signal:
            AbortSignal.timeout(
              10000
            )
        }
      )
  } catch (error) {
    if (
      error?.name ===
        'TimeoutError' ||
      error?.name ===
        'AbortError'
    ) {
      const timeoutError =
        new Error(
          'Steam Web API request timed out'
        )

      timeoutError.statusCode =
        504

      throw timeoutError
    }

    const requestError =
      new Error(
        'Could not reach Steam Web API'
      )

    requestError.statusCode =
      502

    throw requestError
  }

  if (!response.ok) {
    const error =
      new Error(
        `Steam Web API returned HTTP ${response.status}`
      )

    error.statusCode = 502

    throw error
  }

  let data

  try {
    data =
      await response.json()
  } catch {
    const error =
      new Error(
        'Steam Web API returned invalid JSON'
      )

    error.statusCode = 502

    throw error
  }

  const players =
    data?.response?.players

  if (
    !Array.isArray(
      players
    )
  ) {
    const error =
      new Error(
        'Steam Web API response was malformed'
      )

    error.statusCode = 502

    throw error
  }

  return players
    .map(
      normalizePlayer
    )
    .filter(Boolean)
}


module.exports = {
  getPlayerSummaries,

  _test: {
    getSteamWebApiKey,
    normalizePlayer,
    normalizeSteamIds
  }
}