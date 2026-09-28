const {
  getPlayerSummaries
} = require('./steamWebApi')

const STEAM_PROVIDER =
  'steam'


async function getCurrentSteamGame(
  pool,
  userId,
  options = {}
) {
  const getPlayerSummariesImpl =
    options.getPlayerSummariesImpl ||
    getPlayerSummaries

  const accountResult =
    await pool.query(
      `
      SELECT
        external_user_id
          AS "steamId",

        activity_sharing_enabled
          AS "activitySharingEnabled"

      FROM user_external_accounts

      WHERE
        user_id = $1
        AND provider = $2

      LIMIT 1
      `,
      [
        userId,
        STEAM_PROVIDER
      ]
    )

  if (
    accountResult.rows.length ===
    0
  ) {
    return {
      connected: false,
      activitySharingEnabled:
        false,
      currentGame: null
    }
  }

  const account =
    accountResult.rows[0]

  if (
    !account
      .activitySharingEnabled
  ) {
    return {
      connected: true,
      activitySharingEnabled:
        false,
      currentGame: null
    }
  }

  const players =
    await getPlayerSummariesImpl([
      account.steamId
    ])

  const player =
    players.find(
      item =>
        item.steamId ===
        account.steamId
    ) ||
    null

  return {
    connected: true,
    activitySharingEnabled:
      true,
    currentGame:
      player?.currentGame ||
      null
  }
}


module.exports = {
  getCurrentSteamGame
}