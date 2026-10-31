const test =
  require('node:test')

const assert =
  require('node:assert/strict')

const {
  createCommunityRatingService,
  _test: {
    normalizeCommunityRating,
    normalizeCommunityGameId
  }
} =
  require('../communityRating')


test(
  'accepts whole-star Community Ratings from 1 through 5',
  () => {
    assert.equal(
      normalizeCommunityRating(
        1
      ),
      1
    )

    assert.equal(
      normalizeCommunityRating(
        5
      ),
      5
    )
  }
)


test(
  'rejects invalid Community Rating values',
  () => {
    for (
      const value of [
        0,
        6,
        4.5,
        '4',
        null
      ]
    ) {
      assert.throws(
        () =>
          normalizeCommunityRating(
            value
          ),
        /integer from 1 to 5/
      )
    }
  }
)


test(
  'uses canonical provider-qualified IGDB game IDs',
  () => {
    assert.equal(
      normalizeCommunityGameId(
        ' IGDB:001877 '
      ),
      'igdb:1877'
    )

    assert.throws(
      () =>
        normalizeCommunityGameId(
          'rawg:22509'
        ),
      /Unsupported/
    )

    assert.throws(
      () =>
        normalizeCommunityGameId(
          'Cyberpunk 2077'
        ),
      /Unsupported/
    )
  }
)


test(
  'loads aggregate Community Rating and current user rating',
  async () => {
    const calls = []

    const pool = {
      async query(
        sql,
        params
      ) {
        calls.push({
          sql,
          params
        })

        return {
          rows: [
            {
              average:
                4.67,

              count:
                3,

              myRating:
                5
            }
          ]
        }
      }
    }

    const service =
      createCommunityRatingService(
        pool
      )

    const result =
      await service
        .getCommunityRating({
          gameId:
            'igdb:1877',

          userId:
            '11111111-1111-4111-8111-111111111111'
        })

    assert.deepEqual(
      result,
      {
        gameId:
          'igdb:1877',

        average:
          4.67,

        count:
          3,

        myRating:
          5
      }
    )

    assert.deepEqual(
      calls[0].params,
      [
        'igdb:1877',
        '11111111-1111-4111-8111-111111111111'
      ]
    )
  }
)


test(
  'returns an empty Community Rating summary for an unrated game',
  async () => {
    const pool = {
      async query() {
        return {
          rows: [
            {
              average:
                null,

              count:
                0,

              myRating:
                null
            }
          ]
        }
      }
    }

    const service =
      createCommunityRatingService(
        pool
      )

    assert.deepEqual(
      await service
        .getCommunityRating({
          gameId:
            'igdb:1877'
        }),
      {
        gameId:
          'igdb:1877',

        average:
          null,

        count:
          0,

        myRating:
          null
      }
    )
  }
)


test(
  'upserts one Community Rating per user and game',
  async () => {
    const calls = []

    const pool = {
      async query(
        sql,
        params
      ) {
        calls.push({
          sql,
          params
        })

        if (
          sql.includes(
            'INSERT INTO game_ratings'
          )
        ) {
          return {
            rows: []
          }
        }

        return {
          rows: [
            {
              average:
                4,

              count:
                1,

              myRating:
                4
            }
          ]
        }
      }
    }

    const service =
      createCommunityRatingService(
        pool
      )

    const result =
      await service
        .setCommunityRating({
          gameId:
            'igdb:1877',

          userId:
            '11111111-1111-4111-8111-111111111111',

          rating:
            4
        })

    assert.match(
      calls[0].sql,
      /ON CONFLICT/
    )

    assert.deepEqual(
      calls[0].params,
      [
        '11111111-1111-4111-8111-111111111111',
        'igdb:1877',
        4
      ]
    )

    assert.equal(
      result.myRating,
      4
    )
  }
)


test(
  'deletes a user Community Rating and returns the new aggregate',
  async () => {
    const calls = []

    const pool = {
      async query(
        sql,
        params
      ) {
        calls.push({
          sql,
          params
        })

        if (
          sql.includes(
            'DELETE FROM game_ratings'
          )
        ) {
          return {
            rows: []
          }
        }

        return {
          rows: [
            {
              average:
                4.5,

              count:
                2,

              myRating:
                null
            }
          ]
        }
      }
    }

    const service =
      createCommunityRatingService(
        pool
      )

    const result =
      await service
        .deleteCommunityRating({
          gameId:
            'igdb:1877',

          userId:
            '11111111-1111-4111-8111-111111111111'
        })

    assert.deepEqual(
      calls[0].params,
      [
        '11111111-1111-4111-8111-111111111111',
        'igdb:1877'
      ]
    )

    assert.deepEqual(
      result,
      {
        gameId:
          'igdb:1877',

        average:
          4.5,

        count:
          2,

        myRating:
          null
      }
    )
  }
)
