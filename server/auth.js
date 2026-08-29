/* global require, process, module */

const { CognitoJwtVerifier } =
  require('aws-jwt-verify')

const pool =
  require('./db')

const {
  createClient
} =
  require('@supabase/supabase-js')


const supabase =
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  )


const cognitoVerifier =
  CognitoJwtVerifier.create({
    userPoolId:
      process.env.COGNITO_USER_POOL_ID,

    tokenUse:
      'access',

    clientId:
      process.env.COGNITO_CLIENT_ID
  })


async function verifyCognitoToken(
  token
) {
  try {
    const payload =
      await cognitoVerifier.verify(
        token
      )

    const cognitoSub =
      payload.sub

    if (!cognitoSub) {
      return null
    }

    const result =
      await pool.query(
        `
        SELECT
          p.id,
          p.email,
          p.username
        FROM auth_identities ai
        JOIN profiles p
          ON p.id = ai.user_id
        WHERE
          ai.provider = 'cognito'
          AND ai.provider_user_id = $1
        LIMIT 1
        `,
        [cognitoSub]
      )

    if (
      result.rows.length === 0
    ) {
      return {
        provider:
          'cognito',

        mapped:
          false,

        cognitoSub,

        email:
          payload.email ||
          null,

        cognitoUsername:
          payload.username ||
          null
      }
    }

    const profile =
      result.rows[0]

    return {
      id:
        profile.id,

      email:
        profile.email ||
        payload.email ||
        null,

      username:
        profile.username ||
        null,

      provider:
        'cognito',

      mapped:
        true,

      cognitoSub
    }
  } catch {
    return null
  }
}


async function verifySupabaseToken(
  token
) {
  try {
    const {
      data,
      error
    } =
      await supabase.auth
        .getUser(token)

    if (
      error ||
      !data?.user
    ) {
      return null
    }

    return {
      ...data.user,

      provider:
        'supabase',

      mapped:
        true
    }
  } catch {
    return null
  }
}


async function verifyAuthToken(
  token
) {
  const cognitoUser =
    await verifyCognitoToken(
      token
    )

  if (cognitoUser) {
    return cognitoUser
  }

  const supabaseUser =
    await verifySupabaseToken(
      token
    )

  if (supabaseUser) {
    return supabaseUser
  }

  return null
}


module.exports = {
  verifyAuthToken,
  verifyCognitoToken,
  verifySupabaseToken
}