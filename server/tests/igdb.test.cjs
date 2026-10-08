const test =
  require('node:test')

const assert =
  require('node:assert/strict')

const {
  _test
} = require('../igdb')

const {
  escapeSearchTerm,
  makeImageUrl,
  normalizeGame
} = _test


test(
  'escapeSearchTerm escapes quotes and backslashes',
  () => {
    const result =
      escapeSearchTerm(
        'Cyberpunk "2077" \\ test'
      )

    assert.equal(
      result,
      'Cyberpunk \\"2077\\" \\\\ test'
    )
  }
)


test(
  'escapeSearchTerm replaces control characters',
  () => {
    const result =
      escapeSearchTerm(
        'Cyberpunk\n2077'
      )

    assert.equal(
      result,
      'Cyberpunk 2077'
    )
  }
)


test(
  'makeImageUrl creates an IGDB 720p URL',
  () => {
    assert.equal(
      makeImageUrl(
        'abc123'
      ),
      'https://images.igdb.com/igdb/image/upload/t_720p/abc123.jpg'
    )
  }
)


test(
  'makeImageUrl returns null without an image id',
  () => {
    assert.equal(
      makeImageUrl(null),
      null
    )
  }
)


test(
  'normalizeGame creates provider-qualified IGDB id',
  () => {
    const game =
      normalizeGame({
        id:
          1877,

        name:
          'Cyberpunk 2077',

        cover: {
          image_id:
            'cover123'
        }
      })

    assert.equal(
      game.id,
      'igdb:1877'
    )

    assert.equal(
      game.name,
      'Cyberpunk 2077'
    )
  }
)


test(
  'normalizeGame prefers artwork over screenshot and cover',
  () => {
    const game =
      normalizeGame({
        id:
          1877,

        name:
          'Cyberpunk 2077',

        artworks: [
          {
            image_id:
              'artwork123'
          }
        ],

        screenshots: [
          {
            image_id:
              'screenshot123'
          }
        ],

        cover: {
          image_id:
            'cover123'
        }
      })

    assert.equal(
      game.background_image,
      'https://images.igdb.com/igdb/image/upload/t_720p/artwork123.jpg'
    )
  }
)


test(
  'normalizeGame uses screenshot when artwork is missing',
  () => {
    const game =
      normalizeGame({
        id:
          1877,

        name:
          'Cyberpunk 2077',

        screenshots: [
          {
            image_id:
              'screenshot123'
          }
        ],

        cover: {
          image_id:
            'cover123'
        }
      })

    assert.equal(
      game.background_image,
      'https://images.igdb.com/igdb/image/upload/t_720p/screenshot123.jpg'
    )
  }
)


test(
  'normalizeGame uses cover when artwork and screenshot are missing',
  () => {
    const game =
      normalizeGame({
        id:
          1877,

        name:
          'Cyberpunk 2077',

        cover: {
          image_id:
            'cover123'
        }
      })

    assert.equal(
      game.background_image,
      'https://images.igdb.com/igdb/image/upload/t_720p/cover123.jpg'
    )
  }
)


test(
  'normalizeGame returns null image when no image exists',
  () => {
    const game =
      normalizeGame({
        id:
          1877,

        name:
          'Cyberpunk 2077'
      })

    assert.equal(
      game.background_image,
      null
    )
  }
)


test(
  'normalizeGame rejects invalid games',
  () => {
    assert.equal(
      normalizeGame(null),
      null
    )

    assert.equal(
      normalizeGame({
        name:
          'Missing ID'
      }),
      null
    )

    assert.equal(
      normalizeGame({
        id:
          123
      }),
      null
    )
  }
)