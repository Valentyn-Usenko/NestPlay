import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  InitiateAuthCommand,
  ChangePasswordCommand,
  UpdateUserAttributesCommand,
  VerifyUserAttributeCommand,
  GetUserAttributeVerificationCodeCommand,
  GetUserCommand,
  DeleteUserCommand
} from '@aws-sdk/client-cognito-identity-provider'


const REGION =
  import.meta.env.VITE_COGNITO_REGION

const CLIENT_ID =
  import.meta.env.VITE_COGNITO_CLIENT_ID


const cognitoClient =
  new CognitoIdentityProviderClient({
    region: REGION
  })


// ==================================================
// SIGN UP
// ==================================================

export async function cognitoSignUp({
  username,
  email,
  password,
  phoneNumber = null
}) {
  const attributes = [
    {
      Name: 'email',
      Value: email
    }
  ]

  if (phoneNumber) {
    attributes.push({
      Name: 'phone_number',
      Value: phoneNumber
    })
  }

  return cognitoClient.send(
    new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: username,
      Password: password,
      UserAttributes: attributes
    })
  )
}


// ==================================================
// CONFIRM SIGN UP
// ==================================================

export async function cognitoConfirmSignUp({
  username,
  code
}) {
  return cognitoClient.send(
    new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: username,
      ConfirmationCode: code
    })
  )
}


// ==================================================
// RESEND SIGNUP CODE
// ==================================================

export async function cognitoResendCode(
  username
) {
  return cognitoClient.send(
    new ResendConfirmationCodeCommand({
      ClientId: CLIENT_ID,
      Username: username
    })
  )
}


// ==================================================
// SIGN IN
// ==================================================

export async function cognitoSignIn({
  login,
  password
}) {
  return cognitoClient.send(
    new InitiateAuthCommand({
      ClientId: CLIENT_ID,

      AuthFlow:
        'USER_PASSWORD_AUTH',

      AuthParameters: {
        USERNAME: login,
        PASSWORD: password
      }
    })
  )
}


// ==================================================
// REFRESH SESSION
// ==================================================

export async function cognitoRefresh(
  refreshToken
) {
  return cognitoClient.send(
    new InitiateAuthCommand({
      ClientId: CLIENT_ID,

      AuthFlow:
        'REFRESH_TOKEN_AUTH',

      AuthParameters: {
        REFRESH_TOKEN:
          refreshToken
      }
    })
  )
}


// ==================================================
// GET CURRENT COGNITO USER
// ==================================================

export async function cognitoGetUser(
  accessToken
) {
  return cognitoClient.send(
    new GetUserCommand({
      AccessToken:
        accessToken
    })
  )
}


// ==================================================
// CHANGE PASSWORD
// ==================================================

export async function cognitoChangePassword({
  accessToken,
  currentPassword,
  newPassword
}) {
  return cognitoClient.send(
    new ChangePasswordCommand({
      AccessToken:
        accessToken,

      PreviousPassword:
        currentPassword,

      ProposedPassword:
        newPassword
    })
  )
}


// ==================================================
// CHANGE EMAIL
//
// Cognito may send a verification code to the
// new email address.
// ==================================================

export async function cognitoUpdateEmail({
  accessToken,
  email
}) {
  return cognitoClient.send(
    new UpdateUserAttributesCommand({
      AccessToken:
        accessToken,

      UserAttributes: [
        {
          Name: 'email',
          Value: email
        }
      ]
    })
  )
}


// ==================================================
// VERIFY NEW EMAIL
// ==================================================

export async function cognitoVerifyEmail({
  accessToken,
  code
}) {
  return cognitoClient.send(
    new VerifyUserAttributeCommand({
      AccessToken:
        accessToken,

      AttributeName:
        'email',

      Code:
        code
    })
  )
}


// ==================================================
// RESEND NEW EMAIL VERIFICATION CODE
// ==================================================

export async function cognitoResendEmailCode(
  accessToken
) {
  return cognitoClient.send(
    new GetUserAttributeVerificationCodeCommand({
      AccessToken:
        accessToken,

      AttributeName:
        'email'
    })
  )
}


// ==================================================
// DELETE COGNITO USER
//
// We will NOT call this directly yet.
// First we will build safe AWS/RDS/S3 cleanup.
// ==================================================

export async function cognitoDeleteUser(
  accessToken
) {
  return cognitoClient.send(
    new DeleteUserCommand({
      AccessToken:
        accessToken
    })
  )
}