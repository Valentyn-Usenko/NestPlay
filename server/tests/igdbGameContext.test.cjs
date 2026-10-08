const test =
  require('node:test')

const assert =
  require('node:assert/strict')

const {
  isAllowedExternalUrl,
  normalizeGameContext
} =
  require('../igdb')
    ._test


test(
  'accepts verified store domains and rejects unsafe URLs',
  () => {
    assert.equal(
      isAllowedExternalUrl(
        'steam',
        'https://store.steampowered.com/app/1091500/'
      ),
      true
    )

    assert.equal(
      isAllowedExternalUrl(
        'steam',
        'javascript:alert(1)'
      ),
      false
    )

    assert.equal(
      isAllowedExternalUrl(
        'steam',
        'https://example.com/app/1091500/'
      ),
      false
    )
  }
)


test(
  'normalizes store links in stable platform order from provider URLs',
  () => {
    const context =
      normalizeGameContext({
        id:
          1877,

        name:
          'Cyberpunk 2077',

        external_games: [
          {
            url:
              'https://store.playstation.com/en-us/product/example'
          },
          {
            url:
              'https://www.gog.com/en/game/cyberpunk_2077'
          },
          {
            uid:
              '1091500',

            url:
              'https://store.steampowered.com/app/1091500/'
          },
          {
            url:
              'https://www.xbox.com/en-US/games/store/example'
          }
        ]
      })

    assert.deepEqual(
      context.platforms.map(
        platform =>
          platform.key
      ),
      [
        'steam',
        'playstation',
        'xbox',
        'gog'
      ]
    )
  }
)


test(
  'collapses duplicate xbox and microsoft links',
  () => {
    const context =
      normalizeGameContext({
        id:
          1,

        name:
          'Example',

        external_games: [
          {
            url:
              'https://apps.microsoft.com/detail/example'
          },
          {
            url:
              'https://www.xbox.com/games/store/example'
          }
        ]
      })

    assert.equal(
      context.platforms.filter(
        platform =>
          platform.key ===
          'xbox'
      ).length,
      1
    )
  }
)


test(
  'uses trusted website fallback for Steam, Epic and GOG',
  () => {
    const context =
      normalizeGameContext({
        id:
          1,

        name:
          'Example',

        websites: [
          {
            trusted:
              true,

            url:
              'https://store.steampowered.com/app/1/'
          },
          {
            trusted:
              true,

            url:
              'https://store.epicgames.com/en-US/p/example'
          },
          {
            trusted:
              true,

            url:
              'https://www.gog.com/en/game/example'
          }
        ]
      })

    assert.deepEqual(
      context.platforms.map(
        platform =>
          platform.key
      ),
      [
        'steam',
        'epic',
        'gog'
      ]
    )
  }
)


test(
  'drops untrusted website or mismatched platform URLs',
  () => {
    const context =
      normalizeGameContext({
        id:
          1,

        name:
          'Example',

        external_games: [
          {
            url:
              'https://malicious.example/steam'
          }
        ],

        websites: [
          {
            trusted:
              false,

            url:
              'https://store.steampowered.com/app/1/'
          }
        ]
      })

    assert.deepEqual(
      context.platforms,
      []
    )
  }
)
