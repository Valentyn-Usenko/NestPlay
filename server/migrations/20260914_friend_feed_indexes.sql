CREATE INDEX IF NOT EXISTS idx_friend_requests_accepted_receiver
ON friend_requests (
  receiver_id,
  sender_id
)
WHERE status = 'accepted';

CREATE INDEX IF NOT EXISTS idx_posts_user_created_at
ON posts (
  user_id,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS idx_votes_post_id
ON votes (
  post_id
);
