import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

const AVATAR_COLORS = [
  { id: 'purple', label: 'Purple', gradient: 'linear-gradient(135deg, #646cff, #a78bfa)' },
  { id: 'red', label: 'Red', gradient: 'linear-gradient(135deg, #fc4646, #ff8c00)' },
  { id: 'green', label: 'Green', gradient: 'linear-gradient(135deg, #11998e, #38ef7d)' },
  { id: 'blue', label: 'Blue', gradient: 'linear-gradient(135deg, #2193b0, #6dd5ed)' },
  { id: 'pink', label: 'Pink', gradient: 'linear-gradient(135deg, #f953c6, #b91d73)' },
  { id: 'gold', label: 'Gold', gradient: 'linear-gradient(135deg, #f7971e, #ffd200)' },
]

export default function SettingsModal({ onClose, session, onAvatarChange }) {
  const [activePanel, setActivePanel] = useState(null)

  const [newUsername, setNewUsername] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarColor, setAvatarColor] = useState('purple')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef()

  const [isPrivate, setIsPrivate] = useState(false)
  const [privacySaving, setPrivacySaving] = useState(false)

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const currentUsername = session?.user?.user_metadata?.username || '—'
  const currentEmail = session?.user?.email || '—'
  const avatarLetter = currentUsername.charAt(0).toUpperCase()
  const currentColor = AVATAR_COLORS.find(c => c.id === avatarColor) || AVATAR_COLORS[0]

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url, avatar_color, is_private')
        .eq('id', session.user.id)
        .single()
      if (data) {
        setAvatarUrl(data.avatar_url || null)
        setAvatarColor(data.avatar_color || 'purple')
        setIsPrivate(data.is_private || false)
      }
    }
    fetchProfile()
  }, [session])

  const resetPanel = (panel) => {
    setActivePanel(panel)
    setMessage(null)
    setNewUsername('')
    setNewEmail('')
    setNewPassword('')
    setConfirmPassword('')
    setDeleteConfirm('')
  }

  const handleChangeUsername = async () => {
    if (!newUsername.trim()) return setMessage({ text: 'Username cannot be empty.', type: 'error' })
    if (newUsername.trim() === currentUsername) return setMessage({ text: 'That is already your username.', type: 'error' })
    setLoading(true)
    const trimmed = newUsername.trim()
    const { error } = await supabase.auth.updateUser({ data: { username: trimmed } })
    if (!error) await supabase.from('profiles').upsert({ id: session.user.id, username: trimmed })
    setLoading(false)
    if (error) return setMessage({ text: error.message, type: 'error' })
    setMessage({ text: 'Username updated!', type: 'success' })
  }

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return setMessage({ text: 'Email cannot be empty.', type: 'error' })
    if (newEmail.trim() === currentEmail) return setMessage({ text: 'That is already your email.', type: 'error' })
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setLoading(false)
    if (error) return setMessage({ text: error.message, type: 'error' })
    setMessage({ text: 'Confirmation sent to your new email. Check your inbox!', type: 'success' })
  }

  const handleChangePassword = async () => {
    if (!newPassword) return setMessage({ text: 'Password cannot be empty.', type: 'error' })
    if (newPassword.length < 6) return setMessage({ text: 'Password must be at least 6 characters.', type: 'error' })
    if (newPassword !== confirmPassword) return setMessage({ text: 'Passwords do not match.', type: 'error' })
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)
    if (error) return setMessage({ text: error.message, type: 'error' })
    setMessage({ text: 'Password updated successfully!', type: 'success' })
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return setMessage({ text: 'Type DELETE to confirm.', type: 'error' })
    setLoading(true)
    const { error } = await supabase.rpc('delete_user')
    if (error) await supabase.auth.signOut()
    setLoading(false)
    onClose()
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${session.user.id}.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) { alert('Upload failed: ' + uploadError.message); setUploadingAvatar(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').upsert({ id: session.user.id, avatar_url: publicUrl, avatar_color: avatarColor })
    setAvatarUrl(publicUrl)
    onAvatarChange?.(publicUrl, null)
    setUploadingAvatar(false)
    setMessage({ text: 'Avatar updated!', type: 'success' })
  }

  const handleResetAvatar = async () => {
    setUploadingAvatar(true)
    await supabase.from('profiles').upsert({ id: session.user.id, avatar_url: null })
    setAvatarUrl(null)
    onAvatarChange?.(null, avatarColor)
    setUploadingAvatar(false)
    setMessage({ text: 'Avatar reset to default.', type: 'success' })
  }

  const handleColorPick = async (colorId) => {
    setAvatarColor(colorId)
    await supabase.from('profiles').upsert({ id: session.user.id, avatar_color: colorId, avatar_url: null })
    setAvatarUrl(null)
    onAvatarChange?.(null, colorId)
    setMessage({ text: 'Avatar color updated!', type: 'success' })
  }

  
  const handlePrivacyToggle = async () => {
    const next = !isPrivate
    setPrivacySaving(true)
    await supabase.from('profiles').upsert({ id: session.user.id, is_private: next })
    setIsPrivate(next)
    setPrivacySaving(false)
  }

  const previewGradient = avatarUrl ? null : currentColor.gradient

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2 className="settings-title">Settings</h2>

        {}
        <div className="settings-section">
          <h3 className="settings-section-heading">Account</h3>

          {}
          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-label">Username</span>
              <span className="settings-current">{currentUsername}</span>
            </div>
            <button className="settings-edit-btn" onClick={() => resetPanel(activePanel === 'username' ? null : 'username')}>
              {activePanel === 'username' ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {activePanel === 'username' && (
            <div className="settings-panel">
              <input className="settings-input" placeholder="New username" value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChangeUsername()} autoFocus />
              <button className="btn-primary settings-save-btn" onClick={handleChangeUsername} disabled={loading}>
                {loading ? 'Saving…' : 'Save'}
              </button>
              {message && <p className={`settings-msg ${message.type}`}>{message.text}</p>}
            </div>
          )}

          {}
          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-label">Email</span>
              <span className="settings-current">{currentEmail}</span>
            </div>
            <button className="settings-edit-btn" onClick={() => resetPanel(activePanel === 'email' ? null : 'email')}>
              {activePanel === 'email' ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {activePanel === 'email' && (
            <div className="settings-panel">
              <input className="settings-input" type="email" placeholder="New email address" value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChangeEmail()} autoFocus />
              <button className="btn-primary settings-save-btn" onClick={handleChangeEmail} disabled={loading}>
                {loading ? 'Sending…' : 'Save'}
              </button>
              {message && <p className={`settings-msg ${message.type}`}>{message.text}</p>}
            </div>
          )}

          {}
          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-label">Password</span>
              <span className="settings-current">••••••••</span>
            </div>
            <button className="settings-edit-btn" onClick={() => resetPanel(activePanel === 'password' ? null : 'password')}>
              {activePanel === 'password' ? 'Cancel' : 'Change'}
            </button>
          </div>
          {activePanel === 'password' && (
            <div className="settings-panel">
              <input className="settings-input" type="password" placeholder="New password"
                value={newPassword} onChange={e => setNewPassword(e.target.value)} autoFocus />
              <input className="settings-input" type="password" placeholder="Confirm new password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChangePassword()} />
              <button className="btn-primary settings-save-btn" onClick={handleChangePassword} disabled={loading}>
                {loading ? 'Saving…' : 'Save'}
              </button>
              {message && <p className={`settings-msg ${message.type}`}>{message.text}</p>}
            </div>
          )}
        </div>

        {}
        <div className="settings-section">
          <h3 className="settings-section-heading">Profile</h3>

          {/* Avatar */}
          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-label">Avatar</span>
              <span className="settings-current">
                {avatarUrl ? 'Custom photo' : `Letter (${currentColor.label})`}
              </span>
            </div>
            <button className="settings-edit-btn" onClick={() => resetPanel(activePanel === 'avatar' ? null : 'avatar')}>
              {activePanel === 'avatar' ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {activePanel === 'avatar' && (
            <div className="settings-panel">
              {/* Preview */}
              <div className="avatar-preview-row">
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" className="avatar-preview-img" />
                  : <div className="avatar-preview-letter" style={{ background: previewGradient }}>{avatarLetter}</div>
                }
                <div className="avatar-preview-actions">
                  <button className="btn-primary settings-save-btn" style={{ alignSelf: 'flex-start' }}
                    onClick={() => fileInputRef.current.click()} disabled={uploadingAvatar}>
                    {uploadingAvatar ? 'Uploading…' : '📷 Upload Photo'}
                  </button>
                  {avatarUrl && (
                    <button className="settings-edit-btn" onClick={handleResetAvatar} disabled={uploadingAvatar}>
                      Reset to Default
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,image/bmp"
                  style={{ display: 'none' }} onChange={handleAvatarUpload} />
              </div>

              {}
              {!avatarUrl && (
                <>
                  <p className="settings-color-label">Or pick a color:</p>
                  <div className="avatar-color-grid">
                    {AVATAR_COLORS.map(c => (
                      <button
                        key={c.id}
                        className={`avatar-color-swatch ${avatarColor === c.id ? 'selected' : ''}`}
                        style={{ background: c.gradient }}
                        onClick={() => handleColorPick(c.id)}
                        title={c.label}
                      />
                    ))}
                  </div>
                </>
              )}
              {message && <p className={`settings-msg ${message.type}`}>{message.text}</p>}
            </div>
          )}

          {/* Privacy */}
          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-label">Profile Visibility</span>
              <span className="settings-current" style={{ color: isPrivate ? '#ff9800' : '#4caf50' }}>
                {isPrivate ? '🔒 Private — only you can see your posts' : '🌐 Public — everyone can see your posts'}
              </span>
            </div>
            <button
              className={`settings-toggle-btn ${isPrivate ? 'toggled' : ''}`}
              onClick={handlePrivacyToggle}
              disabled={privacySaving}
            >
              {privacySaving ? '…' : isPrivate ? 'Make Public' : 'Make Private'}
            </button>
          </div>
        </div>

        {}
        <div className="settings-section danger-zone">
          <h3 className="settings-section-heading danger-heading">Danger Zone</h3>
          <div className="settings-row">
            <div className="settings-row-left">
              <span className="settings-label">Delete Account</span>
              <span className="settings-current" style={{ color: '#ff4444' }}>Permanent — cannot be undone</span>
            </div>
            <button className="settings-edit-btn danger-btn"
              onClick={() => resetPanel(activePanel === 'delete' ? null : 'delete')}>
              {activePanel === 'delete' ? 'Cancel' : 'Delete'}
            </button>
          </div>
          {activePanel === 'delete' && (
            <div className="settings-panel danger-panel">
              <p className="settings-danger-warning">
                This will permanently delete your account and all your posts. Type <strong>DELETE</strong> to confirm.
              </p>
              <input className="settings-input danger-input" placeholder="Type DELETE to confirm"
                value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} autoFocus />
              <button className="settings-delete-confirm-btn" onClick={handleDeleteAccount} disabled={loading}>
                {loading ? 'Deleting…' : '🗑️ Permanently Delete Account'}
              </button>
              {message && <p className={`settings-msg ${message.type}`}>{message.text}</p>}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}