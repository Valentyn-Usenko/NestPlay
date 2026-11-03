const test =
  require('node:test')

const assert =
  require('node:assert/strict')

const {
  getAllowedFrontendOrigins
} =
  require('../corsOrigins')


test(
  'keeps the production frontend and adds preview origins',
  () => {
    assert.deepEqual(
      getAllowedFrontendOrigins({
        FRONTEND_URL:
          'https://main.example.com',

        FRONTEND_URLS:
          'https://preview.example.com, https://second.example.com'
      }),
      [
        'https://main.example.com',
        'https://preview.example.com',
        'https://second.example.com'
      ]
    )
  }
)


test(
  'continues supporting FRONTEND_URL by itself',
  () => {
    assert.deepEqual(
      getAllowedFrontendOrigins({
        FRONTEND_URL:
          'https://main.example.com'
      }),
      [
        'https://main.example.com'
      ]
    )
  }
)
