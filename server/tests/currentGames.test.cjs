const test = require('node:test')
const assert = require('node:assert/strict')

const {
  normalizeCurrentGames
} = require('../currentGames')

test(
  'accepts zero through three games',
  () => {
    assert.deepEqual(
      normalizeCurrentGames([]),
      []
    )

    const games =
      normalizeCurrentGames([
        {
          id: 1,
          name: 'Game One'
        },
        {
          gameId: '2',
          name: 'Game Two',
          gameArtUrl:
            'https://example.com/two.jpg'
        },
        {
          game_id: '3',
          game_name: 'Game Three'
        }
      ])

    assert.equal(
      games.length,
      3
    )

    assert.deepEqual(
      games.map(
        game =>
          game.position
      ),
      [1, 2, 3]
    )

    assert.equal(
      games[0].gameId,
      '1'
    )

    assert.equal(
      games[1].gameArtUrl,
      'https://example.com/two.jpg'
    )
  }
)

test(
  'rejects more than three games',
  () => {
    assert.throws(
      () =>
        normalizeCurrentGames([
          { id: 1, name: 'One' },
          { id: 2, name: 'Two' },
          { id: 3, name: 'Three' },
          { id: 4, name: 'Four' }
        ]),
      /up to 3/
    )
  }
)

test(
  'rejects duplicate games',
  () => {
    assert.throws(
      () =>
        normalizeCurrentGames([
          {
            id: '10',
            name: 'Game'
          },
          {
            id: '10',
            name: 'Game'
          }
        ]),
      /cannot be selected twice/
    )
  }
)

test(
  'rejects missing game information',
  () => {
    assert.throws(
      () =>
        normalizeCurrentGames([
          {
            name:
              'Missing ID'
          }
        ]),
      /must have an ID/
    )

    assert.throws(
      () =>
        normalizeCurrentGames([
          {
            id: '55'
          }
        ]),
      /must have a name/
    )
  }
)
