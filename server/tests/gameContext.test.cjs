const test =
  require('node:test')

const assert =
  require('node:assert/strict')

const {
  parseProviderGameId,
  createGameContextService
} =
  require('../gameContext')
    ._test


test(
  'parses provider-qualified IGDB IDs',
  () => {
    assert.deepEqual(
      parseProviderGameId(
        'igdb:1877'
      ),
      {
        raw:
          'igdb:1877',

        provider:
          'igdb',

        externalId:
          1877,

        supported:
          true
      }
    )
  }
)


test(
  'does not guess unsupported provider IDs',
  () => {
    const result =
      parseProviderGameId(
        'rawg:22509'
      )

    assert.equal(
      result.provider,
      'rawg'
    )

    assert.equal(
      result.supported,
      false
    )

    assert.equal(
      result.externalId,
      null
    )
  }
)


test(
  'does not accept malformed IGDB IDs',
  () => {
    assert.equal(
      parseProviderGameId(
        'igdb:cyberpunk'
      ).supported,
      false
    )

    assert.equal(
      parseProviderGameId(
        '1877'
      ).supported,
      false
    )
  }
)


test(
  'caches IGDB game context',
  async () => {
    let calls =
      0

    let clock =
      1000

    const service =
      createGameContextService({
        now:
          () => clock,

        cacheTtlMs:
          100,

        fetchIgdbContext:
          async id => {
            calls += 1

            return {
              game: {
                id:
                  `igdb:${id}`,

                name:
                  'Cyberpunk 2077'
              },

              platforms: [
                {
                  key:
                    'steam',

                  label:
                    'Steam',

                  url:
                    'https://store.steampowered.com/app/1091500/'
                }
              ]
            }
          }
      })

    const first =
      await service
        .getGameContext(
          'igdb:1877'
        )

    const second =
      await service
        .getGameContext(
          'igdb:1877'
        )

    assert.equal(
      calls,
      1
    )

    assert.deepEqual(
      second,
      first
    )

    clock =
      1200

    await service
      .getGameContext(
        'igdb:1877'
      )

    assert.equal(
      calls,
      2
    )
  }
)


test(
  'deduplicates concurrent context requests',
  async () => {
    let calls =
      0

    let resolveProvider

    const providerPromise =
      new Promise(resolve => {
        resolveProvider =
          resolve
      })

    const service =
      createGameContextService({
        fetchIgdbContext:
          async () => {
            calls += 1

            return providerPromise
          }
      })

    const first =
      service.getGameContext(
        'igdb:1877'
      )

    const second =
      service.getGameContext(
        'igdb:1877'
      )

    resolveProvider({
      game: {
        id:
          'igdb:1877',

        name:
          'Cyberpunk 2077'
      },

      platforms:
        []
    })

    await Promise.all([
      first,
      second
    ])

    assert.equal(
      calls,
      1
    )
  }
)
