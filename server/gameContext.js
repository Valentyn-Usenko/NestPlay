const {
  getIgdbGameContext
} = require('./igdb')


const DEFAULT_CACHE_TTL_MS =
  24 * 60 * 60 * 1000


function parseProviderGameId(
  value
) {
  const normalized =
    String(
      value || ''
    ).trim()

  const separatorIndex =
    normalized.indexOf(':')

  if (
    separatorIndex <= 0 ||
    separatorIndex ===
      normalized.length - 1
  ) {
    return {
      raw:
        normalized,

      provider:
        null,

      externalId:
        null,

      supported:
        false
    }
  }

  const provider =
    normalized
      .slice(
        0,
        separatorIndex
      )
      .toLowerCase()

  const externalPart =
    normalized.slice(
      separatorIndex + 1
    )

  if (
    provider !==
      'igdb' ||
    !/^\d+$/.test(
      externalPart
    )
  ) {
    return {
      raw:
        normalized,

      provider,

      externalId:
        null,

      supported:
        false
    }
  }

  const externalId =
    Number(
      externalPart
    )

  if (
    !Number.isSafeInteger(
      externalId
    ) ||
    externalId <= 0
  ) {
    return {
      raw:
        normalized,

      provider,

      externalId:
        null,

      supported:
        false
    }
  }

  return {
    raw:
      `igdb:${externalId}`,

    provider:
      'igdb',

    externalId,

    supported:
      true
  }
}


function createGameContextService(
  options = {}
) {
  const fetchIgdbContext =
    options.fetchIgdbContext ||
    getIgdbGameContext

  const now =
    options.now ||
    (() => Date.now())

  const cacheTtlMs =
    Number.isFinite(
      options.cacheTtlMs
    )
      ? options.cacheTtlMs
      : DEFAULT_CACHE_TTL_MS

  const cache =
    new Map()


  async function getGameContext(
    gameId
  ) {
    const parsed =
      parseProviderGameId(
        gameId
      )

    if (!parsed.supported) {
      return {
        gameId:
          parsed.raw,

        provider:
          parsed.provider,

        supported:
          false,

        game:
          null,

        platforms:
          []
      }
    }

    const cacheKey =
      parsed.raw

    const cached =
      cache.get(
        cacheKey
      )

    const currentTime =
      now()

    if (
      cached?.value &&
      currentTime <
        cached.expiresAt
    ) {
      return cached.value
    }

    if (cached?.promise) {
      return cached.promise
    }

    const promise =
      Promise.resolve()
        .then(() =>
          fetchIgdbContext(
            parsed.externalId
          )
        )
        .then(providerContext => {
          const value = {
            gameId:
              cacheKey,

            provider:
              'igdb',

            supported:
              true,

            game:
              providerContext
                ?.game ||
              null,

            platforms:
              Array.isArray(
                providerContext
                  ?.platforms
              )
                ? providerContext
                    .platforms
                : []
          }

          cache.set(
            cacheKey,
            {
              value,

              expiresAt:
                now() +
                cacheTtlMs
            }
          )

          return value
        })
        .catch(error => {
          cache.delete(
            cacheKey
          )

          throw error
        })

    cache.set(
      cacheKey,
      {
        promise,

        expiresAt:
          0
      }
    )

    return promise
  }


  function clearCache() {
    cache.clear()
  }


  return {
    getGameContext,
    clearCache
  }
}


const defaultService =
  createGameContextService()


module.exports = {
  getGameContext:
    defaultService
      .getGameContext,

  _test: {
    DEFAULT_CACHE_TTL_MS,
    parseProviderGameId,
    createGameContextService
  }
}
