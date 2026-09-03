import {
  cognitoRefresh
} from './cognitoClient'

import {
  API_BASE_URL
} from './config'


const COGNITO_ACCESS_TOKEN =
  'nestplay_cognito_access_token'

const COGNITO_ID_TOKEN =
  'nestplay_cognito_id_token'

const COGNITO_REFRESH_TOKEN =
  'nestplay_cognito_refresh_token'


// ==================================================
// SAVE COGNITO TOKENS
// ==================================================

export function saveCognitoTokens(
  authenticationResult
) {
  if (
    authenticationResult?.AccessToken
  ) {
    localStorage.setItem(
      COGNITO_ACCESS_TOKEN,
      authenticationResult.AccessToken
    )
  }

  if (
    authenticationResult?.IdToken
  ) {
    localStorage.setItem(
      COGNITO_ID_TOKEN,
      authenticationResult.IdToken
    )
  }

  if (
    authenticationResult?.RefreshToken
  ) {
    localStorage.setItem(
      COGNITO_REFRESH_TOKEN,
      authenticationResult.RefreshToken
    )
  }
}


// ==================================================
// GET STORED TOKENS
// ==================================================

export function getCognitoAccessToken() {
  return localStorage.getItem(
    COGNITO_ACCESS_TOKEN
  )
}


export function getCognitoIdToken() {
  return localStorage.getItem(
    COGNITO_ID_TOKEN
  )
}


export function getCognitoRefreshToken() {
  return localStorage.getItem(
    COGNITO_REFRESH_TOKEN
  )
}


// ==================================================
// CLEAR COGNITO TOKENS
// ==================================================

export function clearCognitoTokens() {
  localStorage.removeItem(
    COGNITO_ACCESS_TOKEN
  )

  localStorage.removeItem(
    COGNITO_ID_TOKEN
  )

  localStorage.removeItem(
    COGNITO_REFRESH_TOKEN
  )
}


// ==================================================
// JWT HELPERS
// ==================================================

function decodeJwt(token) {
  try {
    const payload =
      token.split('.')[1]

    const normalized =
      payload
        .replace(/-/g, '+')
        .replace(/_/g, '/')

    const padded =
      normalized.padEnd(
        Math.ceil(
          normalized.length / 4
        ) * 4,
        '='
      )

    return JSON.parse(
      atob(padded)
    )
  } catch {
    return null
  }
}


function tokenIsExpired(token) {
  const payload =
    decodeJwt(token)

  if (!payload?.exp) {
    return true
  }

  const now =
    Math.floor(
      Date.now() / 1000
    )

  // Refresh shortly before expiration.
  return (
    payload.exp <=
    now + 30
  )
}


// ==================================================
// GET VALID COGNITO ACCESS TOKEN
// ==================================================

async function getValidCognitoAccessToken() {
  let accessToken =
    getCognitoAccessToken()

  if (!accessToken) {
    return null
  }

  if (
    !tokenIsExpired(
      accessToken
    )
  ) {
    return accessToken
  }

  const refreshToken =
    getCognitoRefreshToken()

  if (!refreshToken) {
    clearCognitoTokens()

    return null
  }

  try {
    const response =
      await cognitoRefresh(
        refreshToken
      )

    const authenticationResult =
      response.AuthenticationResult

    if (
      !authenticationResult
        ?.AccessToken
    ) {
      clearCognitoTokens()

      return null
    }

    saveCognitoTokens(
      authenticationResult
    )

    accessToken =
      authenticationResult
        .AccessToken

    return accessToken
  } catch (error) {
    console.error(
      'Cognito refresh failed:',
      error
    )

    clearCognitoTokens()

    return null
  }
}


// ==================================================
// TOKEN FOR API.JS
//
// Cognito is now the only auth provider.
// ==================================================

export async function getAuthAccessToken() {
  return (
    await getValidCognitoAccessToken()
  )
}


// ==================================================
// NORMALIZED APP SESSION
//
// Keeps the same session shape that the existing
// React components already expect:
//
// session.user.id
// session.user.email
// session.user.user_metadata.username
// session.user.created_at
// ==================================================

export async function getCurrentAuthSession() {
  const cognitoToken =
    await getValidCognitoAccessToken()

  if (!cognitoToken) {
    return null
  }

  try {
    const response =
      await fetch(
        `${API_BASE_URL}/api/profile`,
        {
          headers: {
            Authorization:
              `Bearer ${cognitoToken}`
          }
        }
      )

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      clearCognitoTokens()

      return null
    }

    if (!response.ok) {
      console.error(
        'Could not load Cognito profile:',
        response.status
      )

      return null
    }

    const profile =
      await response.json()

    const idPayload =
      decodeJwt(
        getCognitoIdToken()
      )

    return {
      provider:
        'cognito',

      access_token:
        cognitoToken,

      user: {
        id:
          profile.id,

        email:
          profile.email ||
          idPayload?.email ||
          null,

        created_at:
          profile.created_at ||
          null,

        user_metadata: {
          username:
            profile.username ||
            idPayload?.[
              'cognito:username'
            ] ||
            null
        }
      }
    }
  } catch (error) {
    console.error(
      'Could not load Cognito session:',
      error
    )

    return null
  }
}