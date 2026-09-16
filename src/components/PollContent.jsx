import React, {
  useEffect,
  useState
} from 'react'

import {
  closePoll,
  updatePoll,
  voteOnPoll
} from '../api'


function percentage(
  count,
  total
) {
  if (!total) {
    return 0
  }

  return Math.round(
    (
      Number(count || 0) /
      Number(total)
    ) * 100
  )
}


function getTimeLabel(
  poll
) {
  if (!poll) {
    return ''
  }

  if (poll.isClosed) {
    return 'Final results'
  }

  if (!poll.closesAt) {
    return 'No expiration'
  }

  const remaining =
    new Date(
      poll.closesAt
    ).getTime() -
    Date.now()

  if (remaining <= 0) {
    return 'Final results'
  }

  const hours =
    Math.ceil(
      remaining /
      (
        1000 *
        60 *
        60
      )
    )

  if (hours < 24) {
    return `${hours} ${
      hours === 1
        ? 'hour'
        : 'hours'
    } left`
  }

  const days =
    Math.ceil(
      hours / 24
    )

  return `${days} ${
    days === 1
      ? 'day'
      : 'days'
  } left`
}


function getDurationValue(
  poll
) {
  if (!poll?.closesAt) {
    return 'none'
  }

  const remaining =
    new Date(
      poll.closesAt
    ).getTime() -
    Date.now()

  const days =
    remaining /
    (
      1000 *
      60 *
      60 *
      24
    )

  if (days <= 1.5) {
    return '1d'
  }

  if (days <= 4) {
    return '3d'
  }

  return '7d'
}


function makeEditableOptions(
  poll
) {
  return (
    poll?.options ||
    []
  ).map(
    option => ({
      id:
        option.id ||
        crypto.randomUUID(),

      value:
        option.text ||
        ''
    })
  )
}


export default function PollContent({
  post,
  session = null,
  allowClose = false,
  allowEdit = false,
  onPollChange = null,
  onPostChange = null
}) {
  const [
    poll,
    setPoll
  ] = useState(
    post?.poll ||
    null
  )

  const [
    voting,
    setVoting
  ] = useState(false)

  const [
    closing,
    setClosing
  ] = useState(false)

  const [
    editing,
    setEditing
  ] = useState(false)

  const [
    saving,
    setSaving
  ] = useState(false)

  const [
    editQuestion,
    setEditQuestion
  ] = useState('')

  const [
    editContent,
    setEditContent
  ] = useState('')

  const [
    editOptions,
    setEditOptions
  ] = useState([])

  const [
    editDuration,
    setEditDuration
  ] = useState('7d')

  const [
    error,
    setError
  ] = useState('')


  useEffect(
    () => {
      setPoll(
        post?.poll ||
        null
      )
    },
    [
      post?.poll
    ]
  )


  if (
    post?.content_type !==
      'poll' ||
    !poll
  ) {
    return null
  }


  const revealResults =
    poll.hasVoted ||
    poll.isClosed

  const structureLocked =
    Number(
      poll.totalVotes ||
      0
    ) > 0


  const updateCurrentPoll =
    nextPoll => {
      setPoll(
        nextPoll
      )

      if (onPollChange) {
        onPollChange(
          nextPoll
        )
      }
    }


  const handleVote =
    async (
      event,
      optionId
    ) => {
      event.stopPropagation()

      if (
        voting ||
        poll.isClosed
      ) {
        return
      }

      if (!session) {
        setError(
          'Log in to vote.'
        )
        return
      }

      setVoting(true)
      setError('')

      try {
        const result =
          await voteOnPoll(
            post.id,
            optionId
          )

        if (result.poll) {
          updateCurrentPoll(
            result.poll
          )
        }
      } catch (voteError) {
        setError(
          voteError.message
        )
      } finally {
        setVoting(false)
      }
    }


  const handleClose =
    async event => {
      event.stopPropagation()

      if (
        closing ||
        poll.isClosed
      ) {
        return
      }

      setClosing(true)
      setError('')

      try {
        const result =
          await closePoll(
            post.id
          )

        if (result.poll) {
          updateCurrentPoll(
            result.poll
          )
        }
      } catch (closeError) {
        setError(
          closeError.message
        )
      } finally {
        setClosing(false)
      }
    }


  const beginEdit =
    event => {
      event.stopPropagation()

      setEditQuestion(
        post.title ||
        ''
      )

      setEditContent(
        post.content ||
        ''
      )

      setEditOptions(
        makeEditableOptions(
          poll
        )
      )

      setEditDuration(
        getDurationValue(
          poll
        )
      )

      setError('')
      setEditing(true)
    }


  const cancelEdit =
    event => {
      event.stopPropagation()

      setEditing(false)
      setError('')
    }


  const updateEditOption =
    (
      id,
      value
    ) => {
      setEditOptions(
        current =>
          current.map(
            option =>
              option.id === id
                ? {
                    ...option,
                    value
                  }
                : option
          )
      )
    }


  const addEditOption =
    () => {
      if (
        editOptions.length >=
        6
      ) {
        return
      }

      setEditOptions(
        current => [
          ...current,
          {
            id:
              crypto.randomUUID(),

            value:
              ''
          }
        ]
      )
    }


  const removeEditOption =
    id => {
      if (
        editOptions.length <=
        2
      ) {
        return
      }

      setEditOptions(
        current =>
          current.filter(
            option =>
              option.id !== id
          )
      )
    }


  const moveEditOption =
    (
      index,
      direction
    ) => {
      const target =
        index + direction

      if (
        target < 0 ||
        target >=
          editOptions.length
      ) {
        return
      }

      setEditOptions(
        current => {
          const next =
            [...current]

          const temporary =
            next[index]

          next[index] =
            next[target]

          next[target] =
            temporary

          return next
        }
      )
    }


  const handleSaveEdit =
    async event => {
      event.stopPropagation()

      if (
        saving ||
        poll.isClosed
      ) {
        return
      }

      const changes = {
        content:
          editContent,

        poll_duration:
          editDuration
      }

      if (!structureLocked) {
        const question =
          editQuestion.trim()

        const options =
          editOptions.map(
            option =>
              option.value.trim()
          )

        if (!question) {
          setError(
            'Poll question is required.'
          )
          return
        }

        if (
          options.length < 2 ||
          options.some(
            option =>
              !option
          )
        ) {
          setError(
            'Poll needs at least 2 non-empty choices.'
          )
          return
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
          setError(
            'Poll choices must be different.'
          )
          return
        }

        changes.title =
          question

        changes.poll_options =
          options
      }

      setSaving(true)
      setError('')

      try {
        const result =
          await updatePoll(
            post.id,
            changes
          )

        if (result.post) {
          setPoll(
            result.post.poll
          )

          if (onPollChange) {
            onPollChange(
              result.post.poll
            )
          }

          if (onPostChange) {
            onPostChange(
              result.post
            )
          }
        }

        setEditing(false)
      } catch (saveError) {
        setError(
          saveError.message
        )
      } finally {
        setSaving(false)
      }
    }


  if (editing) {
    return (
      <div
        className="poll-content"
        onClick={
          event =>
            event.stopPropagation()
        }
      >
        {structureLocked && (
          <div className="post-create-error">
            Voting has started. The question and choices are locked, but you can still edit the supporting text and duration.
          </div>
        )}

        <label className="post-create-field">
          <span>
            Poll Question
          </span>

          <input
            value={
              editQuestion
            }
            disabled={
              structureLocked
            }
            maxLength={240}
            onChange={
              event =>
                setEditQuestion(
                  event.target.value
                )
            }
          />
        </label>

        <label className="post-create-field">
          <span>
            Supporting Text
          </span>

          <textarea
            rows={3}
            value={
              editContent
            }
            onChange={
              event =>
                setEditContent(
                  event.target.value
                )
            }
          />
        </label>

        <div className="poll-create-section">
          <div className="poll-create-heading">
            <span>
              Choices
            </span>

            <small>
              {editOptions.length}/6
            </small>
          </div>

          <div className="poll-create-options">
            {editOptions.map(
              (
                option,
                index
              ) => (
                <div
                  key={
                    option.id
                  }
                  className="poll-create-option"
                >
                  <input
                    value={
                      option.value
                    }
                    disabled={
                      structureLocked
                    }
                    maxLength={200}
                    onChange={
                      event =>
                        updateEditOption(
                          option.id,
                          event.target.value
                        )
                    }
                  />

                  {!structureLocked && (
                    <div className="poll-option-controls">
                      <button
                        type="button"
                        disabled={
                          index === 0
                        }
                        onClick={() =>
                          moveEditOption(
                            index,
                            -1
                          )
                        }
                      >
                        ↑
                      </button>

                      <button
                        type="button"
                        disabled={
                          index ===
                          editOptions.length -
                            1
                        }
                        onClick={() =>
                          moveEditOption(
                            index,
                            1
                          )
                        }
                      >
                        ↓
                      </button>

                      <button
                        type="button"
                        disabled={
                          editOptions.length <=
                          2
                        }
                        onClick={() =>
                          removeEditOption(
                            option.id
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          {!structureLocked &&
            editOptions.length < 6 && (
            <button
              type="button"
              className="poll-add-option"
              onClick={
                addEditOption
              }
            >
              + Add option
            </button>
          )}

          <label className="post-create-field poll-duration-field">
            <span>
              Poll duration
            </span>

            <select
              value={
                editDuration
              }
              onChange={
                event =>
                  setEditDuration(
                    event.target.value
                  )
              }
            >
              <option value="1d">
                1 day
              </option>

              <option value="3d">
                3 days
              </option>

              <option value="7d">
                7 days
              </option>

              <option value="none">
                No expiration
              </option>
            </select>
          </label>
        </div>

        {error && (
          <div className="poll-error">
            {error}
          </div>
        )}

        <div className="post-create-actions">
          <button
            type="button"
            className="post-create-publish"
            disabled={
              saving
            }
            onClick={
              handleSaveEdit
            }
          >
            {saving
              ? 'Saving...'
              : 'Save Changes'}
          </button>

          <button
            type="button"
            className="post-create-cancel"
            disabled={
              saving
            }
            onClick={
              cancelEdit
            }
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }


  return (
    <div
      className="poll-content"
      onClick={
        event =>
          event.stopPropagation()
      }
    >
      {post.content && (
        <p className="poll-supporting-text">
          {post.content}
        </p>
      )}

      <div className="poll-options">
        {poll.options.map(
          option => {
            const selected =
              poll.viewerOptionId ===
              option.id

            const percent =
              percentage(
                option.voteCount,
                poll.totalVotes
              )

            return (
              <button
                key={option.id}
                type="button"
                className={
                  `poll-option${
                    selected
                      ? ' selected'
                      : ''
                  }${
                    revealResults
                      ? ' showing-results'
                      : ''
                  }`
                }
                disabled={
                  voting ||
                  poll.isClosed
                }
                onClick={
                  event =>
                    handleVote(
                      event,
                      option.id
                    )
                }
              >
                {revealResults && (
                  <span
                    className="poll-option-progress"
                    style={{
                      width:
                        `${percent}%`
                    }}
                  />
                )}

                <span className="poll-option-main">
                  <span className="poll-option-indicator">
                    {selected
                      ? '●'
                      : '○'}
                  </span>

                  <span className="poll-option-text">
                    {option.text}
                  </span>

                  {revealResults && (
                    <strong className="poll-option-percent">
                      {percent}%
                    </strong>
                  )}
                </span>
              </button>
            )
          }
        )}
      </div>

      <div className="poll-footer">
        {revealResults && (
          <>
            <span>
              {poll.totalVotes}{' '}
              {poll.totalVotes === 1
                ? 'vote'
                : 'votes'}
            </span>

            <span>
              ·
            </span>
          </>
        )}

        <span>
          {getTimeLabel(
            poll
          )}
        </span>

        {allowEdit &&
          !poll.isClosed && (
          <>
            <span>
              ·
            </span>

            <button
              type="button"
              className="poll-close-btn"
              onClick={
                beginEdit
              }
            >
              Edit poll
            </button>
          </>
        )}

        {allowClose &&
          !poll.isClosed && (
          <>
            <span>
              ·
            </span>

            <button
              type="button"
              className="poll-close-btn"
              onClick={
                handleClose
              }
              disabled={
                closing
              }
            >
              {closing
                ? 'Closing...'
                : 'Close poll'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="poll-error">
          {error}
        </div>
      )}
    </div>
  )
}
