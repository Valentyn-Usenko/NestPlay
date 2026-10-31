/* global module */

const fs =
  require('fs')


function normalizeDbSslMode(
  value
) {
  const mode =
    String(
      value || 'auto'
    )
      .trim()
      .toLowerCase()

  if (
    ![
      'auto',
      'disable',
      'require'
    ].includes(
      mode
    )
  ) {
    throw new Error(
      'DB_SSL must be auto, disable, or require'
    )
  }

  return mode
}


function isLocalDatabaseHost(
  value
) {
  const host =
    String(
      value || ''
    )
      .trim()
      .toLowerCase()

  return (
    host === 'localhost' ||
    host === '::1' ||
    host === '[::1]' ||
    host === '0.0.0.0' ||
    host.startsWith(
      '127.'
    )
  )
}


function createDatabaseSslConfig({
  host,
  mode = 'auto',
  caPath
}) {
  const normalizedMode =
    normalizeDbSslMode(
      mode
    )

  if (
    normalizedMode ===
      'disable' ||
    (
      normalizedMode ===
        'auto' &&
      isLocalDatabaseHost(
        host
      )
    )
  ) {
    return false
  }

  if (!caPath) {
    throw new Error(
      'Database CA path is required when SSL is enabled'
    )
  }

  return {
    rejectUnauthorized:
      true,

    ca:
      fs.readFileSync(
        caPath
      ).toString()
  }
}


module.exports = {
  normalizeDbSslMode,
  isLocalDatabaseHost,
  createDatabaseSslConfig
}
