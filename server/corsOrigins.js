/* global module */

function getAllowedFrontendOrigins(
  env = process.env
) {
  return [
    env.FRONTEND_URL,
    ...(env.FRONTEND_URLS || '')
      .split(',')
  ]
    .map(value =>
      String(value || '').trim()
    )
    .filter(Boolean)
}

module.exports = {
  getAllowedFrontendOrigins
}
