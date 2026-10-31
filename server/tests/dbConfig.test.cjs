const test =
  require('node:test')

const assert =
  require('node:assert/strict')

const {
  normalizeDbSslMode,
  isLocalDatabaseHost,
  createDatabaseSslConfig
} =
  require('../dbConfig')


test(
  'recognizes local PostgreSQL hosts',
  () => {
    assert.equal(
      isLocalDatabaseHost(
        '127.0.0.1'
      ),
      true
    )

    assert.equal(
      isLocalDatabaseHost(
        'localhost'
      ),
      true
    )

    assert.equal(
      isLocalDatabaseHost(
        '::1'
      ),
      true
    )

    assert.equal(
      isLocalDatabaseHost(
        'video-game-database.example.rds.amazonaws.com'
      ),
      false
    )
  }
)


test(
  'defaults DB SSL mode to auto',
  () => {
    assert.equal(
      normalizeDbSslMode(),
      'auto'
    )
  }
)


test(
  'rejects unsupported DB SSL modes',
  () => {
    assert.throws(
      () =>
        normalizeDbSslMode(
          'sometimes'
        ),
      /auto, disable, or require/
    )
  }
)


test(
  'disables SSL automatically for local PostgreSQL',
  () => {
    assert.equal(
      createDatabaseSslConfig({
        host:
          '127.0.0.1',

        mode:
          'auto',

        caPath:
          'not-needed.pem'
      }),
      false
    )
  }
)


test(
  'explicit disable overrides a remote host',
  () => {
    assert.equal(
      createDatabaseSslConfig({
        host:
          'db.example.com',

        mode:
          'disable',

        caPath:
          'not-needed.pem'
      }),
      false
    )
  }
)
