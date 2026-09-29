const test =
  require('node:test')

const assert =
  require('node:assert/strict')

const {
  getSteamLibraryForFavorites,
  saveSteamFavoriteGames,

  _test: {
    mapFavoriteGames,
    normalizeFavoriteAppIds
  }
} = require('../steamFavorites')


test(
  'validates favorite Steam app IDs',
  () => {
    assert.deepEqual(
      normalizeFavoriteAppIds([]),
      []
    )

    assert.deepEqual(
      normalizeFavoriteAppIds([
        '10',
        '20',
        '30',
        '40'
      ]),
      [
        '10',
        '20',
        '30',
        '40'
      ]
    )

    assert.deepEqual(
      normalizeFavoriteAppIds([
        '10',
        '20',
        '30'
      ]),
      [
        '10',
        '20',
        '30'
      ]
    )

    assert.throws(
      () =>
        normalizeFavoriteAppIds([
          '10',
          '20',
          '30',
          '40',
          '50',
          '60',
          '70'
        ]),
      /up to 6/
    )

    assert.throws(
      () =>
        normalizeFavoriteAppIds([
          '10',
          '20',
          '30',
          '30'
        ]),
      /unique/
    )

    assert.throws(
      () =>
        normalizeFavoriteAppIds([
          '10',
          '20',
          '30',
          'not-an-app'
        ]),
      /digits/
    )
  }
)


test(
  'maps favorite games in saved order',
  () => {
    const games = [
      {
        appId:
          '10',
        name:
          'Ten'
      },
      {
        appId:
          '20',
        name:
          'Twenty'
      },
      {
        appId:
          '30',
        name:
          'Thirty'
      }
    ]

    assert.deepEqual(
      mapFavoriteGames(
        [
          '30',
          '10'
        ],
        games
      ),
      [
        {
          appId:
            '30',
          name:
            'Thirty'
        },
        {
          appId:
            '10',
          name:
            'Ten'
        }
      ]
    )
  }
)


test(
  'loads Steam library with saved selections',
  async () => {
    const pool = {
      async query(
        sql
      ) {
        if (
          sql.includes(
            'user_external_accounts'
          )
        ) {
          return {
            rows: [
              {
                external_user_id:
                  '76561198000000000'
              }
            ]
          }
        }

        if (
          sql.includes(
            'user_steam_favorite_games'
          )
        ) {
          return {
            rows: [
              {
                appId:
                  '20'
              },
              {
                appId:
                  '10'
              }
            ]
          }
        }

        throw new Error(
          'Unexpected query'
        )
      }
    }

    const result =
      await getSteamLibraryForFavorites(
        pool,
        '11111111-1111-4111-8111-111111111111',
        {
          getOwnedGamesImpl:
            async steamId => {
              assert.equal(
                steamId,
                '76561198000000000'
              )

              return {
                visible: true,

                games: [
                  {
                    appId:
                      '10',
                    name:
                      'Ten'
                  },
                  {
                    appId:
                      '20',
                    name:
                      'Twenty'
                  }
                ]
              }
            }
        }
      )

    assert.equal(
      result.visible,
      true
    )

    assert.deepEqual(
      result.selectedAppIds,
      [
        '20',
        '10'
      ]
    )

    assert.equal(
      result.games.length,
      2
    )
  }
)


test(
  'saves owned favorite games transactionally in selected order',
  async () => {
    const queries = []

    const client = {
      async query(
        sql,
        params = []
      ) {
        queries.push({
          sql:
            sql
              .replace(
                /\s+/g,
                ' '
              )
              .trim(),

          params
        })

        return {
          rows: []
        }
      },

      release() {
        queries.push({
          release: true
        })
      }
    }

    const pool = {
      async query(
        sql
      ) {
        if (
          sql.includes(
            'user_external_accounts'
          )
        ) {
          return {
            rows: [
              {
                external_user_id:
                  '76561198000000000'
              }
            ]
          }
        }

        throw new Error(
          'Unexpected query'
        )
      },

      async connect() {
        return client
      }
    }

    const libraryGames = [
      {
        appId:
          '10',
        name:
          'Ten'
      },
      {
        appId:
          '20',
        name:
          'Twenty'
      },
      {
        appId:
          '30',
        name:
          'Thirty'
      },
      {
        appId:
          '40',
        name:
          'Forty'
      }
    ]

    const result =
      await saveSteamFavoriteGames(
        pool,
        '11111111-1111-4111-8111-111111111111',
        [
          '40',
          '10',
          '30',
          '20'
        ],
        {
          getOwnedGamesImpl:
            async () => ({
              visible: true,
              games:
                libraryGames
            })
        }
      )

    assert.deepEqual(
      result.games.map(
        game =>
          game.appId
      ),
      [
        '40',
        '10',
        '30',
        '20'
      ]
    )

    const inserts =
      queries.filter(
        entry =>
          entry.sql?.includes(
            'INSERT INTO user_steam_favorite_games'
          )
      )

    assert.deepEqual(
      inserts.map(
        entry =>
          [
            entry.params[1],
            entry.params[2]
          ]
      ),
      [
        [
          '40',
          1
        ],
        [
          '10',
          2
        ],
        [
          '30',
          3
        ],
        [
          '20',
          4
        ]
      ]
    )

    assert.equal(
      queries[0].sql,
      'BEGIN'
    )

    assert.equal(
      queries.at(-2).sql,
      'COMMIT'
    )

    assert.deepEqual(
      queries.at(-1),
      {
        release: true
      }
    )
  }
)


test(
  'rejects games not owned by the connected Steam account',
  async () => {
    let connected =
      false

    const pool = {
      async query() {
        return {
          rows: [
            {
              external_user_id:
                '76561198000000000'
            }
          ]
        }
      },

      async connect() {
        connected =
          true

        throw new Error(
          'Database transaction should not start'
        )
      }
    }

    await assert.rejects(
      () =>
        saveSteamFavoriteGames(
          pool,
          '11111111-1111-4111-8111-111111111111',
          [
            '10',
            '20',
            '30',
            '999'
          ],
          {
            getOwnedGamesImpl:
              async () => ({
                visible: true,

                games: [
                  {
                    appId:
                      '10'
                  },
                  {
                    appId:
                      '20'
                  },
                  {
                    appId:
                      '30'
                  }
                ]
              })
          }
        ),
      /not found in your Steam library/
    )

    assert.equal(
      connected,
      false
    )
  }
)


test(
  'rejects saving favorites when Steam game details are private',
  async () => {
    let connected =
      false

    const pool = {
      async query() {
        return {
          rows: [
            {
              external_user_id:
                '76561198000000000'
            }
          ]
        }
      },

      async connect() {
        connected =
          true

        throw new Error(
          'Database transaction should not start'
        )
      }
    }

    await assert.rejects(
      () =>
        saveSteamFavoriteGames(
          pool,
          '11111111-1111-4111-8111-111111111111',
          [
            '10',
            '20',
            '30',
            '40'
          ],
          {
            getOwnedGamesImpl:
              async () => ({
                visible: false,
                games: []
              })
          }
        ),
      error => {
        assert.equal(
          error.statusCode,
          403
        )

        return true
      }
    )

    assert.equal(
      connected,
      false
    )
  }
)