const test =
  require('node:test')

const assert =
  require('node:assert/strict')

const {
  getPlayerSummaries,
  getOwnedGames,
  _test: {
    getSteamWebApiKey,
    normalizeOwnedGame,
    normalizePlayer,
    normalizeSteamIds
  }
} = require('../steamWebApi')


test(
  'requires a configured Steam Web API key',
  () => {
    const previous =
      process.env
        .STEAM_WEB_API_KEY

    delete process.env
      .STEAM_WEB_API_KEY

    try {
      assert.throws(
        () =>
          getSteamWebApiKey(),
        /not configured/
      )
    } finally {
      if (
        previous ===
        undefined
      ) {
        delete process.env
          .STEAM_WEB_API_KEY
      } else {
        process.env
          .STEAM_WEB_API_KEY =
          previous
      }
    }
  }
)


test(
  'normalizes and deduplicates SteamIDs',
  () => {
    assert.deepEqual(
      normalizeSteamIds([
        '76561198000000000',
        '76561198000000000',
        ' 76561198000000001 '
      ]),
      [
        '76561198000000000',
        '76561198000000001'
      ]
    )
  }
)


test(
  'rejects invalid SteamIDs',
  () => {
    assert.throws(
      () =>
        normalizeSteamIds([
          'not-a-steamid'
        ]),
      /digits/
    )

    assert.throws(
      () =>
        normalizeSteamIds([
          '0'
        ]),
      /uint64/
    )
  }
)


test(
  'rejects more than 100 SteamIDs',
  () => {
    const ids =
      Array.from(
        {
          length: 101
        },
        (
          _,
          index
        ) =>
          String(
            76561198000000000n +
            BigInt(index)
          )
      )

    assert.throws(
      () =>
        normalizeSteamIds(
          ids
        ),
      /maximum of 100/
    )
  }
)


test(
  'normalizes Steam player summaries',
  () => {
    const player =
      normalizePlayer({
        steamid:
          '76561198000000000',

        personaname:
          'NestPlay Test',

        profileurl:
          'https://steamcommunity.com/id/test/',

        avatar:
          'https://example.com/avatar.jpg',

        avatarmedium:
          'https://example.com/avatar-medium.jpg',

        avatarfull:
          'https://example.com/avatar-full.jpg',

        communityvisibilitystate:
          3,

        profilestate:
          1,

        lastlogoff:
          1234567890,

        gameid:
          '123456',

        gameextrainfo:
          'Test Game'
      })

    assert.deepEqual(
      player,
      {
        steamId:
          '76561198000000000',

        personaName:
          'NestPlay Test',

        profileUrl:
          'https://steamcommunity.com/id/test/',

        avatarUrl:
          'https://example.com/avatar.jpg',

        avatarMediumUrl:
          'https://example.com/avatar-medium.jpg',

        avatarFullUrl:
          'https://example.com/avatar-full.jpg',

        communityVisibilityState:
          3,

        profileState:
          1,

        lastLogoff:
          1234567890,

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
  'sends the API key only in the header',
  async () => {
    const previous =
      process.env
        .STEAM_WEB_API_KEY

    process.env
      .STEAM_WEB_API_KEY =
      'test-secret-key'

    let requestedUrl = null
    let requestedOptions = null

    const fakeFetch =
      async (
        url,
        options
      ) => {
        requestedUrl =
          url

        requestedOptions =
          options

        return {
          ok: true,
          status: 200,

          async json() {
            return {
              response: {
                players: [
                  {
                    steamid:
                      '76561198000000000',

                    personaname:
                      'Test User'
                  }
                ]
              }
            }
          }
        }
      }

    try {
      const players =
        await getPlayerSummaries(
          [
            '76561198000000000'
          ],
          {
            fetchImpl:
              fakeFetch
          }
        )

      assert.equal(
        players.length,
        1
      )

      assert.equal(
        players[0].personaName,
        'Test User'
      )

      assert.equal(
        requestedUrl.hostname,
        'api.steampowered.com'
      )

      assert.equal(
        requestedUrl.pathname,
        '/ISteamUser/GetPlayerSummaries/v2/'
      )

      assert.equal(
        requestedUrl.searchParams.get(
          'steamids'
        ),
        '76561198000000000'
      )

      assert.equal(
        requestedUrl.searchParams.has(
          'key'
        ),
        false
      )

      assert.equal(
        requestedOptions
          .headers[
            'x-webapi-key'
          ],
        'test-secret-key'
      )
    } finally {
      if (
        previous ===
        undefined
      ) {
        delete process.env
          .STEAM_WEB_API_KEY
      } else {
        process.env
          .STEAM_WEB_API_KEY =
          previous
      }
    }
  }
)


test(
  'rejects malformed Steam API responses',
  async () => {
    const previous =
      process.env
        .STEAM_WEB_API_KEY

    process.env
      .STEAM_WEB_API_KEY =
      'test-secret-key'

    try {
      await assert.rejects(
        () =>
          getPlayerSummaries(
            [
              '76561198000000000'
            ],
            {
              fetchImpl:
                async () => ({
                  ok: true,
                  status: 200,

                  async json() {
                    return {
                      response: {}
                    }
                  }
                })
            }
          ),
        /malformed/
      )
    } finally {
      if (
        previous ===
        undefined
      ) {
        delete process.env
          .STEAM_WEB_API_KEY
      } else {
        process.env
          .STEAM_WEB_API_KEY =
          previous
      }
    }
  }
)

test(
  'normalizes Steam owned games and playtime',
  () => {
    assert.deepEqual(
      normalizeOwnedGame({
        appid: 730,
        name: ' Counter-Strike 2 ',
        playtime_forever: 753,
        playtime_2weeks: 120,
        img_icon_url:
          'abcdef123456'
      }),
      {
        appId:
          '730',

        name:
          'Counter-Strike 2',

        playtimeForeverMinutes:
          753,

        playtimeHours:
          12.6,

        playtime2WeeksMinutes:
          120,

        iconUrl:
          'https://media.steampowered.com/steamcommunity/public/images/apps/730/abcdef123456.jpg'
      }
    )

    assert.equal(
      normalizeOwnedGame({
        appid: 0
      }),
      null
    )
  }
)


test(
  'loads owned games most-played first and keeps the API key out of the URL',
  async () => {
    const previous =
      process.env
        .STEAM_WEB_API_KEY

    process.env
      .STEAM_WEB_API_KEY =
      'test-secret-key'

    let requestedUrl = null
    let requestedOptions = null

    try {
      const result =
        await getOwnedGames(
          '76561198000000000',
          {
            fetchImpl:
              async (
                url,
                options
              ) => {
                requestedUrl =
                  new URL(
                    url.toString()
                  )

                requestedOptions =
                  options

                return {
                  ok: true,
                  status: 200,

                  async json() {
                    return {
                      response: {
                        game_count:
                          3,

                        games: [
                          {
                            appid: 10,
                            name:
                              'Ten',
                            playtime_forever:
                              60,
                            img_icon_url:
                              'aaaaaaaa'
                          },
                          {
                            appid: 20,
                            name:
                              'Twenty',
                            playtime_forever:
                              900,
                            img_icon_url:
                              'bbbbbbbb'
                          },
                          {
                            appid: 30,
                            name:
                              'Thirty',
                            playtime_forever:
                              300,
                            img_icon_url:
                              'cccccccc'
                          }
                        ]
                      }
                    }
                  }
                }
              }
          }
        )

      assert.equal(
        result.visible,
        true
      )

      assert.deepEqual(
        result.games.map(
          game =>
            game.appId
        ),
        [
          '20',
          '30',
          '10'
        ]
      )

      assert.equal(
        result.games[0]
          .playtimeHours,
        15
      )

      assert.equal(
        requestedUrl.hostname,
        'api.steampowered.com'
      )

      assert.equal(
        requestedUrl.pathname,
        '/IPlayerService/GetOwnedGames/v1/'
      )

      assert.equal(
        requestedUrl.searchParams.get(
          'steamid'
        ),
        '76561198000000000'
      )

      assert.equal(
        requestedUrl.searchParams.get(
          'include_appinfo'
        ),
        'true'
      )

      assert.equal(
        requestedUrl.searchParams.get(
          'include_played_free_games'
        ),
        'true'
      )

      assert.equal(
        requestedUrl.searchParams.has(
          'key'
        ),
        false
      )

      assert.equal(
        requestedOptions
          .headers[
            'x-webapi-key'
          ],
        'test-secret-key'
      )
    } finally {
      if (
        previous ===
        undefined
      ) {
        delete process.env
          .STEAM_WEB_API_KEY
      } else {
        process.env
          .STEAM_WEB_API_KEY =
          previous
      }
    }
  }
)


test(
  'handles empty and private Steam libraries',
  async () => {
    const previous =
      process.env
        .STEAM_WEB_API_KEY

    process.env
      .STEAM_WEB_API_KEY =
      'test-secret-key'

    try {
      const emptyLibrary =
        await getOwnedGames(
          '76561198000000000',
          {
            fetchImpl:
              async () => ({
                ok: true,
                status: 200,

                async json() {
                  return {
                    response: {
                      game_count:
                        0
                    }
                  }
                }
              })
          }
        )

      assert.deepEqual(
        emptyLibrary,
        {
          visible: true,
          games: []
        }
      )

      const privateLibrary =
        await getOwnedGames(
          '76561198000000000',
          {
            fetchImpl:
              async () => ({
                ok: true,
                status: 200,

                async json() {
                  return {
                    response: {}
                  }
                }
              })
          }
        )

      assert.deepEqual(
        privateLibrary,
        {
          visible: false,
          games: []
        }
      )
    } finally {
      if (
        previous ===
        undefined
      ) {
        delete process.env
          .STEAM_WEB_API_KEY
      } else {
        process.env
          .STEAM_WEB_API_KEY =
          previous
      }
    }
  }
)


test(
  'rejects malformed Steam owned-games responses',
  async () => {
    const previous =
      process.env
        .STEAM_WEB_API_KEY

    process.env
      .STEAM_WEB_API_KEY =
      'test-secret-key'

    try {
      await assert.rejects(
        () =>
          getOwnedGames(
            '76561198000000000',
            {
              fetchImpl:
                async () => ({
                  ok: true,
                  status: 200,

                  async json() {
                    return {
                      response: {
                        game_count:
                          2
                      }
                    }
                  }
                })
            }
          ),
        /malformed/
      )
    } finally {
      if (
        previous ===
        undefined
      ) {
        delete process.env
          .STEAM_WEB_API_KEY
      } else {
        process.env
          .STEAM_WEB_API_KEY =
          previous
      }
    }
  }
)