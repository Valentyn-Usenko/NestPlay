import React, { useMemo } from 'react'

const getUpvoteCount = post => {
  return (
    post.liveUpvotes ??
    post.upvotes ??
    0
  )
}

export default function RightSidebar({
  posts = [],
  onOpenPost
}) {
  const trendingGames = useMemo(() => {
    const gameMap = new Map()

    for (const post of posts) {
      if (!post.game_name) {
        continue
      }

      const key =
        post.game_id
          ? String(post.game_id)
          : post.game_name
              .trim()
              .toLowerCase()

      const postTime =
        new Date(
          post.created_at
        ).getTime()

      if (gameMap.has(key)) {
        const game =
          gameMap.get(key)

        game.postCount += 1

        if (
          !game.gameArtUrl &&
          post.game_art_url
        ) {
          game.gameArtUrl =
            post.game_art_url
        }

        if (
          postTime >
          game.latestPostTime
        ) {
          game.latestPostTime =
            postTime
        }
      } else {
        gameMap.set(key, {
          id: key,

          name:
            post.game_name,

          gameArtUrl:
            post.game_art_url ||
            null,

          postCount: 1,

          latestPostTime:
            postTime
        })
      }
    }

    return Array.from(
      gameMap.values()
    )
      .sort(
        (a, b) =>
          b.postCount -
            a.postCount ||
          b.latestPostTime -
            a.latestPostTime
      )
      .slice(0, 3)
  }, [posts])


  const popularPosts =
    useMemo(() => {
      return [...posts]
        .sort(
          (a, b) =>
            getUpvoteCount(b) -
              getUpvoteCount(a) ||
            new Date(
              b.created_at
            ).getTime() -
              new Date(
                a.created_at
              ).getTime()
        )
        .slice(0, 3)
    }, [posts])


  return (
    <aside
      className="right-sidebar"
      aria-label="Discover"
    >
      <div className="sidebar-panel">
        <div className="sidebar-heading">
          <span>
            Trending Games
          </span>

          <span className="sidebar-heading-icon">
            ↗
          </span>
        </div>

        {trendingGames.length === 0 ? (
          <div className="sidebar-empty">
            No trending games yet.
          </div>
        ) : (
          <div className="trending-games-list">
            {trendingGames.map(
              (game, index) => (
                <div
                  key={game.id}
                  className="trending-game"
                >
                  <div className="trending-rank">
                    {index + 1}
                  </div>

                  {game.gameArtUrl ? (
                    <img
                      src={
                        game.gameArtUrl
                      }
                      alt={
                        game.name
                      }
                      className="trending-game-image"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="trending-game-fallback">
                      🎮
                    </div>
                  )}

                  <div className="trending-game-info">
                    <div className="trending-game-name">
                      {game.name}
                    </div>

                    <div className="trending-game-count">
                      {
                        game.postCount
                      }{' '}
                      {
                        game.postCount ===
                        1
                          ? 'post'
                          : 'posts'
                      }
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>


      <div className="sidebar-panel">
        <div className="sidebar-heading">
          <span>
            Popular Posts
          </span>

          <span className="sidebar-heading-icon">
            ▲
          </span>
        </div>

        {popularPosts.length === 0 ? (
          <div className="sidebar-empty">
            No popular posts yet.
          </div>
        ) : (
          <div className="popular-posts-list">
            {popularPosts.map(
              post => (
                <button
                  key={post.id}
                  className="popular-post"
                  onClick={() =>
                    onOpenPost(post)
                  }
                >
                  <div className="popular-post-title">
                    {post.title}
                  </div>

                  <div className="popular-post-meta">
                    <span>
                      {post.name}
                    </span>

                    <span className="popular-post-score">
                      ▲{' '}
                      {
                        getUpvoteCount(
                          post
                        )
                      }
                    </span>
                  </div>
                </button>
              )
            )}
          </div>
        )}
      </div>
    </aside>
  )
}