/* global module */

const POLL_DURATIONS =
  Object.freeze({
    '1d': '1 day',
    '3d': '3 days',
    '7d': '7 days',
    none: null
  })


function pollError(
  message
) {
  const error =
    new Error(
      message
    )

  error.statusCode =
    400

  return error
}


function normalizePollDuration(
  value
) {
  const duration =
    String(
      value ||
      '7d'
    )
      .trim()
      .toLowerCase()

  if (
    !Object.prototype
      .hasOwnProperty
      .call(
        POLL_DURATIONS,
        duration
      )
  ) {
    throw pollError(
      'Invalid poll duration'
    )
  }

  return duration
}


function normalizePollOptions(
  value
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    throw pollError(
      'Poll options are required'
    )
  }

  if (
    value.length < 2
  ) {
    throw pollError(
      'A poll requires at least 2 options'
    )
  }

  if (
    value.length > 6
  ) {
    throw pollError(
      'A poll can have at most 6 options'
    )
  }

  const options =
    value.map(
      option =>
        String(
          option ?? ''
        ).trim()
    )

  if (
    options.some(
      option =>
        !option
    )
  ) {
    throw pollError(
      'Poll options cannot be blank'
    )
  }

  if (
    options.some(
      option =>
        option.length > 200
    )
  ) {
    throw pollError(
      'Poll options must be 200 characters or fewer'
    )
  }

  const normalized =
    options.map(
      option =>
        option.toLowerCase()
    )

  if (
    new Set(
      normalized
    ).size !==
    normalized.length
  ) {
    throw pollError(
      'Poll options must be unique'
    )
  }

  return options
}


async function createPollForPost(
  client,
  postId,
  optionsValue,
  durationValue
) {
  const options =
    normalizePollOptions(
      optionsValue
    )

  const duration =
    normalizePollDuration(
      durationValue
    )

  const interval =
    POLL_DURATIONS[
      duration
    ]

  await client.query(
    `
    INSERT INTO polls (
      post_id,
      closes_at
    )

    VALUES (
      $1,

      CASE
        WHEN $2::text IS NULL
          THEN NULL
        ELSE
          NOW() +
          (
            $2::text
          )::interval
      END
    )
    `,
    [
      postId,
      interval
    ]
  )

  const positions =
    options.map(
      (
        option,
        index
      ) =>
        index
    )

  await client.query(
    `
    INSERT INTO poll_options (
      poll_id,
      option_text,
      position
    )

    SELECT
      $1,
      entry.option_text,
      entry.position

    FROM UNNEST(
      $2::text[],
      $3::smallint[]
    ) AS entry(
      option_text,
      position
    )
    `,
    [
      postId,
      options,
      positions
    ]
  )

  return {
    duration,
    options
  }
}


async function hydratePollPosts(
  db,
  userId,
  posts
) {
  if (
    !Array.isArray(
      posts
    ) ||
    posts.length === 0
  ) {
    return posts || []
  }

  const pollIds =
    posts
      .filter(
        post =>
          post.content_type ===
          'poll'
      )
      .map(
        post =>
          post.id
      )

  if (
    pollIds.length === 0
  ) {
    return posts
  }

  const result =
    await db.query(
      `
      SELECT
        pol.post_id,

        pol.closes_at,

        pol.closed_at,

        (
          pol.closed_at
            IS NOT NULL

          OR

          (
            pol.closes_at
              IS NOT NULL

            AND
            pol.closes_at <=
              NOW()
          )
        ) AS "isClosed",

        opt.id
          AS "optionId",

        opt.option_text
          AS "optionText",

        opt.position,

        COUNT(
          vote.user_id
        )::int
          AS "voteCount",

        viewer.option_id
          AS "viewerOptionId",

        (
          SUM(
            COUNT(
              vote.user_id
            )
          )
          OVER (
            PARTITION BY
              pol.post_id
          )
        )::int
          AS "totalVotes"

      FROM polls pol

      LEFT JOIN poll_options opt
        ON opt.poll_id =
          pol.post_id

      LEFT JOIN poll_votes vote
        ON vote.poll_id =
          pol.post_id

        AND
        vote.option_id =
          opt.id

      LEFT JOIN poll_votes viewer
        ON viewer.poll_id =
          pol.post_id

        AND
        viewer.user_id =
          $2::uuid

      WHERE
        pol.post_id =
          ANY(
            $1::uuid[]
          )

      GROUP BY
        pol.post_id,
        pol.closes_at,
        pol.closed_at,
        opt.id,
        opt.option_text,
        opt.position,
        viewer.option_id

      ORDER BY
        pol.post_id,
        opt.position
      `,
      [
        pollIds,
        userId
      ]
    )

  const polls =
    new Map()

  for (
    const row
    of result.rows
  ) {
    if (
      !polls.has(
        row.post_id
      )
    ) {
      polls.set(
        row.post_id,
        {
          closesAt:
            row.closes_at,

          closedAt:
            row.closed_at,

          isClosed:
            Boolean(
              row.isClosed
            ),

          totalVotes:
            Number(
              row.totalVotes ||
              0
            ),

          viewerOptionId:
            row.viewerOptionId ||
            null,

          hasVoted:
            Boolean(
              row.viewerOptionId
            ),

          options: []
        }
      )
    }

    if (
      row.optionId
    ) {
      polls
        .get(
          row.post_id
        )
        .options
        .push({
          id:
            row.optionId,

          text:
            row.optionText,

          position:
            Number(
              row.position
            ),

          voteCount:
            Number(
              row.voteCount ||
              0
            )
        })
    }
  }

  return posts.map(
    post => {
      if (
        post.content_type !==
        'poll'
      ) {
        return post
      }

      return {
        ...post,

        poll:
          polls.get(
            post.id
          ) || null
      }
    }
  )
}


module.exports = {
  POLL_DURATIONS,
  normalizePollDuration,
  normalizePollOptions,
  createPollForPost,
  hydratePollPosts
}
