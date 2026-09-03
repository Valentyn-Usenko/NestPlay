import React, {
  useState
} from 'react'

import {
  API_BASE_URL as API_URL
} from '../config'

import {
  cognitoSignUp,
  cognitoConfirmSignUp,
  cognitoResendCode,
  cognitoSignIn
} from '../cognitoClient'

import {
  saveCognitoTokens,
  clearCognitoTokens
} from '../authSession'

import useEscapeKey from '../hooks/useEscapeKey'


export default function AuthModal({
  mode,
  onClose,
  onAuthSuccess
}) {
  useEscapeKey(onClose)
  
  const [email, setEmail] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [username, setUsername] =
    useState('')

  const [login, setLogin] =
    useState('')

  const [code, setCode] =
    useState('')

  const [step, setStep] =
    useState('form')

  const [error, setError] =
    useState('')

  const [message, setMessage] =
    useState('')

  const [loading, setLoading] =
    useState(false)


  // ==================================================
  // NEW ACCOUNT BOOTSTRAP
  //
  // Creates the RDS profile after Cognito signup.
  // ==================================================

  const bootstrapCognitoProfile =
    async (
      authenticationResult,
      profileUsername
    ) => {
      const accessToken =
        authenticationResult
          ?.AccessToken

      if (!accessToken) {
        throw new Error(
          'Cognito did not return an access token.'
        )
      }

      const response =
        await fetch(
          `${API_URL}/api/auth/cognito/bootstrap`,
          {
            method: 'POST',

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({
                username:
                  profileUsername.trim()
              })
          }
        )

      let data = {}

      try {
        data =
          await response.json()
      } catch {
        data = {}
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          'Could not create your NestPlay profile.'
        )
      }

      return data
    }


  // ==================================================
  // FINISH AUTH
  //
  // Saves Cognito tokens and refreshes App session.
  // ==================================================

  const finishAuth =
    async authenticationResult => {
      saveCognitoTokens(
        authenticationResult
      )

      window.dispatchEvent(
        new Event(
          'nestplay-auth-changed'
        )
      )

      if (onAuthSuccess) {
        await onAuthSuccess()
      }

      onClose()
    }


  // ==================================================
  // FINISH NEW ACCOUNT
  // ==================================================

  const finishNewAccount =
    async (
      authenticationResult,
      profileUsername
    ) => {
      await bootstrapCognitoProfile(
        authenticationResult,
        profileUsername
      )

      await finishAuth(
        authenticationResult
      )
    }


  // ==================================================
  // NORMAL COGNITO LOGIN
  //
  // A Cognito account must already have an RDS
  // profile mapping.
  // ==================================================

  const finishCognitoLogin =
    async authenticationResult => {
      const accessToken =
        authenticationResult
          ?.AccessToken

      if (!accessToken) {
        throw new Error(
          'Cognito did not return an access token.'
        )
      }

      const response =
        await fetch(
          `${API_URL}/api/profile`,
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`
            }
          }
        )

      let data = {}

      try {
        data =
          await response.json()
      } catch {
        data = {}
      }

      if (
        response.status === 401
      ) {
        throw new Error(
          'Your login session could not be verified.'
        )
      }

      if (
        response.status === 403
      ) {
        throw new Error(
          'This Cognito account is not linked to a NestPlay profile.'
        )
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          'Could not verify your Cognito account.'
        )
      }

      await finishAuth(
        authenticationResult
      )
    }


  // ==================================================
  // SIGN UP
  // ==================================================

  const handleSignUp =
    async e => {
      e.preventDefault()

      setError('')
      setMessage('')

      const cleanUsername =
        username.trim()

      const cleanEmail =
        email.trim()

      if (
        cleanUsername.length < 3
      ) {
        setError(
          'Username must be at least 3 characters.'
        )

        return
      }

      if (!cleanEmail) {
        setError(
          'Email cannot be empty.'
        )

        return
      }

      if (!password) {
        setError(
          'Password cannot be empty.'
        )

        return
      }

      setLoading(true)

      try {
        const result =
          await cognitoSignUp({
            username:
              cleanUsername,

            email:
              cleanEmail,

            password
          })

        // Cognito may immediately confirm
        // depending on pool configuration.
        if (result.UserConfirmed) {
          const loginResult =
            await cognitoSignIn({
              login:
                cleanUsername,

              password
            })

          await finishNewAccount(
            loginResult
              .AuthenticationResult,

            cleanUsername
          )

          return
        }

        setStep(
          'new-confirm'
        )

        setMessage(
          `We sent a confirmation code to ${cleanEmail}.`
        )
      } catch (err) {
        console.error(
          'Cognito signup error:',
          err
        )

        setError(
          err.message ||
          'Could not create account.'
        )
      } finally {
        setLoading(false)
      }
    }


  // ==================================================
  // CONFIRM NEW ACCOUNT
  // ==================================================

  const handleNewConfirm =
    async e => {
      e.preventDefault()

      setError('')
      setMessage('')

      if (!code.trim()) {
        setError(
          'Enter the confirmation code.'
        )

        return
      }

      setLoading(true)

      try {
        await cognitoConfirmSignUp({
          username:
            username.trim(),

          code:
            code.trim()
        })

        const loginResult =
          await cognitoSignIn({
            login:
              username.trim(),

            password
          })

        await finishNewAccount(
          loginResult
            .AuthenticationResult,

          username.trim()
        )
      } catch (err) {
        console.error(
          'Confirmation error:',
          err
        )

        setError(
          err.message ||
          'Could not confirm account.'
        )
      } finally {
        setLoading(false)
      }
    }


  // ==================================================
  // RESEND CONFIRMATION CODE
  // ==================================================

  const handleNewResend =
    async () => {
      setError('')
      setMessage('')
      setLoading(true)

      try {
        await cognitoResendCode(
          username.trim()
        )

        setMessage(
          'A new confirmation code was sent.'
        )
      } catch (err) {
        setError(
          err.message ||
          'Could not resend code.'
        )
      } finally {
        setLoading(false)
      }
    }


  // ==================================================
  // LOGIN
  //
  // Cognito is now the only authentication provider.
  // ==================================================

  const handleLogin =
    async e => {
      e.preventDefault()

      setError('')
      setMessage('')
      setLoading(true)

      const cleanLogin =
        login.trim()

      if (!cleanLogin) {
        setError(
          'Enter your email or username.'
        )

        setLoading(false)

        return
      }

      if (!password) {
        setError(
          'Enter your password.'
        )

        setLoading(false)

        return
      }

      try {
        clearCognitoTokens()

        const result =
          await cognitoSignIn({
            login:
              cleanLogin,

            password
          })

        const authResult =
          result.AuthenticationResult

        if (
          !authResult
            ?.AccessToken
        ) {
          throw new Error(
            'Cognito requires an additional authentication step that NestPlay does not support yet.'
          )
        }

        await finishCognitoLogin(
          authResult
        )
      } catch (err) {
        clearCognitoTokens()

        console.error(
          'Cognito login error:',
          err
        )

        setError(
          err.message ||
          'Incorrect email, username, or password.'
        )
      } finally {
        setLoading(false)
      }
    }


  const inputStyle = {
    padding:
      '0.8rem',

    borderRadius:
      '6px',

    border:
      '1px solid #333',

    background:
      '#1a1a1a',

    color:
      '#fff',

    width:
      '100%',

    boxSizing:
      'border-box'
  }


  // ==================================================
  // NEW ACCOUNT CONFIRMATION SCREEN
  // ==================================================

  if (
    mode === 'signup' &&
    step === 'new-confirm'
  ) {
    return (
      <div className="modal-overlay">
        <div
          className="modal"
          style={{
            maxWidth:
              '400px',

            textAlign:
              'center'
          }}
        >
          <button
            className="close-btn"
            onClick={onClose}
          >
            ×
          </button>

          <div
            style={{
              fontSize:
                '2.5rem',

              marginBottom:
                '1rem'
            }}
          >
            📬
          </div>

          <h2>
            Check your email
          </h2>

          <p
            style={{
              color:
                '#aaa',

              lineHeight:
                1.6
            }}
          >
            Enter the confirmation
            code sent to{' '}

            <strong
              style={{
                color:
                  '#fff'
              }}
            >
              {email}
            </strong>
          </p>

          <form
            onSubmit={
              handleNewConfirm
            }
            style={{
              display:
                'flex',

              flexDirection:
                'column',

              gap:
                '1rem'
            }}
          >
            <input
              type="text"
              inputMode="numeric"
              placeholder="Confirmation code"
              value={code}
              onChange={e =>
                setCode(
                  e.target.value
                )
              }
              required
              style={
                inputStyle
              }
            />

            {message && (
              <div
                style={{
                  color:
                    '#7ee787',

                  fontSize:
                    '0.9rem'
                }}
              >
                {message}
              </div>
            )}

            {error && (
              <div
                style={{
                  color:
                    '#fc4646',

                  fontSize:
                    '0.9rem'
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                padding:
                  '0.8rem'
              }}
            >
              {
                loading
                  ? 'Confirming...'
                  : 'Confirm Account'
              }
            </button>

            <button
              type="button"
              disabled={loading}
              className="btn-ghost"
              onClick={
                handleNewResend
              }
            >
              Resend Code
            </button>
          </form>
        </div>
      </div>
    )
  }


  // ==================================================
  // NORMAL LOGIN / SIGNUP
  // ==================================================

  return (
    <div className="modal-overlay">
      <div
        className="modal"
        style={{
          maxWidth:
            '400px'
        }}
      >
        <button
          className="close-btn"
          onClick={onClose}
        >
          ×
        </button>

        <h2
          style={{
            marginTop:
              0,

            marginBottom:
              '1.5rem'
          }}
        >
          {
            mode === 'signup'
              ? 'Create an Account'
              : 'Welcome Back'
          }
        </h2>

        {mode === 'signup' ? (
          <form
            onSubmit={
              handleSignUp
            }
            style={{
              display:
                'flex',

              flexDirection:
                'column',

              gap:
                '1rem'
            }}
          >
            <input
              type="text"
              placeholder="Username (min. 3 characters)"
              value={username}
              onChange={e =>
                setUsername(
                  e.target.value
                )
              }
              required
              style={
                inputStyle
              }
            />

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e =>
                setEmail(
                  e.target.value
                )
              }
              required
              style={
                inputStyle
              }
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e =>
                setPassword(
                  e.target.value
                )
              }
              required
              style={
                inputStyle
              }
            />

            {message && (
              <div
                style={{
                  color:
                    '#7ee787',

                  fontSize:
                    '0.9rem',

                  textAlign:
                    'center'
                }}
              >
                {message}
              </div>
            )}

            {error && (
              <div
                style={{
                  color:
                    '#fc4646',

                  fontSize:
                    '0.9rem',

                  textAlign:
                    'center'
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                marginTop:
                  '0.5rem',

                padding:
                  '0.8rem'
              }}
            >
              {
                loading
                  ? 'Creating Account...'
                  : 'Sign Up'
              }
            </button>
          </form>
        ) : (
          <form
            onSubmit={
              handleLogin
            }
            style={{
              display:
                'flex',

              flexDirection:
                'column',

              gap:
                '1rem'
            }}
          >
            <input
              type="text"
              placeholder="Email or username"
              value={login}
              onChange={e =>
                setLogin(
                  e.target.value
                )
              }
              required
              style={
                inputStyle
              }
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e =>
                setPassword(
                  e.target.value
                )
              }
              required
              style={
                inputStyle
              }
            />

            {message && (
              <div
                style={{
                  color:
                    '#7ee787',

                  fontSize:
                    '0.9rem',

                  textAlign:
                    'center'
                }}
              >
                {message}
              </div>
            )}

            {error && (
              <div
                style={{
                  color:
                    '#fc4646',

                  fontSize:
                    '0.9rem',

                  textAlign:
                    'center'
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                marginTop:
                  '0.5rem',

                padding:
                  '0.8rem'
              }}
            >
              {
                loading
                  ? 'Logging In...'
                  : 'Log In'
              }
            </button>
          </form>
        )}
      </div>
    </div>
  )
}