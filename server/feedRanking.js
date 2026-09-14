function getNumberSetting(
  name,
  fallback
) {
  const rawValue =
    process.env[name]

  if (
    rawValue === undefined ||
    rawValue === ''
  ) {
    return fallback
  }

  const value =
    Number(rawValue)

  return Number.isFinite(value)
    ? value
    : fallback
}

const FEED_RANKING =
  Object.freeze({
    recencyMax:
      getNumberSetting(
        'FEED_RECENCY_MAX',
        20
      ),

    recencyWindowHours:
      getNumberSetting(
        'FEED_RECENCY_WINDOW_HOURS',
        72
      ),

    friendBoost:
      getNumberSetting(
        'FEED_FRIEND_BOOST',
        4
      ),

    friendBoostWindowHours:
      getNumberSetting(
        'FEED_FRIEND_BOOST_WINDOW_HOURS',
        168
      ),

    joinedHubBoost:
      getNumberSetting(
        'FEED_JOINED_HUB_BOOST',
        3
      ),

    upvoteWeight:
      getNumberSetting(
        'FEED_UPVOTE_WEIGHT',
        1.25
      ),

    downvoteWeight:
      getNumberSetting(
        'FEED_DOWNVOTE_WEIGHT',
        0.75
      ),

    maxEngagementBoost:
      getNumberSetting(
        'FEED_MAX_ENGAGEMENT_BOOST',
        10
      ),

    maxEngagementPenalty:
      getNumberSetting(
        'FEED_MAX_ENGAGEMENT_PENALTY',
        6
      )
  })

module.exports = {
  FEED_RANKING
}
