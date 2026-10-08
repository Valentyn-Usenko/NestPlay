/* global fetch, process, module, URL, URLSearchParams, AbortSignal */

const TWITCH_TOKEN_URL =
  'https://id.twitch.tv/oauth2/token'

const IGDB_GAMES_URL =
  'https://api.igdb.com/v4/games'

const REQUEST_TIMEOUT_MS =
  10000

const TOKEN_REFRESH_BUFFER_MS =
  60000

let cachedAccessToken =
  null

let cachedAccessTokenExpiresAt =
  0

let tokenRequest =
  null


function createIgdbError(
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


function getCredentials() {
  const clientId =
    String(
      process.env.IGDB_CLIENT_ID ||
      ''
    ).trim()

  const clientSecret =
    String(
      process.env.IGDB_CLIENT_SECRET ||
      ''
    ).trim()

  if (
    !clientId ||
    !clientSecret
  ) {
    throw createIgdbError(
      'IGDB credentials are not configured',
      503,
      'Game search is not configured'
    )
  }

  return {
    clientId,
    clientSecret
  }
}


async function requestAccessToken() {
  const {
    clientId,
    clientSecret
  } =
    getCredentials()

  const tokenUrl =
    new URL(
      TWITCH_TOKEN_URL
    )

  tokenUrl.search =
    new URLSearchParams({
      client_id:
        clientId,

      client_secret:
        clientSecret,

      grant_type:
        'client_credentials'
    }).toString()

  let response

  try {
    response =
      await fetch(
        tokenUrl,
        {
          method:
            'POST',

          headers: {
            Accept:
              'application/json'
          },

          signal:
            AbortSignal.timeout(
              REQUEST_TIMEOUT_MS
            )
        }
      )
  } catch (error) {
    throw createIgdbError(
      `Could not contact Twitch: ${error.message}`,
      502,
      'Game search provider is unavailable'
    )
  }

  let data = null

  try {
    data =
      await response.json()
  } catch {
    data =
      null
  }

  if (
    !response.ok ||
    !data?.access_token
  ) {
    throw createIgdbError(
      `Twitch token request failed with status ${response.status}`,
      502,
      'Game search provider authentication failed'
    )
  }

  const expiresInSeconds =
    Number(
      data.expires_in || 0
    )

  cachedAccessToken =
    data.access_token

  cachedAccessTokenExpiresAt =
    Date.now() +
    Math.max(
      0,
      expiresInSeconds * 1000 -
      TOKEN_REFRESH_BUFFER_MS
    )

  return cachedAccessToken
}


async function getAccessToken() {
  if (
    cachedAccessToken &&
    Date.now() <
      cachedAccessTokenExpiresAt
  ) {
    return cachedAccessToken
  }

  if (tokenRequest) {
    return tokenRequest
  }

  tokenRequest =
    requestAccessToken()
      .finally(() => {
        tokenRequest =
          null
      })

  return tokenRequest
}


function invalidateAccessToken() {
  cachedAccessToken =
    null

  cachedAccessTokenExpiresAt =
    0
}


function escapeSearchTerm(
  value
) {
  return String(value)
    .replace(
      /\\/g,
      '\\\\'
    )
    .replace(
      /"/g,
      '\\"'
    )
    .replace(
      /[\u0000-\u001f]/g,
      ' '
    )
}


function makeImageUrl(
  imageId
) {
  if (!imageId) {
    return null
  }

  return (
    'https://images.igdb.com/' +
    'igdb/image/upload/' +
    't_720p/' +
    `${imageId}.jpg`
  )
}


function normalizeGame(
  game
) {
  if (
    !game ||
    !game.id ||
    !game.name
  ) {
    return null
  }

  const artworkId =
    game.artworks?.[0]
      ?.image_id ||
    null

  const screenshotId =
    game.screenshots?.[0]
      ?.image_id ||
    null

  const coverId =
    game.cover
      ?.image_id ||
    null

  const imageId =
    artworkId ||
    screenshotId ||
    coverId

  return {
    id:
      `igdb:${game.id}`,

    name:
      game.name,

    background_image:
      makeImageUrl(
        imageId
      )
  }
}


async function requestGames(
  query,
  accessToken
) {
  const {
    clientId
  } =
    getCredentials()

  const escapedQuery =
    escapeSearchTerm(
      query
    )

  const body = `
search "${escapedQuery}";
fields
  id,
  name,
  cover.image_id,
  artworks.image_id,
  screenshots.image_id;
where version_parent = null;
limit 20;
`.trim()

  try {
    return await fetch(
      IGDB_GAMES_URL,
      {
        method:
          'POST',

        headers: {
          Accept:
            'application/json',

          'Client-ID':
            clientId,

          Authorization:
            `Bearer ${accessToken}`,

          'Content-Type':
            'text/plain'
        },

        body,

        signal:
          AbortSignal.timeout(
            REQUEST_TIMEOUT_MS
          )
      }
    )
  } catch (error) {
    throw createIgdbError(
      `Could not contact IGDB: ${error.message}`,
      502,
      'Game search provider is unavailable'
    )
  }
}


async function searchIgdbGames(
  search
) {
  const query =
    String(
      search || ''
    )
      .trim()
      .slice(
        0,
        100
      )

  if (!query) {
    return []
  }

  let accessToken =
    await getAccessToken()

  let response =
    await requestGames(
      query,
      accessToken
    )

  if (
    response.status ===
    401
  ) {
    invalidateAccessToken()

    accessToken =
      await getAccessToken()

    response =
      await requestGames(
        query,
        accessToken
      )
  }

  if (!response.ok) {
    const providerMessage =
      await response
        .text()
        .catch(
          () => ''
        )

    throw createIgdbError(
      `IGDB request failed with status ${response.status}: ${providerMessage.slice(0, 300)}`,
      502,
      'IGDB game search failed'
    )
  }

  const data =
    await response.json()

  if (!Array.isArray(data)) {
    return []
  }

  return data
    .map(
      normalizeGame
    )
    .filter(Boolean)
}


module.exports = {
  searchIgdbGames,

  _test: {
    escapeSearchTerm,
    makeImageUrl,
    normalizeGame,
    invalidateAccessToken
  }
}