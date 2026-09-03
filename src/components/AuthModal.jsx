import React, {
  useState
} from 'react'

import {
  supabase
} from '../supabaseClient'

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


export default function AuthModal({
  mode,
  onClose,
  onAuthSuccess
}) {
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

  // ----------------------------------------------
  // Existing-account migration information
  // ----------------------------------------------

  const [
    legacyToken,
    setLegacyToken
  ] = useState(null)

  const [
    legacyUsername,
    setLegacyUsername
  ] = useState('')

  const [
    legacyEmail,
    setLegacyEmail
  ] = useState('')

  const [
    migrationPassword,
    setMigrationPassword
  ] = useState('')


  // ==================================================
  // NEW ACCOUNT BOOTSTRAP
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
  // ==================================================

  const finishAuth =
    async authenticationResult => {
      saveCognitoTokens(
        authenticationResult
      )

      // Remove legacy session.
      try {
        await supabase.auth.signOut()
      } catch {
        // Nothing else needed.
      }

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
  // NEW COGNITO ACCOUNT
  //
  // Only new users are allowed to create
  // a brand-new RDS profile here.
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
  // IMPORTANT:
  // We do NOT bootstrap an unmapped Cognito user
  // from a normal login.
  //
  // This prevents accidentally making a duplicate
  // RDS profile during an interrupted migration.
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

      if (response.status === 403) {
        throw new Error(
          'This Cognito account has not finished migrating yet. Log in using your original account email to finish the migration.'
        )
      }

      if (!response.ok) {
        throw new Error(
          'Could not verify your Cognito account.'
        )
      }

      await finishAuth(
        authenticationResult
      )
    }


  // ==================================================
  // LOAD EXISTING AWS PROFILE USING
  // VERIFIED SUPABASE TOKEN
  // ==================================================

  const loadLegacyProfile =
    async token => {
      const response =
        await fetch(
          `${API_URL}/api/profile`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`
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

      if (!response.ok) {
        throw new Error(
          data.error ||
          'Could not load your existing NestPlay profile.'
        )
      }

      return data
    }


  // ==================================================
  // LINK EXISTING PROFILE
  // ==================================================

  const linkExistingAccount =
    async authenticationResult => {
      const cognitoToken =
        authenticationResult
          ?.AccessToken

      if (!cognitoToken) {
        throw new Error(
          'Cognito access token is missing.'
        )
      }

      if (!legacyToken) {
        throw new Error(
          'Your original login session expired. Please start again.'
        )
      }

      const response =
        await fetch(
          `${API_URL}/api/auth/cognito/link`,
          {
            method: 'POST',

            headers: {
              Authorization:
                `Bearer ${cognitoToken}`,

              'X-Legacy-Authorization':
                `Bearer ${legacyToken}`,

              'Content-Type':
                'application/json'
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

      if (!response.ok) {
        throw new Error(
          data.error ||
          'Could not migrate your account.'
        )
      }

      await finishAuth(
        authenticationResult
      )
    }


  // ==================================================
  // NEW ACCOUNT SIGN UP
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
  // RESEND NEW ACCOUNT CODE
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
  // 1. Try Cognito
  // 2. If that fails, try existing Supabase account
  // 3. If Supabase succeeds, begin migration
  // ==================================================

  const handleLogin =
    async e => {
      e.preventDefault()

      setError('')
      setMessage('')
      setLoading(true)

      const cleanLogin =
        login.trim()

      let cognitoError = null


      // ----------------------------------------------
      // FIRST: COGNITO
      // ----------------------------------------------

      try {
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

        return
      } catch (err) {
        cognitoError = err

        clearCognitoTokens()

        console.log(
          'Cognito login failed. Checking for an existing NestPlay account.'
        )
      }


      // ----------------------------------------------
      // LEGACY ACCOUNTS USED EMAIL LOGIN
      // ----------------------------------------------

      if (
        !cleanLogin.includes('@')
      ) {
        setError(
          cognitoError?.message ||
          'Incorrect username or password.'
        )

        setLoading(false)

        return
      }


      // ----------------------------------------------
      // VERIFY OLD SUPABASE ACCOUNT
      // ----------------------------------------------

      try {
        const {
          data,
          error:
            legacyError
        } =
          await supabase.auth
            .signInWithPassword({
              email:
                cleanLogin,

              password
            })

        if (
          legacyError ||
          !data?.session
        ) {
          throw (
            legacyError ||
            new Error(
              'Legacy login failed.'
            )
          )
        }

        const oldToken =
          data.session
            .access_token

        const profile =
          await loadLegacyProfile(
            oldToken
          )

        if (!profile?.username) {
          throw new Error(
            'Your existing NestPlay profile does not have a username.'
          )
        }

        setLegacyToken(
          oldToken
        )

        setLegacyUsername(
          profile.username
        )

        setLegacyEmail(
          data.session.user.email ||
          cleanLogin
        )

        // Start with their existing password.
        // They may change it if Cognito's
        // password policy requires it.
        setMigrationPassword(
          password
        )

        setStep(
          'migrate'
        )

        setMessage(
          'Existing NestPlay account found.'
        )
      } catch {
        setError(
          cognitoError?.message ||
          'Incorrect email or password.'
        )
      } finally {
        setLoading(false)
      }
    }


  // ==================================================
  // START EXISTING ACCOUNT MIGRATION
  // ==================================================

  const handleMigrationStart =
    async e => {
      e.preventDefault()

      setError('')
      setMessage('')
      setLoading(true)

      try {
        let signUpResult

        try {
          signUpResult =
            await cognitoSignUp({
              username:
                legacyUsername,

              email:
                legacyEmail,

              password:
                migrationPassword
            })
        } catch (signUpError) {
          // ------------------------------------------
          // This can happen if migration was started
          // previously but wasn't completed.
          // ------------------------------------------

          if (
            signUpError?.name ===
            'UsernameExistsException'
          ) {
            try {
              const loginResult =
                await cognitoSignIn({
                  login:
                    legacyUsername,

                  password:
                    migrationPassword
                })

              await linkExistingAccount(
                loginResult
                  .AuthenticationResult
              )

              return
            } catch (
              existingLoginError
            ) {
              if (
                existingLoginError
                  ?.name ===
                'UserNotConfirmedException'
              ) {
                await cognitoResendCode(
                  legacyUsername
                )

                setStep(
                  'migrate-confirm'
                )

                setMessage(
                  `A new confirmation code was sent to ${legacyEmail}.`
                )

                return
              }

              throw new Error(
                'A Cognito account with this username already exists. If you previously started migration, enter the password you used for that migration.'
              )
            }
          }

          throw signUpError
        }


        // --------------------------------------------
        // Cognito immediately confirmed
        // --------------------------------------------

        if (
          signUpResult.UserConfirmed
        ) {
          const loginResult =
            await cognitoSignIn({
              login:
                legacyUsername,

              password:
                migrationPassword
            })

          await linkExistingAccount(
            loginResult
              .AuthenticationResult
          )

          return
        }


        // --------------------------------------------
        // Normal email-code confirmation
        // --------------------------------------------

        setStep(
          'migrate-confirm'
        )

        setMessage(
          `We sent a confirmation code to ${legacyEmail}.`
        )
      } catch (err) {
        console.error(
          'Account migration error:',
          err
        )

        setError(
          err.message ||
          'Could not start migration.'
        )
      } finally {
        setLoading(false)
      }
    }


  // ==================================================
  // CONFIRM EXISTING ACCOUNT MIGRATION
  // ==================================================

  const handleMigrationConfirm =
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
            legacyUsername,

          code:
            code.trim()
        })

        const loginResult =
          await cognitoSignIn({
            login:
              legacyUsername,

            password:
              migrationPassword
          })

        await linkExistingAccount(
          loginResult
            .AuthenticationResult
        )
      } catch (err) {
        console.error(
          'Migration confirmation error:',
          err
        )

        setError(
          err.message ||
          'Could not complete migration.'
        )
      } finally {
        setLoading(false)
      }
    }


  // ==================================================
  // RESEND MIGRATION CODE
  // ==================================================

  const handleMigrationResend =
    async () => {
      setError('')
      setMessage('')
      setLoading(true)

      try {
        await cognitoResendCode(
          legacyUsername
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


  const inputStyle = {
    padding: '0.8rem',
    borderRadius: '6px',
    border:
      '1px solid #333',
    background:
      '#1a1a1a',
    color: '#fff',
    width: '100%',
    boxSizing:
      'border-box'
  }


  // ==================================================
  // EXISTING ACCOUNT MIGRATION SCREEN
  // ==================================================

  if (
    mode === 'login' &&
    step === 'migrate'
  ) {
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

          <div
            style={{
              fontSize:
                '2.5rem',
              textAlign:
                'center',
              marginBottom:
                '0.75rem'
            }}
          >
            🎮
          </div>

          <h2
            style={{
              marginTop: 0,
              textAlign:
                'center'
            }}
          >
            Migrate Your Account
          </h2>

          <p
            style={{
              color: '#aaa',
              lineHeight: 1.6,
              textAlign:
                'center'
            }}
          >
            We found your existing
            NestPlay account{' '}

            <strong
              style={{
                color: '#fff'
              }}
            >
              @{legacyUsername}
            </strong>

            .
          </p>

          <p
            style={{
              color: '#aaa',
              lineHeight: 1.6,
              textAlign:
                'center'
            }}
          >
            This will move your login
            to AWS Cognito while keeping
            your existing profile,
            posts, votes, friends and
            messages.
          </p>

          <form
            onSubmit={
              handleMigrationStart
            }
            style={{
              display: 'flex',
              flexDirection:
                'column',
              gap: '1rem'
            }}
          >
            <input
              type="email"
              value={
                legacyEmail
              }
              disabled
              style={{
                ...inputStyle,
                opacity: 0.7
              }}
            />

            <input
              type="password"
              placeholder="Cognito password"
              value={
                migrationPassword
              }
              onChange={e =>
                setMigrationPassword(
                  e.target.value
                )
              }
              required
              style={
                inputStyle
              }
            />

            <div
              style={{
                color: '#888',
                fontSize:
                  '0.8rem',
                lineHeight: 1.5
              }}
            >
              You can keep your
              existing password, or
              choose a new one if
              Cognito requires a
              stronger password.
            </div>

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
                padding:
                  '0.8rem'
              }}
            >
              {
                loading
                  ? 'Starting Migration...'
                  : 'Migrate Account'
              }
            </button>
          </form>
        </div>
      </div>
    )
  }


  // ==================================================
  // MIGRATION CONFIRMATION SCREEN
  // ==================================================

  if (
    mode === 'login' &&
    step ===
      'migrate-confirm'
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
            Confirm Migration
          </h2>

          <p
            style={{
              color: '#aaa',
              lineHeight: 1.6
            }}
          >
            Enter the code sent to{' '}

            <strong
              style={{
                color: '#fff'
              }}
            >
              {legacyEmail}
            </strong>
          </p>

          <form
            onSubmit={
              handleMigrationConfirm
            }
            style={{
              display: 'flex',
              flexDirection:
                'column',
              gap: '1rem'
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
                  ? 'Migrating...'
                  : 'Finish Migration'
              }
            </button>

            <button
              type="button"
              disabled={loading}
              className="btn-ghost"
              onClick={
                handleMigrationResend
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
  // NEW ACCOUNT CONFIRMATION
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
              color: '#aaa',
              lineHeight: 1.6
            }}
          >
            Enter the confirmation
            code sent to{' '}

            <strong
              style={{
                color: '#fff'
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
              display: 'flex',
              flexDirection:
                'column',
              gap: '1rem'
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
          maxWidth: '400px'
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
            marginTop: 0,
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
              display: 'flex',
              flexDirection:
                'column',
              gap: '1rem'
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
              display: 'flex',
              flexDirection:
                'column',
              gap: '1rem'
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