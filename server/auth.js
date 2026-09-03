/* global require, process, module */

const {
  CognitoJwtVerifier
} =
  require('aws-jwt-verify')

const pool =
  require('./db')


const cognitoVerifier =
  CognitoJwtVerifier.create({
    userPoolId:
      process.env.COGNITO_USER_POOL_ID,

    tokenUse:
      'access',

    clientId:
      process.env.COGNITO_CLIENT_ID
  })


// ==================================================
// VERIFY COGNITO ACCESS TOKEN
// ==================================================

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

    // ----------------------------------------------
    // Valid Cognito account, but no NestPlay
    // profile mapping yet.
    //
    // This is still needed for new-account
    // bootstrap.
    // ----------------------------------------------

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


// ==================================================
// VERIFY APP AUTH TOKEN
//
// Cognito is now the only authentication provider.
// ==================================================

async function verifyAuthToken(
  token
) {
  return (
    await verifyCognitoToken(
      token
    )
  )
}


module.exports = {
  verifyAuthToken,
  verifyCognitoToken
}