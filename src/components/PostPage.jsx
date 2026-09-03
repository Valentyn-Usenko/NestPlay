import React, {
  useEffect,
  useState
} from 'react'

import AuthModal from './AuthModal'

import {
  getPost,
  getComments,
  createComment,
  deleteComment as deleteCommentApi,
  voteOnPost,
  deletePost
} from '../api'

export default function PostPage({
  postId,
  session,
  onBack,
  onOpenProfile
}) {
  const [post, setPost] =
    useState(null)

  const [comments, setComments] =
    useState([])

  const [loading, setLoading] =
    useState(true)

  const [
    commentText,
    setCommentText
  ] = useState('')

  const [
    confirmDelete,
    setConfirmDelete
  ] = useState(false)

  const [
    hasUpvoted,
    setHasUpvoted
  ] = useState(false)

  const [
    hasDownvoted,
    setHasDownvoted
  ] = useState(false)

  const [
    upvoteCount,
    setUpvoteCount
  ] = useState(0)

  const [
    downvoteCount,
    setDownvoteCount
  ] = useState(0)

  const [
    selectedCommentId,
    setSelectedCommentId
  ] = useState(null)

  const [
    showAuthPrompt,
    setShowAuthPrompt
  ] = useState(false)

  const [
    authMode,
    setAuthMode
  ] = useState(null)

  const [
    voting,
    setVoting
  ] = useState(false)

  const uid =
    session?.user?.id


  // ==================================================
  // LOAD POST + COMMENTS
  // ==================================================

  const fetchData = async () => {
    setLoading(true)

    try {
      const [
        postData,
        commentsData
      ] = await Promise.all([
        getPost(postId),
        getComments(postId)
      ])

      setPost(postData)

      setComments(
        commentsData || []
      )

      setUpvoteCount(
        postData.liveUpvotes ?? 0
      )

      setDownvoteCount(
        postData.liveDownvotes ?? 0
      )

      setHasUpvoted(
        postData.myVote === 'up'
      )

      setHasDownvoted(
        postData.myVote === 'down'
      )
    } catch (error) {
      console.error(
        'Error loading post:',
        error
      )

      setPost(null)
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    Promise.resolve().then(() =>
      fetchData()
    )

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, session])


  // ==================================================
  // ADD COMMENT
  // ==================================================

  const addComment = async () => {
    if (!session) {
      setShowAuthPrompt(true)
      return
    }

    if (!commentText.trim()) {
      return
    }

    try {
      await createComment(
        postId,
        commentText
      )

      setCommentText('')

      await fetchData()
    } catch (error) {
      alert(
        'Error creating comment: ' +
        error.message
      )
    }
  }


  // ==================================================
  // OPTIMISTIC UPVOTE
  // ==================================================

  const upvote = async () => {
    if (!session) {
      setShowAuthPrompt(true)
      return
    }

    if (voting) {
      return
    }

    const previousUpvoteCount =
      upvoteCount

    const previousDownvoteCount =
      downvoteCount

    const previousHasUpvoted =
      hasUpvoted

    const previousHasDownvoted =
      hasDownvoted

    setVoting(true)


    // ----------------------------------------------
    // UPDATE UI IMMEDIATELY
    // ----------------------------------------------

    if (hasUpvoted) {
      setHasUpvoted(false)

      setUpvoteCount(
        Math.max(
          0,
          upvoteCount - 1
        )
      )
    }

    else if (hasDownvoted) {
      setHasDownvoted(false)
      setHasUpvoted(true)

      setDownvoteCount(
        Math.max(
          0,
          downvoteCount - 1
        )
      )

      setUpvoteCount(
        upvoteCount + 1
      )
    }

    else {
      setHasUpvoted(true)

      setUpvoteCount(
        upvoteCount + 1
      )
    }


    try {
      const result =
        await voteOnPost(
          postId,
          'up'
        )


      // ----------------------------------------------
      // SYNC WITH EXACT AWS RESULT
      // ----------------------------------------------

      setUpvoteCount(
        result.liveUpvotes ?? 0
      )

      setDownvoteCount(
        result.liveDownvotes ?? 0
      )

      setHasUpvoted(
        result.vote === 'up'
      )

      setHasDownvoted(
        result.vote === 'down'
      )
    } catch (error) {


      // ----------------------------------------------
      // ROLLBACK IF AWS FAILED
      // ----------------------------------------------

      setUpvoteCount(
        previousUpvoteCount
      )

      setDownvoteCount(
        previousDownvoteCount
      )

      setHasUpvoted(
        previousHasUpvoted
      )

      setHasDownvoted(
        previousHasDownvoted
      )

      console.error(
        'Vote failed:',
        error
      )

      alert(
        'Error voting: ' +
        error.message
      )
    } finally {
      setVoting(false)
    }
  }


  // ==================================================
  // OPTIMISTIC DOWNVOTE
  // ==================================================

  const downvote = async () => {
    if (!session) {
      setShowAuthPrompt(true)
      return
    }

    if (voting) {
      return
    }

    const previousUpvoteCount =
      upvoteCount

    const previousDownvoteCount =
      downvoteCount

    const previousHasUpvoted =
      hasUpvoted

    const previousHasDownvoted =
      hasDownvoted

    setVoting(true)


    // ----------------------------------------------
    // UPDATE UI IMMEDIATELY
    // ----------------------------------------------

    if (hasDownvoted) {
      setHasDownvoted(false)

      setDownvoteCount(
        Math.max(
          0,
          downvoteCount - 1
        )
      )
    }

    else if (hasUpvoted) {
      setHasUpvoted(false)
      setHasDownvoted(true)

      setUpvoteCount(
        Math.max(
          0,
          upvoteCount - 1
        )
      )

      setDownvoteCount(
        downvoteCount + 1
      )
    }

    else {
      setHasDownvoted(true)

      setDownvoteCount(
        downvoteCount + 1
      )
    }


    try {
      const result =
        await voteOnPost(
          postId,
          'down'
        )


      // ----------------------------------------------
      // SYNC WITH EXACT AWS RESULT
      // ----------------------------------------------

      setUpvoteCount(
        result.liveUpvotes ?? 0
      )

      setDownvoteCount(
        result.liveDownvotes ?? 0
      )

      setHasUpvoted(
        result.vote === 'up'
      )

      setHasDownvoted(
        result.vote === 'down'
      )
    } catch (error) {


      // ----------------------------------------------
      // ROLLBACK IF AWS FAILED
      // ----------------------------------------------

      setUpvoteCount(
        previousUpvoteCount
      )

      setDownvoteCount(
        previousDownvoteCount
      )

      setHasUpvoted(
        previousHasUpvoted
      )

      setHasDownvoted(
        previousHasDownvoted
      )

      console.error(
        'Vote failed:',
        error
      )

      alert(
        'Error voting: ' +
        error.message
      )
    } finally {
      setVoting(false)
    }
  }


  // ==================================================
  // DELETE POST
  // ==================================================

  const handleDelete = async () => {
    try {
      await deletePost(postId)

      onBack()
    } catch (error) {
      alert(
        'Error deleting post: ' +
        error.message
      )
    }
  }


  // ==================================================
  // DELETE COMMENT
  // ==================================================

  const handleDeleteComment =
    async commentId => {
      try {
        await deleteCommentApi(
          commentId
        )

        setSelectedCommentId(
          null
        )

        await fetchData()
      } catch (error) {
        alert(
          'Error deleting comment: ' +
          error.message
        )
      }
    }


  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <div className="global-loading">
        <div className="dot" />
        <div className="dot" />
        <div className="dot" />
      </div>
    )
  }


  if (!post) {
    return (
      <div>
        Post not found.
      </div>
    )
  }


  const isOwner =
    session?.user?.id ===
    post.user_id


  return (
    <div className="post-page">

      <button onClick={onBack}>
        ← Back
      </button>


      <h2>
        {post.title}
      </h2>


      <div className="meta">
        By{' '}

        <span
          className="author-link"
          onClick={() =>
            onOpenProfile(
              post.user_id
            )
          }
        >
          {post.name}
        </span>

        {' '}•{' '}

        {new Date(
          post.created_at
        ).toLocaleString()}
      </div>


      {post.game_art_url && (
        <img
          className="game-art"
          src={post.game_art_url}
          alt="art"
        />
      )}


      <p>
        {post.content}
      </p>


      {/* ========================================== */}
      {/* VOTES */}
      {/* ========================================== */}

      <button
        onClick={upvote}
        disabled={voting}
        style={{
          backgroundColor:
            hasUpvoted
              ? '#4CAF50'
              : ''
        }}
      >
        Upvote ({upvoteCount})
      </button>


      <button
        onClick={downvote}
        disabled={voting}
        style={{
          backgroundColor:
            hasDownvoted
              ? '#f44336'
              : ''
        }}
      >
        Downvote ({downvoteCount})
      </button>


      {/* ========================================== */}
      {/* COMMENTS */}
      {/* ========================================== */}

      <div className="comments">

        <h3>
          Comments
        </h3>


        {comments.map(c => (
          <div
            key={c.id}
            className="comment"
            style={{
              cursor: 'pointer',
              position: 'relative'
            }}
            onClick={() =>
              setSelectedCommentId(
                selectedCommentId ===
                  c.id
                  ? null
                  : c.id
              )
            }
          >

            <div className="c-meta">
              {c.name}

              {' '}•{' '}

              {new Date(
                c.created_at
              ).toLocaleString()}
            </div>


            <div>
              {c.content}
            </div>


            {selectedCommentId ===
              c.id &&
              c.user_id === uid && (

              <div
                style={{
                  marginTop: '10px',
                  padding: '10px',
                  backgroundColor:
                    '#333',
                  borderRadius:
                    '4px'
                }}
              >

                <button
                  onClick={e => {
                    e.stopPropagation()

                    handleDeleteComment(
                      c.id
                    )
                  }}
                  style={{
                    color:
                      '#f44336',
                    background:
                      'none',
                    border:
                      'none',
                    cursor:
                      'pointer'
                  }}
                >
                  Delete comment
                </button>

              </div>
            )}

          </div>
        ))}


        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-end'
          }}
        >

          <textarea
            placeholder={
              session
                ? 'Write a comment'
                : 'Log in to comment...'
            }
            value={commentText}
            onChange={e =>
              setCommentText(
                e.target.value
              )
            }
            style={{
              flex: 1,

              opacity:
                session
                  ? 1
                  : 0.5,

              cursor:
                session
                  ? 'text'
                  : 'not-allowed'
            }}
            readOnly={!session}
            onClick={() => {
              if (!session) {
                setShowAuthPrompt(
                  true
                )
              }
            }}
          />


          <button
            onClick={addComment}
          >
            Add comment
          </button>

        </div>

      </div>


      {/* ========================================== */}
      {/* DELETE POST */}
      {/* ========================================== */}

      {isOwner && (
        <div className="danger-zone">

          <h4>
            Delete post
          </h4>


          <label>

            <input
              type="checkbox"
              checked={
                confirmDelete
              }
              onChange={e =>
                setConfirmDelete(
                  e.target.checked
                )
              }
            />

            I confirm I want to
            delete this post

          </label>


          <button
            onClick={
              handleDelete
            }
            disabled={
              !confirmDelete
            }
          >
            Delete
          </button>

        </div>
      )}


      {/* ========================================== */}
      {/* AUTH PROMPT */}
      {/* ========================================== */}

      {showAuthPrompt && (
        <div className="modal-overlay">

          <div
            className="modal"
            style={{
              maxWidth:
                '420px',

              textAlign:
                'center'
            }}
          >

            <button
              className="close-btn"
              onClick={() =>
                setShowAuthPrompt(
                  false
                )
              }
            >
              ×
            </button>


            <div
              style={{
                fontSize:
                  '2.5rem',

                marginBottom:
                  '0.5rem'
              }}
            >
              🎮
            </div>


            <h2
              style={{
                marginTop: 0,

                marginBottom:
                  '0.5rem'
              }}
            >
              Join the Conversation
            </h2>


            <p
              style={{
                color: '#aaa',

                marginBottom:
                  '1.5rem',

                lineHeight:
                  '1.5'
              }}
            >
              Create a free account to
              upvote, downvote, comment,
              and share your take on
              games with the community.
            </p>


            <div
              style={{
                display:
                  'flex',

                flexDirection:
                  'column',

                gap:
                  '0.75rem'
              }}
            >

              <button
                className="btn-primary"
                style={{
                  padding:
                    '0.85rem',

                  fontSize:
                    '1rem',

                  width:
                    '100%'
                }}
                onClick={() => {
                  setShowAuthPrompt(
                    false
                  )

                  setAuthMode(
                    'signup'
                  )
                }}
              >
                Create Free Account
              </button>


              <button
                className="btn-ghost"
                style={{
                  padding:
                    '0.75rem',

                  width:
                    '100%'
                }}
                onClick={() => {
                  setShowAuthPrompt(
                    false
                  )

                  setAuthMode(
                    'login'
                  )
                }}
              >
                Already have an account?
                Log in
              </button>

            </div>

          </div>

        </div>
      )}


      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() =>
            setAuthMode(null)
          }
        />
      )}

    </div>
  )
}