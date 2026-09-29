import React, {
  useEffect,
  useRef,
  useState
} from 'react'

import {
  cognitoChangePassword,
  cognitoUpdateEmail,
  cognitoVerifyEmail,
  cognitoResendEmailCode
} from '../cognitoClient'

import {
  getAuthAccessToken
} from '../authSession'

import {
  getMyProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  getSteamConnection,
  startSteamLink,
  disconnectSteam,
  updateSteamActivitySharing
} from '../api'

import useEscapeKey from '../hooks/useEscapeKey'


const AVATAR_COLORS = [
  {
    id: 'purple',
    label: 'Purple',
    gradient:
      'linear-gradient(135deg, #646cff, #a78bfa)'
  },
  {
    id: 'red',
    label: 'Red',
    gradient:
      'linear-gradient(135deg, #fc4646, #ff8c00)'
  },
  {
    id: 'green',
    label: 'Green',
    gradient:
      'linear-gradient(135deg, #11998e, #38ef7d)'
  },
  {
    id: 'blue',
    label: 'Blue',
    gradient:
      'linear-gradient(135deg, #2193b0, #6dd5ed)'
  },
  {
    id: 'pink',
    label: 'Pink',
    gradient:
      'linear-gradient(135deg, #f953c6, #b91d73)'
  },
  {
    id: 'gold',
    label: 'Gold',
    gradient:
      'linear-gradient(135deg, #f7971e, #ffd200)'
  }
]


export default function SettingsModal({
  onClose,
  session,
  onAvatarChange
}) {
  useEscapeKey(onClose)
  const [
    activePanel,
    setActivePanel
  ] = useState(null)

  const [
    currentUsername,
    setCurrentUsername
  ] = useState(
    session?.user?.user_metadata?.username ||
    session?.user?.email ||
    '\u2014'
  )

  const [
    newUsername,
    setNewUsername
  ] = useState('')

  const [
    newEmail,
    setNewEmail
  ] = useState('')

  const [
    emailCode,
    setEmailCode
  ] = useState('')

  const [
    emailVerificationPending,
    setEmailVerificationPending
  ] = useState(false)

  const [
    currentPassword,
    setCurrentPassword
  ] = useState('')

  const [
    newPassword,
    setNewPassword
  ] = useState('')

  const [
    confirmPassword,
    setConfirmPassword
  ] = useState('')

  const [
    avatarUrl,
    setAvatarUrl
  ] = useState(null)

  const [
    avatarColor,
    setAvatarColor
  ] = useState('purple')

  const [
    uploadingAvatar,
    setUploadingAvatar
  ] = useState(false)

  const [
    isPrivate,
    setIsPrivate
  ] = useState(false)

  const [
    privacySaving,
    setPrivacySaving
  ] = useState(false)

  const [
    loading,
    setLoading
  ] = useState(false)

  const [
    message,
    setMessage
  ] = useState(null)

  const [
    steamConnection,
    setSteamConnection
  ] = useState({
    connected: false,
    activitySharingEnabled: false
  })

  const [
    steamLoading,
    setSteamLoading
  ] = useState(true)

  const [
    steamActionLoading,
    setSteamActionLoading
  ] = useState(false)

  const [
    steamManageOpen,
    setSteamManageOpen
  ] = useState(false)

  const fileInputRef =
    useRef(null)

  const mountedRef =
    useRef(true)

  const currentEmail =
    session?.user?.email ||
    '\u2014'

  const avatarLetter =
    (currentUsername || '?')
      .charAt(0)
      .toUpperCase()

  const currentColor =
    AVATAR_COLORS.find(
      color =>
        color.id ===
        avatarColor
    ) ||
    AVATAR_COLORS[0]


  // ==================================================
  // LOAD PROFILE FROM AWS
  // ==================================================

  useEffect(() => {
    mountedRef.current =
      true

    async function fetchProfile() {
      try {
        const profile =
          await getMyProfile()

        if (
          !mountedRef.current
        ) {
          return
        }

        setCurrentUsername(
          profile?.username ||
          session?.user
            ?.user_metadata
            ?.username ||
          session?.user?.email ||
          '\u2014'
        )

        setAvatarUrl(
          profile?.avatar_url ||
          null
        )

        setAvatarColor(
          profile?.avatar_color ||
          'purple'
        )

        setIsPrivate(
          profile?.is_private ||
          false
        )
      } catch (error) {
        console.error(
          'Error loading settings profile:',
          error
        )
      }
    }

    async function fetchSteamConnection() {
      try {
        const connection =
          await getSteamConnection()

        if (
          !mountedRef.current
        ) {
          return
        }

        setSteamConnection({
          connected:
            Boolean(
              connection?.connected
            ),

          steamId:
            connection?.steamId ||
            null,

          displayName:
            connection?.displayName ||
            null,

          activitySharingEnabled:
            Boolean(
              connection
                ?.activitySharingEnabled
            ),

          connectedAt:
            connection?.connectedAt ||
            null
        })
      } catch (error) {
        console.error(
          'Error loading Steam connection:',
          error
        )
      } finally {
        if (
          mountedRef.current
        ) {
          setSteamLoading(
            false
          )
        }
      }
    }

    fetchProfile()
    fetchSteamConnection()

    return () => {
      mountedRef.current =
        false
    }
  }, [session])


  // ==================================================
  // PANEL RESET
  // ==================================================

  const resetPanel =
    panel => {
      setActivePanel(
        panel
      )

      setMessage(
        null
      )

      setNewUsername(
        ''
      )

      setNewEmail(
        ''
      )

      setEmailCode(
        ''
      )

      setEmailVerificationPending(
        false
      )

      setCurrentPassword(
        ''
      )

      setNewPassword(
        ''
      )

      setConfirmPassword(
        ''
      )
    }


  // ==================================================
  // CHANGE USERNAME
  //
  // Username is stored in the AWS/RDS profile.
  // ==================================================

  const handleChangeUsername =
    async () => {
      const trimmed =
        newUsername.trim()

      if (!trimmed) {
        return setMessage({
          text:
            'Username cannot be empty.',
          type:
            'error'
        })
      }

      if (
        trimmed ===
        currentUsername
      ) {
        return setMessage({
          text:
            'That is already your username.',
          type:
            'error'
        })
      }

      setLoading(
        true
      )

      setMessage(
        null
      )

      try {
        const profile =
          await updateProfile({
            username:
              trimmed
          })

        if (
          mountedRef.current
        ) {
          setCurrentUsername(
            profile?.username ||
            trimmed
          )

          setNewUsername(
            ''
          )

          setMessage({
            text:
              'Username updated!',
            type:
              'success'
          })
        }
      } catch (error) {
        console.error(
          'Username update error:',
          error
        )

        if (
          mountedRef.current
        ) {
          setMessage({
            text:
              error.message ||
              'Could not change username.',
            type:
              'error'
          })
        }
      } finally {
        if (
          mountedRef.current
        ) {
          setLoading(
            false
          )
        }
      }
    }


  // ==================================================
  // CHANGE EMAIL
  //
  // Cognito is now the only auth provider.
  // ==================================================

  const handleChangeEmail =
    async () => {
      const trimmed =
        newEmail.trim()

      if (!trimmed) {
        return setMessage({
          text:
            'Email cannot be empty.',
          type:
            'error'
        })
      }

      if (
        trimmed.toLowerCase() ===
        currentEmail.toLowerCase()
      ) {
        return setMessage({
          text:
            'That is already your email.',
          type:
            'error'
        })
      }

      setLoading(
        true
      )

      setMessage(
        null
      )

      try {
        const accessToken =
          await getAuthAccessToken()

        if (!accessToken) {
          throw new Error(
            'Your session expired. Please log in again.'
          )
        }

        await cognitoUpdateEmail({
          accessToken,
          email:
            trimmed
        })

        if (
          mountedRef.current
        ) {
          setEmailVerificationPending(
            true
          )

          setMessage({
            text:
              'Verification code sent to your new email.',
            type:
              'success'
          })
        }
      } catch (error) {
        console.error(
          'Email update error:',
          error
        )

        if (
          mountedRef.current
        ) {
          setMessage({
            text:
              error.message ||
              'Could not change email.',
            type:
              'error'
          })
        }
      } finally {
        if (
          mountedRef.current
        ) {
          setLoading(
            false
          )
        }
      }
    }


  // ==================================================
  // VERIFY NEW COGNITO EMAIL
  // ==================================================

  const handleVerifyEmail =
    async () => {
      if (
        !emailCode.trim()
      ) {
        return setMessage({
          text:
            'Enter the verification code.',
          type:
            'error'
        })
      }

      setLoading(
        true
      )

      setMessage(
        null
      )

      try {
        const accessToken =
          await getAuthAccessToken()

        if (!accessToken) {
          throw new Error(
            'Your session expired. Please log in again.'
          )
        }

        await cognitoVerifyEmail({
          accessToken,
          code:
            emailCode.trim()
        })

        if (
          mountedRef.current
        ) {
          setEmailVerificationPending(
            false
          )

          setEmailCode(
            ''
          )

          setNewEmail(
            ''
          )

          setMessage({
            text:
              'Email verified successfully!',
            type:
              'success'
          })
        }
      } catch (error) {
        console.error(
          'Email verification error:',
          error
        )

        if (
          mountedRef.current
        ) {
          setMessage({
            text:
              error.message ||
              'Could not verify email.',
            type:
              'error'
          })
        }
      } finally {
        if (
          mountedRef.current
        ) {
          setLoading(
            false
          )
        }
      }
    }


  // ==================================================
  // RESEND COGNITO EMAIL CODE
  // ==================================================

  const handleResendEmailCode =
    async () => {
      setLoading(
        true
      )

      setMessage(
        null
      )

      try {
        const accessToken =
          await getAuthAccessToken()

        if (!accessToken) {
          throw new Error(
            'Your session expired. Please log in again.'
          )
        }

        await cognitoResendEmailCode(
          accessToken
        )

        if (
          mountedRef.current
        ) {
          setMessage({
            text:
              'A new verification code was sent.',
            type:
              'success'
          })
        }
      } catch (error) {
        console.error(
          'Resend email code error:',
          error
        )

        if (
          mountedRef.current
        ) {
          setMessage({
            text:
              error.message ||
              'Could not resend code.',
            type:
              'error'
          })
        }
      } finally {
        if (
          mountedRef.current
        ) {
          setLoading(
            false
          )
        }
      }
    }


  // ==================================================
  // CHANGE PASSWORD
  //
  // Cognito is now the only auth provider.
  // ==================================================

  const handleChangePassword =
    async () => {
      setMessage(
        null
      )

      if (!currentPassword) {
        return setMessage({
          text:
            'Enter your current password.',
          type:
            'error'
        })
      }

      if (!newPassword) {
        return setMessage({
          text:
            'Password cannot be empty.',
          type:
            'error'
        })
      }

      if (
        newPassword ===
        currentPassword
      ) {
        return setMessage({
          text:
            'Your new password must be different from your current password.',
          type:
            'error'
        })
      }

      if (
        newPassword !==
        confirmPassword
      ) {
        return setMessage({
          text:
            'Passwords do not match.',
          type:
            'error'
        })
      }

      setLoading(
        true
      )

      try {
        const accessToken =
          await getAuthAccessToken()

        if (!accessToken) {
          throw new Error(
            'Your session has expired. Please log in again.'
          )
        }

        await cognitoChangePassword({
          accessToken,
          currentPassword,
          newPassword
        })

        setCurrentPassword(
          ''
        )

        setNewPassword(
          ''
        )

        setConfirmPassword(
          ''
        )

        setMessage({
          text:
            'Password updated successfully!',
          type:
            'success'
        })
      } catch (error) {
        console.error(
          'Password change error:',
          error
        )

        setMessage({
          text:
            error.message ||
            'Could not change password.',
          type:
            'error'
        })
      } finally {
        setLoading(
          false
        )
      }
    }


  // ==================================================
  // AVATAR UPLOAD
  //
  // Browser
  // v
  // Node API
  // v
  // Amazon S3
  // ==================================================

  const handleAvatarUpload =
    async e => {
      const file =
        e.target.files?.[0]

      if (!file) {
        return
      }

      setUploadingAvatar(
        true
      )

      setMessage(
        null
      )

      try {
        const profile =
          await uploadAvatar(
            file
          )

        if (
          !mountedRef.current
        ) {
          return
        }

        setAvatarUrl(
          profile?.avatar_url ||
          null
        )

        setAvatarColor(
          profile?.avatar_color ||
          avatarColor
        )

        onAvatarChange?.(
          profile?.avatar_url ||
            null,
          profile?.avatar_color ||
            avatarColor
        )

        setMessage({
          text:
            'Avatar updated!',
          type:
            'success'
        })
      } catch (error) {
        console.error(
          'Avatar upload error:',
          error
        )

        if (
          mountedRef.current
        ) {
          setMessage({
            text:
              'Upload failed: ' +
              error.message,
            type:
              'error'
          })
        }
      } finally {
        if (
          fileInputRef.current
        ) {
          fileInputRef
            .current
            .value = ''
        }

        if (
          mountedRef.current
        ) {
          setUploadingAvatar(
            false
          )
        }
      }
    }


  // ==================================================
  // RESET AVATAR
  // ==================================================

  const handleResetAvatar =
    async () => {
      setUploadingAvatar(
        true
      )

      setMessage(
        null
      )

      try {
        const profile =
          await deleteAvatar()

        if (
          !mountedRef.current
        ) {
          return
        }

        setAvatarUrl(
          null
        )

        setAvatarColor(
          profile?.avatar_color ||
          avatarColor
        )

        onAvatarChange?.(
          null,
          profile?.avatar_color ||
            avatarColor
        )

        setMessage({
          text:
            'Avatar reset to default.',
          type:
            'success'
        })
      } catch (error) {
        console.error(
          'Avatar reset error:',
          error
        )

        if (
          mountedRef.current
        ) {
          setMessage({
            text:
              error.message,
            type:
              'error'
          })
        }
      } finally {
        if (
          mountedRef.current
        ) {
          setUploadingAvatar(
            false
          )
        }
      }
    }


  // ==================================================
  // AVATAR COLOR
  // ==================================================

  const handleColorPick =
    async colorId => {
      setUploadingAvatar(
        true
      )

      setMessage(
        null
      )

      try {
        await deleteAvatar()

        const profile =
          await updateProfile({
            avatar_color:
              colorId,
            avatar_url:
              null
          })

        if (
          !mountedRef.current
        ) {
          return
        }

        setAvatarColor(
          profile?.avatar_color ||
          colorId
        )

        setAvatarUrl(
          null
        )

        onAvatarChange?.(
          null,
          profile?.avatar_color ||
            colorId
        )

        setMessage({
          text:
            'Avatar color updated!',
          type:
            'success'
        })
      } catch (error) {
        console.error(
          'Avatar color error:',
          error
        )

        if (
          mountedRef.current
        ) {
          setMessage({
            text:
              error.message,
            type:
              'error'
          })
        }
      } finally {
        if (
          mountedRef.current
        ) {
          setUploadingAvatar(
            false
          )
        }
      }
    }


  // ==================================================
  // PRIVACY - AWS
  // ==================================================

  const handlePrivacyToggle =
    async () => {
      const next =
        !isPrivate

      setPrivacySaving(
        true
      )

      try {
        const profile =
          await updateProfile({
            is_private:
              next
          })

        if (
          mountedRef.current
        ) {
          setIsPrivate(
            profile?.is_private ??
            next
          )
        }
      } catch (error) {
        console.error(
          'Privacy update error:',
          error
        )

        if (
          mountedRef.current
        ) {
          setMessage({
            text:
              error.message,
            type:
              'error'
          })
        }
      } finally {
        if (
          mountedRef.current
        ) {
          setPrivacySaving(
            false
          )
        }
      }
    }


  // ==================================================
  // STEAM CONNECTION
  // ==================================================

  const handleConnectSteam =
    async () => {
      if (
        steamActionLoading
      ) {
        return
      }

      setSteamActionLoading(
        true
      )

      setMessage(
        null
      )

      try {
        const result =
          await startSteamLink()

        const authorizationUrl =
          result?.authorizationUrl

        if (
          typeof authorizationUrl !==
            'string'
        ) {
          throw new Error(
            'Steam authorization URL was not returned.'
          )
        }

        const steamUrl =
          new URL(
            authorizationUrl
          )

        if (
          steamUrl.protocol !==
            'https:' ||
          steamUrl.hostname !==
            'steamcommunity.com' ||
          steamUrl.pathname !==
            '/openid/login'
        ) {
          throw new Error(
            'Steam authorization URL was invalid.'
          )
        }

        window.location.assign(
          steamUrl.toString()
        )
      } catch (error) {
        console.error(
          'Steam connection error:',
          error
        )

        if (
          mountedRef.current
        ) {
          setMessage({
            text:
              error.message ||
              'Could not connect Steam.',
            type:
              'error'
          })

          setSteamActionLoading(
            false
          )
        }
      }
    }


  const handleDisconnectSteam =
    async () => {
      if (
        steamActionLoading
      ) {
        return
      }


      setSteamActionLoading(
        true
      )

      setMessage(
        null
      )

      try {
        await disconnectSteam()

        if (
          !mountedRef.current
        ) {
          return
        }

        setSteamConnection({
          connected: false,
          activitySharingEnabled: false
        })

        setSteamManageOpen(
          false
        )

        setMessage({
          text:
            'Steam account disconnected.',
          type:
            'success'
        })
      } catch (error) {
        console.error(
          'Steam disconnect error:',
          error
        )

        if (
          mountedRef.current
        ) {
          setMessage({
            text:
              error.message ||
              'Could not disconnect Steam.',
            type:
              'error'
          })
        }
      } finally {
        if (
          mountedRef.current
        ) {
          setSteamActionLoading(
            false
          )
        }
      }
    }

  const handleSteamActivitySharingToggle =
    async () => {
      if (
        steamActionLoading ||
        !steamConnection.connected
      ) {
        return
      }

      const next =
        !steamConnection
          .activitySharingEnabled

      setSteamActionLoading(
        true
      )

      setMessage(
        null
      )

      try {
        const result =
          await updateSteamActivitySharing(
            next
          )

        if (
          !mountedRef.current
        ) {
          return
        }

        setSteamConnection(
          previous => ({
            ...previous,

            activitySharingEnabled:
              Boolean(
                result
                  ?.activitySharingEnabled
              )
          })
        )

        setMessage({
          text:
            next
              ? 'Steam activity sharing enabled.'
              : 'Steam activity sharing disabled.',

          type:
            'success'
        })
      } catch (error) {
        console.error(
          'Steam activity sharing error:',
          error
        )

        if (
          mountedRef.current
        ) {
          setMessage({
            text:
              error.message ||
              'Could not update Steam activity sharing.',

            type:
              'error'
          })
        }
      } finally {
        if (
          mountedRef.current
        ) {
          setSteamActionLoading(
            false
          )
        }
      }
    }

  const previewGradient =
    avatarUrl
      ? null
      : currentColor.gradient


  return (
    <div
      className="modal-overlay"
    >
      <div
        className="modal settings-modal"
        onClick={
          e =>
            e.stopPropagation()
        }
      >
        <button
          className="close-btn"
          onClick={onClose}
        >
          &times;
        </button>

        <h2 className="settings-title">
          Settings
        </h2>


        {/* ========================================== */}
        {/* ACCOUNT */}
        {/* ========================================== */}

        <div className="settings-section">
          <h3 className="settings-section-heading">
            Account
          </h3>


          {/* USERNAME */}

          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-label">
                Username
              </span>

              <span className="settings-current">
                {currentUsername}
              </span>
            </div>

            <button
              className="settings-edit-btn"
              onClick={() =>
                resetPanel(
                  activePanel ===
                    'username'
                    ? null
                    : 'username'
                )
              }
            >
              {activePanel ===
              'username'
                ? 'Cancel'
                : 'Edit'}
            </button>
          </div>

          {activePanel ===
            'username' && (
            <div className="settings-panel">
              <input
                className="settings-input"
                placeholder="New username"
                value={
                  newUsername
                }
                onChange={
                  e =>
                    setNewUsername(
                      e.target.value
                    )
                }
                onKeyDown={
                  e =>
                    e.key ===
                      'Enter' &&
                    handleChangeUsername()
                }
                autoFocus
              />

              <button
                className="btn-primary settings-save-btn"
                onClick={
                  handleChangeUsername
                }
                disabled={
                  loading
                }
              >
                {loading
                  ? 'Saving\u2026'
                  : 'Save'}
              </button>

              {message && (
                <p
                  className={
                    `settings-msg ${message.type}`
                  }
                >
                  {message.text}
                </p>
              )}
            </div>
          )}


          {/* EMAIL */}

          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-label">
                Email
              </span>

              <span className="settings-current">
                {currentEmail}
              </span>
            </div>

            <button
              className="settings-edit-btn"
              onClick={() =>
                resetPanel(
                  activePanel ===
                    'email'
                    ? null
                    : 'email'
                )
              }
            >
              {activePanel ===
              'email'
                ? 'Cancel'
                : 'Edit'}
            </button>
          </div>

          {activePanel ===
            'email' && (
            <div className="settings-panel">

              {!emailVerificationPending ? (
                <>
                  <input
                    className="settings-input"
                    type="email"
                    placeholder="New email address"
                    value={
                      newEmail
                    }
                    onChange={
                      e =>
                        setNewEmail(
                          e.target.value
                        )
                    }
                    onKeyDown={
                      e =>
                        e.key ===
                          'Enter' &&
                        handleChangeEmail()
                    }
                    autoFocus
                  />

                  <button
                    className="btn-primary settings-save-btn"
                    onClick={
                      handleChangeEmail
                    }
                    disabled={
                      loading
                    }
                  >
                    {loading
                      ? 'Sending\u2026'
                      : 'Save'}
                  </button>
                </>
              ) : (
                <>
                  <p>
                    Enter the verification code
                    sent to your new email.
                  </p>

                  <input
                    className="settings-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="Verification code"
                    value={
                      emailCode
                    }
                    onChange={
                      e =>
                        setEmailCode(
                          e.target.value
                        )
                    }
                    onKeyDown={
                      e =>
                        e.key ===
                          'Enter' &&
                        handleVerifyEmail()
                    }
                    autoFocus
                  />

                  <button
                    className="btn-primary settings-save-btn"
                    onClick={
                      handleVerifyEmail
                    }
                    disabled={
                      loading
                    }
                  >
                    {loading
                      ? 'Verifying\u2026'
                      : 'Verify Email'}
                  </button>

                  <button
                    className="settings-edit-btn"
                    onClick={
                      handleResendEmailCode
                    }
                    disabled={
                      loading
                    }
                  >
                    Resend Code
                  </button>
                </>
              )}

              {message && (
                <p
                  className={
                    `settings-msg ${message.type}`
                  }
                >
                  {message.text}
                </p>
              )}
            </div>
          )}


          {/* PASSWORD */}

          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-label">
                Password
              </span>

              <span className="settings-current">
                {'\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
              </span>
            </div>

            <button
              className="settings-edit-btn"
              onClick={() =>
                resetPanel(
                  activePanel ===
                    'password'
                    ? null
                    : 'password'
                )
              }
            >
              {activePanel ===
              'password'
                ? 'Cancel'
                : 'Change'}
            </button>
          </div>

          {activePanel ===
            'password' && (
            <div className="settings-panel">
              <input
                className="settings-input"
                type="password"
                placeholder="Current password"
                value={
                  currentPassword
                }
                onChange={
                  e =>
                    setCurrentPassword(
                      e.target.value
                    )
                }
                autoFocus
              />

              <input
                className="settings-input"
                type="password"
                placeholder="New password"
                value={
                  newPassword
                }
                onChange={
                  e =>
                    setNewPassword(
                      e.target.value
                    )
                }
              />

              <input
                className="settings-input"
                type="password"
                placeholder="Confirm new password"
                value={
                  confirmPassword
                }
                onChange={
                  e =>
                    setConfirmPassword(
                      e.target.value
                    )
                }
                onKeyDown={
                  e =>
                    e.key ===
                      'Enter' &&
                    handleChangePassword()
                }
              />

              <button
                className="btn-primary settings-save-btn"
                onClick={
                  handleChangePassword
                }
                disabled={
                  loading
                }
              >
                {loading
                  ? 'Saving\u2026'
                  : 'Save'}
              </button>

              {message && (
                <p
                  className={
                    `settings-msg ${message.type}`
                  }
                >
                  {message.text}
                </p>
              )}
            </div>
          )}
        </div>


        {/* ========================================== */}
        {/* CONNECTED ACCOUNTS */}
        {/* ========================================== */}

        <div className="settings-section">
          <h3 className="settings-section-heading">
            Connected Accounts
          </h3>

          <div className="settings-row steam-account-row">
            <div className="settings-row-left">
              <span className="settings-label">
                Steam
              </span>

              <span className="settings-current">
                {steamLoading
                  ? 'Checking connection...'
                  : steamConnection.connected
                    ? 'Connected'
                    : 'Not connected'}
              </span>
            </div>

            {!steamLoading && (
              <button
                type="button"
                className={
                  `steam-integration-btn ${
                    steamConnection.connected
                      ? 'connected'
                      : ''
                  }`
                }
                onClick={
                  steamConnection.connected
                    ? () => {
                        setSteamManageOpen(
                          previous =>
                            !previous
                        )

                        setMessage(
                          null
                        )
                      }
                    : handleConnectSteam
                }
                disabled={
                  steamActionLoading
                }
                aria-label={
                  steamConnection.connected
                    ? 'Manage Steam connection'
                    : 'Connect Steam'
                }
                aria-expanded={
                  steamConnection.connected
                    ? steamManageOpen
                    : undefined
                }
                aria-controls={
                  steamConnection.connected
                    ? 'steam-connection-management'
                    : undefined
                }
                data-tooltip={
                  steamConnection.connected
                    ? 'Manage Steam connection'
                    : 'Connect Steam'
                }
              >
                <img
                  src="/steam.svg"
                  alt=""
                  aria-hidden="true"
                  className="steam-integration-icon"
                />

                {steamConnection.connected && (
                  <span
                    className="steam-connected-dot"
                    aria-hidden="true"
                  />
                )}
              </button>
            )}
          </div>

          {steamManageOpen &&
            steamConnection.connected && (
            <div
              id="steam-connection-management"
              className="steam-manage-panel"
              role="region"
              aria-labelledby="steam-manage-title"
            >
              <div className="steam-manage-copy">
                <span
                  id="steam-manage-title"
                  className="settings-label"
                >
                  Manage Steam connection
                </span>

                <span className="settings-current">
                  Disconnecting removes your linked
                  Steam account and turns off Steam
                  activity sharing.
                </span>
              </div>

              <div className="steam-manage-actions">
                <button
                  type="button"
                  className="steam-manage-cancel"
                  onClick={() =>
                    setSteamManageOpen(
                      false
                    )
                  }
                  disabled={
                    steamActionLoading
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="steam-manage-disconnect"
                  onClick={
                    handleDisconnectSteam
                  }
                  disabled={
                    steamActionLoading
                  }
                >
                  {steamActionLoading
                    ? 'Disconnecting...'
                    : 'Disconnect'}
                </button>
              </div>
            </div>
          )}

          {steamConnection.connected && (
            <div className="settings-row">
              <div className="settings-row-left">
                <span className="settings-label">
                  Share current Steam activity
                </span>

                <span className="settings-current">
                  {steamConnection.activitySharingEnabled
                    ? 'NestPlay can show the game you are currently playing'
                    : 'Current Steam activity is not shared'}
                </span>
              </div>

              <button
                className={
                  `settings-toggle-btn ${
                    steamConnection.activitySharingEnabled
                      ? 'toggled'
                      : ''
                  }`
                }
                onClick={
                  handleSteamActivitySharingToggle
                }
                disabled={
                  steamActionLoading
                }
              >
                {steamActionLoading
                  ? '\u2026'
                  : steamConnection.activitySharingEnabled
                    ? 'On'
                    : 'Off'}
              </button>
            </div>
          )}


          <div
            className="settings-current"
            style={{
              marginTop:
                '0.5rem',
              lineHeight:
                '1.5'
            }}
          >
            Connecting Steam lets NestPlay verify
            your Steam account. Steam activity
            sharing remains off by default.
          </div>
        </div>

        {/* ========================================== */}
        {/* PROFILE */}
        {/* ========================================== */}

        <div className="settings-section">
          <h3 className="settings-section-heading">
            Profile
          </h3>


          {/* AVATAR */}

          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-label">
                Avatar
              </span>

              <span className="settings-current">
                {avatarUrl
                  ? 'Custom photo'
                  : `Letter (${currentColor.label})`}
              </span>
            </div>

            <button
              className="settings-edit-btn"
              onClick={() =>
                resetPanel(
                  activePanel ===
                    'avatar'
                    ? null
                    : 'avatar'
                )
              }
            >
              {activePanel ===
              'avatar'
                ? 'Cancel'
                : 'Edit'}
            </button>
          </div>

          {activePanel ===
            'avatar' && (
            <div className="settings-panel">
              <div className="avatar-preview-row">
                {avatarUrl ? (
                  <img
                    src={
                      avatarUrl
                    }
                    alt="avatar"
                    className="avatar-preview-img"
                  />
                ) : (
                  <div
                    className="avatar-preview-letter"
                    style={{
                      background:
                        previewGradient
                    }}
                  >
                    {
                      avatarLetter
                    }
                  </div>
                )}

                <div className="avatar-preview-actions">
                  <button
                    className="btn-primary settings-save-btn"
                    style={{
                      alignSelf:
                        'flex-start'
                    }}
                    onClick={() =>
                      fileInputRef
                        .current
                        ?.click()
                    }
                    disabled={
                      uploadingAvatar
                    }
                  >
                    {uploadingAvatar
                      ? 'Uploading\u2026'
                      : 'Upload Photo'}
                  </button>

                  {avatarUrl && (
                    <button
                      className="settings-edit-btn"
                      onClick={
                        handleResetAvatar
                      }
                      disabled={
                        uploadingAvatar
                      }
                    >
                      Reset to Default
                    </button>
                  )}
                </div>

                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,image/bmp"
                  style={{
                    display:
                      'none'
                  }}
                  onChange={
                    handleAvatarUpload
                  }
                />
              </div>

              {!avatarUrl && (
                <>
                  <p className="settings-color-label">
                    Or pick a color:
                  </p>

                  <div className="avatar-color-grid">
                    {AVATAR_COLORS.map(
                      color => (
                        <button
                          key={
                            color.id
                          }
                          className={
                            `avatar-color-swatch ${
                              avatarColor ===
                              color.id
                                ? 'selected'
                                : ''
                            }`
                          }
                          style={{
                            background:
                              color.gradient
                          }}
                          onClick={() =>
                            handleColorPick(
                              color.id
                            )
                          }
                          title={
                            color.label
                          }
                        />
                      )
                    )}
                  </div>
                </>
              )}

              {message && (
                <p
                  className={
                    `settings-msg ${message.type}`
                  }
                >
                  {message.text}
                </p>
              )}
            </div>
          )}


          {/* PRIVACY */}

          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-label">
                Profile Visibility
              </span>

              <span
                className="settings-current"
                style={{
                  color:
                    isPrivate
                      ? '#ff9800'
                      : '#4caf50'
                }}
              >
                {isPrivate
                  ? '\u{1F512} Private \u2014 only you can see your posts'
                  : '\u{1F310} Public \u2014 everyone can see your posts'}
              </span>
            </div>

            <button
              className={
                `settings-toggle-btn ${
                  isPrivate
                    ? 'toggled'
                    : ''
                }`
              }
              onClick={
                handlePrivacyToggle
              }
              disabled={
                privacySaving
              }
            >
              {privacySaving
                ? '\u2026'
                : isPrivate
                  ? 'Make Public'
                  : 'Make Private'}
            </button>
          </div>
        </div>


        {/* ========================================== */}
        {/* DANGER ZONE */}
        {/* ========================================== */}

        <div className="settings-section danger-zone">
          <h3 className="settings-section-heading danger-heading">
            Danger Zone
          </h3>

          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-label">
                Delete Account
              </span>

              <span
                className="settings-current"
                style={{
                  color:
                    '#888'
                }}
              >
                Temporarily unavailable
              </span>
            </div>

            <button
              className="settings-edit-btn danger-btn"
              disabled
              style={{
                opacity:
                  0.5,

                cursor:
                  'not-allowed'
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}