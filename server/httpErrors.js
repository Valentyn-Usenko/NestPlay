/* global module */

// NESTPLAY_HTTP_ERRORS

function isMalformedJsonError(
  error
) {
  return Boolean(
    error &&
    error.status === 400 &&
    error.type ===
      'entity.parse.failed'
  )
}


function malformedJsonErrorHandler(
  error,
  req,
  res,
  next
) {
  if (
    !isMalformedJsonError(
      error
    )
  ) {
    return next(
      error
    )
  }

  return res
    .status(400)
    .json({
      error:
        'Invalid JSON body'
    })
}


module.exports = {
  isMalformedJsonError,
  malformedJsonErrorHandler
}
