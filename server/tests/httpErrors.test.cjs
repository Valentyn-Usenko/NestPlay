const test =
  require('node:test')

const assert =
  require('node:assert/strict')

const {
  isMalformedJsonError,
  malformedJsonErrorHandler
} =
  require('../httpErrors')


test(
  'recognizes Express malformed JSON parse errors',
  () => {
    assert.equal(
      isMalformedJsonError({
        status:
          400,

        type:
          'entity.parse.failed'
      }),
      true
    )

    assert.equal(
      isMalformedJsonError({
        status:
          500,

        type:
          'entity.parse.failed'
      }),
      false
    )

    assert.equal(
      isMalformedJsonError({
        status:
          400,

        type:
          'other'
      }),
      false
    )
  }
)


test(
  'returns 400 with a safe message for malformed JSON',
  () => {
    let statusCode =
      null

    let payload =
      null

    let nextCalled =
      false

    const res = {
      status(
        value
      ) {
        statusCode =
          value

        return this
      },

      json(
        value
      ) {
        payload =
          value

        return this
      }
    }

    malformedJsonErrorHandler(
      {
        status:
          400,

        type:
          'entity.parse.failed'
      },
      {},
      res,
      () => {
        nextCalled =
          true
      }
    )

    assert.equal(
      statusCode,
      400
    )

    assert.deepEqual(
      payload,
      {
        error:
          'Invalid JSON body'
      }
    )

    assert.equal(
      nextCalled,
      false
    )
  }
)


test(
  'passes unrelated errors to the next error handler',
  () => {
    const sourceError =
      new Error(
        'unrelated'
      )

    let forwarded =
      null

    malformedJsonErrorHandler(
      sourceError,
      {},
      {},
      error => {
        forwarded =
          error
      }
    )

    assert.equal(
      forwarded,
      sourceError
    )
  }
)
