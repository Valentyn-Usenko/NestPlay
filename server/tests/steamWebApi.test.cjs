const test =
  require('node:test')

const assert =
  require('node:assert/strict')

const {
  getPlayerSummaries,
  _test: {
    getSteamWebApiKey,
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