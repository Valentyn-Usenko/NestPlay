const test =
  require('node:test')

const assert =
  require('node:assert/strict')

const {
  getCurrentSteamGame
} = require('../steamActivity')


function createPool(
  rows
) {
  return {
    async query() {
      return {
        rows
      }
    }
  }
}


test(
  'does not call Steam when no account is connected',
  async () => {
    let steamCalls = 0

    const result =
      await getCurrentSteamGame(
        createPool([]),
        'user-1',
        {
          getPlayerSummariesImpl:
            async () => {
              steamCalls += 1

              return []
            }
        }
      )

    assert.deepEqual(
      result,
      {
        connected: false,
        activitySharingEnabled:
          false,
        currentGame: null
      }
    )

    assert.equal(
      steamCalls,
      0
    )
  }
)


test(
  'does not call Steam when activity sharing is disabled',
  async () => {
    let steamCalls = 0

    const result =
      await getCurrentSteamGame(
        createPool([
          {
            steamId:
              '76561198000000000',

            activitySharingEnabled:
              false
          }
        ]),
        'user-1',
        {
          getPlayerSummariesImpl:
            async () => {
              steamCalls += 1

              return []
            }
        }
      )

    assert.deepEqual(
      result,
      {
        connected: true,
        activitySharingEnabled:
          false,
        currentGame: null
      }
    )

    assert.equal(
      steamCalls,
      0
    )
  }
)


test(
  'loads the current game when activity sharing is enabled',
  async () => {
    let receivedIds = null

    const result =
      await getCurrentSteamGame(
        createPool([
          {
            steamId:
              '76561198000000000',

            activitySharingEnabled:
              true
          }
        ]),
        'user-1',
        {
          getPlayerSummariesImpl:
            async steamIds => {
              receivedIds =
                steamIds

              return [
                {
                  steamId:
                    '76561198000000000',

                  currentGame: {
                    appId:
                      '123456',

                    name:
                      'Test Game'
                  }
                }
              ]
            }
        }
      )

    assert.deepEqual(
      receivedIds,
      [
        '76561198000000000'
      ]
    )

    assert.deepEqual(
      result,
      {
        connected: true,
        activitySharingEnabled:
          true,

        currentGame: {
          appId:
            '123456',

          name:
            'Test Game'
        }
      }
    )
  }
)


test(
  'returns null when Steam reports no current game',
  async () => {
    const result =
      await getCurrentSteamGame(
        createPool([
          {
            steamId:
              '76561198000000000',

            activitySharingEnabled:
              true
          }
        ]),
        'user-1',
        {
          getPlayerSummariesImpl:
            async () => [
              {
                steamId:
                  '76561198000000000',

                currentGame: null
              }
            ]
        }
      )

    assert.equal(
      result.currentGame,
      null
    )
  }
)