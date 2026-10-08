import React, {
  useEffect,
  useState
} from 'react'

import {
  getSteamLibrary,
  saveSteamFavoriteGames
} from '../api'


export default function SteamFavoritesManager({
  currentGames = [],
  onSaved
}) {
  const [
    libraryOpen,
    setLibraryOpen
  ] = useState(false)

  const [
    libraryLoaded,
    setLibraryLoaded
  ] = useState(false)

  const [
    steamLibrary,
    setSteamLibrary
  ] = useState([])

  const [
    libraryVisible,
    setLibraryVisible
  ] = useState(true)

  const [
    favoriteAppIds,
    setFavoriteAppIds
  ] = useState(
    currentGames.map(
      game =>
        String(
          game.appId
        )
    )
  )

  const [
    loading,
    setLoading
  ] = useState(false)

  const [
    saving,
    setSaving
  ] = useState(false)

  const [
    error,
    setError
  ] = useState(null)

  const [
    notice,
    setNotice
  ] = useState(null)

  const [
    search,
    setSearch
  ] = useState('')


  useEffect(() => {
    setFavoriteAppIds(
      currentGames.map(
        game =>
          String(
            game.appId
          )
      )
    )
  }, [currentGames])


  const loadLibrary =
    async () => {
      if (loading) {
        return
      }

      setLoading(true)
      setError(null)

      try {
        const result =
          await getSteamLibrary()

        setSteamLibrary(
          Array.isArray(
            result?.games
          )
            ? result.games
            : []
        )

        setLibraryVisible(
          result?.visible !== false
        )

        setLibraryLoaded(true)
      } catch (loadError) {
        console.error(
          'Error loading Steam library:',
          loadError
        )

        setError(
          loadError.message ||
            'Could not load Steam library.'
        )
      } finally {
        setLoading(false)
      }
    }


  const handleLibraryToggle =
    async () => {
      if (libraryOpen) {
        setLibraryOpen(false)
        return
      }

      setLibraryOpen(true)

      if (!libraryLoaded) {
        await loadLibrary()
      }
    }


  const handleToggleFavorite =
    appId => {
      const normalizedAppId =
        String(
          appId
        )

      setError(null)
      setNotice(null)

      setFavoriteAppIds(
        previous => {
          if (
            previous.includes(
              normalizedAppId
            )
          ) {
            return previous.filter(
              id =>
                id !==
                normalizedAppId
            )
          }

          if (
            previous.length >= 6
          ) {
            setError(
              'You can display up to 6 favorite Steam games.'
            )

            return previous
          }

          return [
            ...previous,
            normalizedAppId
          ]
        }
      )
    }


  const handleMoveFavorite =
    (
      appId,
      direction
    ) => {
      const normalizedAppId =
        String(
          appId
        )

      setFavoriteAppIds(
        previous => {
          const currentIndex =
            previous.indexOf(
              normalizedAppId
            )

          if (
            currentIndex < 0
          ) {
            return previous
          }

          const nextIndex =
            currentIndex +
            direction

          if (
            nextIndex < 0 ||
            nextIndex >=
              previous.length
          ) {
            return previous
          }

          const next =
            [...previous]

          const temporary =
            next[currentIndex]

          next[currentIndex] =
            next[nextIndex]

          next[nextIndex] =
            temporary

          return next
        }
      )
    }


  const handleSave =
    async () => {
      if (saving) {
        return
      }

      setSaving(true)
      setError(null)
      setNotice(null)

      try {
        const result =
          await saveSteamFavoriteGames(
            favoriteAppIds
          )

        const savedGames =
          Array.isArray(
            result?.games
          )
            ? result.games
            : []

        setFavoriteAppIds(
          savedGames.map(
            game =>
              String(
                game.appId
              )
          )
        )

        if (onSaved) {
          onSaved(
            savedGames
          )
        }

        setNotice(
          'Favorite games saved.'
        )

        setLibraryOpen(false)
      } catch (saveError) {
        console.error(
          'Steam favorite-games save error:',
          saveError
        )

        setError(
          saveError.message ||
            'Could not save favorite Steam games.'
        )
      } finally {
        setSaving(false)
      }
    }


  const getGame =
    appId =>
      steamLibrary.find(
        game =>
          String(
            game.appId
          ) ===
          String(
            appId
          )
      ) ||
      currentGames.find(
        game =>
          String(
            game.appId
          ) ===
          String(
            appId
          )
      )


  return (
    <div className="profile-steam-editor">
      <div className="steam-selected-header">
        <span>
          Selected favorites
        </span>

        <span>
          {favoriteAppIds.length}/6
        </span>
      </div>

      {favoriteAppIds.length === 0 ? (
        <div className="steam-favorites-empty">
          No games selected.
        </div>
      ) : (
        <div className="steam-selected-list">
          {favoriteAppIds.map(
            (
              appId,
              index
            ) => {
              const game =
                getGame(
                  appId
                )

              if (!game) {
                return null
              }

              return (
                <div
                  key={game.appId}
                  className="steam-selected-game profile-steam-selected-game"
                >
                  <div className="steam-game-identity">
                    {game.iconUrl ? (
                      <img
                        src={game.iconUrl}
                        alt=""
                        aria-hidden="true"
                        className="steam-game-icon"
                      />
                    ) : (
                      <div
                        className="steam-game-icon steam-game-icon-fallback"
                        aria-hidden="true"
                      >
                        🎮
                      </div>
                    )}

                    <div className="steam-game-copy">
                      <span className="steam-game-name">
                        {game.name ||
                          `Steam App ${game.appId}`}
                      </span>

                      <span className="steam-game-hours">
                        {Number(
                          game.playtimeHours ||
                            0
                        ).toLocaleString(
                          undefined,
                          {
                            maximumFractionDigits:
                              1
                          }
                        )}{' '}
                        hrs played
                      </span>
                    </div>
                  </div>

                  <div className="steam-selected-actions">
                    <button
                      type="button"
                      className="steam-order-btn"
                      onClick={() =>
                        handleMoveFavorite(
                          game.appId,
                          -1
                        )
                      }
                      disabled={
                        index === 0 ||
                        saving
                      }
                      aria-label={
                        `Move ${game.name || 'game'} up`
                      }
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      className="steam-order-btn"
                      onClick={() =>
                        handleMoveFavorite(
                          game.appId,
                          1
                        )
                      }
                      disabled={
                        index ===
                          favoriteAppIds.length -
                            1 ||
                        saving
                      }
                      aria-label={
                        `Move ${game.name || 'game'} down`
                      }
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      className="steam-remove-favorite-btn"
                      onClick={() =>
                        handleToggleFavorite(
                          game.appId
                        )
                      }
                      disabled={
                        saving
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            }
          )}
        </div>
      )}

      {error && (
        <div className="steam-library-error">
          {error}
        </div>
      )}

      {notice && (
        <div className="profile-steam-save-notice">
          {notice}
        </div>
      )}

      <div className="profile-steam-editor-toolbar">
        <button
          type="button"
          className="profile-steam-library-btn"
          onClick={
            handleLibraryToggle
          }
          disabled={loading}
        >
          {loading
            ? 'Loading library...'
            : libraryOpen
              ? 'Hide Steam library'
              : 'Browse Steam library'}
        </button>

        <button
          type="button"
          className="steam-favorites-save-btn"
          onClick={
            handleSave
          }
          disabled={saving}
        >
          {saving
            ? 'Saving...'
            : 'Save favorites'}
        </button>
      </div>

      {libraryOpen && (
        <div className="profile-steam-library-panel">
          <div className="profile-steam-library-toolbar">
            <input
              type="search"
              className="steam-library-search"
              value={search}
              onChange={
                event =>
                  setSearch(
                    event.target.value
                  )
              }
              placeholder="Search your Steam library"
              aria-label="Search Steam library"
            />

            <button
              type="button"
              className="steam-library-refresh-btn"
              onClick={
                loadLibrary
              }
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          {!loading &&
            libraryVisible === false && (
            <div className="steam-library-private">
              <strong>
                Steam library unavailable
              </strong>

              <span>
                Your Steam game details may be
                private or unavailable.
              </span>
            </div>
          )}

          {!loading &&
            libraryVisible !== false &&
            libraryLoaded &&
            steamLibrary.length === 0 && (
            <div className="steam-favorites-empty">
              No games were found in your Steam
              library.
            </div>
          )}

          {!loading &&
            libraryVisible !== false &&
            steamLibrary.length > 0 && (
            <div className="steam-library-list">
              {steamLibrary
                .filter(
                  game => {
                    const query =
                      search
                        .trim()
                        .toLowerCase()

                    if (!query) {
                      return true
                    }

                    return String(
                      game.name ||
                        ''
                    )
                      .toLowerCase()
                      .includes(
                        query
                      )
                  }
                )
                .map(game => {
                  const selected =
                    favoriteAppIds.includes(
                      String(
                        game.appId
                      )
                    )

                  return (
                    <div
                      key={game.appId}
                      className={
                        `steam-library-game ${
                          selected
                            ? 'selected'
                            : ''
                        }`
                      }
                    >
                      <div className="steam-game-identity">
                        {game.iconUrl ? (
                          <img
                            src={game.iconUrl}
                            alt=""
                            aria-hidden="true"
                            className="steam-game-icon"
                          />
                        ) : (
                          <div
                            className="steam-game-icon steam-game-icon-fallback"
                            aria-hidden="true"
                          >
                            🎮
                          </div>
                        )}

                        <div className="steam-game-copy">
                          <span className="steam-game-name">
                            {game.name ||
                              `Steam App ${game.appId}`}
                          </span>

                          <span className="steam-game-hours">
                            {Number(
                              game.playtimeHours ||
                                0
                            ).toLocaleString(
                              undefined,
                              {
                                maximumFractionDigits:
                                  1
                              }
                            )}{' '}
                            hrs played
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={
                          `steam-favorite-toggle ${
                            selected
                              ? 'selected'
                              : ''
                          }`
                        }
                        onClick={() =>
                          handleToggleFavorite(
                            game.appId
                          )
                        }
                        disabled={
                          saving ||
                          (
                            !selected &&
                            favoriteAppIds.length >=
                              6
                          )
                        }
                        aria-pressed={
                          selected
                        }
                      >
                        {selected
                          ? 'Added'
                          : 'Add'}
                      </button>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}