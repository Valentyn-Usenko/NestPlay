const RARITIES = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary'
]

const CATEGORIES = [
  'community',
  'discussion',
  'social',
  'discovery',
  'milestones',
  'contributions',
  'fun',
  'special',
  'game-mastery'
]

const define = (
  slug,
  name,
  description,
  category,
  rarity,
  icon,
  extra = {}
) => ({
  slug,
  name,
  description,
  category,
  rarity,
  icon,
  requirementType: null,
  requirementValue: null,
  hidden: false,
  manualOnly: false,
  autoEvaluable: false,
  gameId: null,
  hubId: null,
  active: true,
  metadata: {},
  ...extra
})

const ACHIEVEMENT_DEFINITIONS = [
  // ==================================================
  // COMMUNITY / GAME HUB
  // ==================================================
  define(
    'first-steps',
    'First Steps',
    'Join your first Game Hub.',
    'community',
    'common',
    '⌂',
    {
      requirementType: 'distinct_hubs_joined',
      requirementValue: 1,
      autoEvaluable: true
    }
  ),
  define(
    'community-regular',
    'Community Regular',
    'Remain active in the same Game Hub for 30 days.',
    'community',
    'uncommon',
    '◷'
  ),
  define(
    'hub-explorer',
    'Hub Explorer',
    'Join 5 different Game Hubs.',
    'community',
    'uncommon',
    '◇',
    {
      requirementType: 'distinct_hubs_joined',
      requirementValue: 5,
      autoEvaluable: true
    }
  ),
  define(
    'world-traveler',
    'World Traveler',
    'Participate in 20 different Game Hubs.',
    'community',
    'rare',
    '◎'
  ),
  define(
    'founding-member',
    'Founding Member',
    'Be among the first members of a newly created Game Hub.',
    'community',
    'rare',
    '✦'
  ),
  define(
    'community-pillar',
    'Community Pillar',
    'Show consistent long-term activity within one community.',
    'community',
    'rare',
    '▣'
  ),
  define(
    'hub-veteran',
    'Hub Veteran',
    'Remain a member of the same Game Hub for one year.',
    'community',
    'rare',
    '⌛'
  ),

  // ==================================================
  // DISCUSSION
  // ==================================================
  define(
    'first-post',
    'First Post',
    'Create your first post.',
    'discussion',
    'common',
    '✎',
    {
      requirementType: 'posts_created',
      requirementValue: 1,
      autoEvaluable: true
    }
  ),
  define(
    'conversation-starter',
    'Conversation Starter',
    'Create a post that receives at least 10 replies.',
    'discussion',
    'rare',
    '◌',
    {
      requirementType: 'post_replies',
      requirementValue: 10,
      autoEvaluable: true
    }
  ),
  define(
    'hot-take',
    'Hot Take',
    'Create a post that reaches a high engagement threshold.',
    'discussion',
    'rare',
    '♨'
  ),
  define(
    'crowd-favorite',
    'Crowd Favorite',
    'Receive 100 total upvotes.',
    'discussion',
    'rare',
    '▲',
    {
      requirementType: 'upvotes_received',
      requirementValue: 100,
      autoEvaluable: true
    }
  ),
  define(
    'fan-favorite',
    'Fan Favorite',
    'Receive 1,000 total upvotes.',
    'discussion',
    'epic',
    '★',
    {
      requirementType: 'upvotes_received',
      requirementValue: 1000,
      autoEvaluable: true
    }
  ),
  define(
    'discussion-magnet',
    'Discussion Magnet',
    'Create multiple posts that generate large discussions.',
    'discussion',
    'epic',
    '⊛'
  ),
  define(
    'storyteller',
    'Storyteller',
    'Publish a number of substantial long-form discussion posts.',
    'discussion',
    'rare',
    '≡'
  ),
  define(
    'pollster',
    'Pollster',
    'Create your first successful community poll.',
    'discussion',
    'uncommon',
    '▥'
  ),

  // ==================================================
  // SOCIAL
  // ==================================================
  define(
    'first-friend',
    'First Friend',
    'Add your first friend.',
    'social',
    'common',
    '♧',
    {
      requirementType: 'friends',
      requirementValue: 1,
      autoEvaluable: true
    }
  ),
  define(
    'party-up',
    'Party Up',
    'Have 10 friends.',
    'social',
    'uncommon',
    '♟',
    {
      requirementType: 'friends',
      requirementValue: 10,
      autoEvaluable: true
    }
  ),
  define(
    'social-butterfly',
    'Social Butterfly',
    'Interact with many different users.',
    'social',
    'rare',
    '✣'
  ),
  define(
    'good-company',
    'Good Company',
    'Maintain friendships over a long period.',
    'social',
    'rare',
    '∞'
  ),
  define(
    'connector',
    'Connector',
    'Interact regularly across multiple communities.',
    'social',
    'rare',
    '⌁'
  ),
  define(
    'welcome-wagon',
    'Welcome Wagon',
    'Interact positively with newly joined NestPlay members.',
    'social',
    'uncommon',
    '☼'
  ),

  // ==================================================
  // DISCOVERY
  // ==================================================
  define(
    'game-explorer',
    'Game Explorer',
    'Interact with posts belonging to at least 10 different games.',
    'discovery',
    'uncommon',
    '⌖'
  ),
  define(
    'genre-hopper',
    'Genre Hopper',
    'Participate in communities across several genres.',
    'discovery',
    'uncommon',
    '↝'
  ),
  define(
    'indie-explorer',
    'Indie Explorer',
    'Participate in several indie-game communities.',
    'discovery',
    'rare',
    '◆'
  ),
  define(
    'hidden-gem-hunter',
    'Hidden Gem Hunter',
    'Contribute to smaller or less-active gaming communities.',
    'discovery',
    'rare',
    '◈'
  ),
  define(
    'backlog-destroyer',
    'Backlog Destroyer',
    'Interact with or discuss many different games over time.',
    'discovery',
    'rare',
    '✓'
  ),
  define(
    'taste-maker',
    'Taste Maker',
    'Discover or join communities before they become popular.',
    'discovery',
    'epic',
    '✧'
  ),

  // ==================================================
  // MILESTONES
  // ==================================================
  define(
    'welcome-to-nestplay',
    'Welcome to NestPlay',
    'Finish setting up your profile.',
    'milestones',
    'common',
    'N',
    {
      requirementType: 'profile_ready',
      requirementValue: 1,
      autoEvaluable: true,
      metadata: {
        implementationNote:
          'Initial rule: a valid NestPlay profile row with a non-empty username counts as profile setup.'
      }
    }
  ),
  define(
    'one-month-in',
    'One Month In',
    'Have a NestPlay account for one month.',
    'milestones',
    'common',
    '1M',
    {
      requirementType: 'account_age_days',
      requirementValue: 30,
      autoEvaluable: true
    }
  ),
  define(
    'one-year-club',
    'One Year Club',
    'Have a NestPlay account for one year.',
    'milestones',
    'rare',
    '1Y',
    {
      requirementType: 'account_age_days',
      requirementValue: 365,
      autoEvaluable: true
    }
  ),
  define(
    'og-player',
    'OG Player',
    "Create your account during NestPlay's early period.",
    'milestones',
    'epic',
    'OG'
  ),
  define(
    'early-adopter',
    'Early Adopter',
    'Join NestPlay during beta.',
    'milestones',
    'epic',
    'β'
  ),
  define(
    'founders-era',
    "Founder's Era",
    "Join during NestPlay's initial launch period.",
    'milestones',
    'legendary',
    '✦'
  ),

  // ==================================================
  // CONTRIBUTIONS
  // ==================================================
  define(
    'helpful',
    'Helpful',
    'Receive repeated positive engagement on useful replies.',
    'contributions',
    'rare',
    '＋'
  ),
  define(
    'guide-writer',
    'Guide Writer',
    'Create highly rated guides or useful tips.',
    'contributions',
    'rare',
    '▤'
  ),
  define(
    'lorekeeper',
    'Lorekeeper',
    'Become a significant contributor to lore or spoiler discussions.',
    'contributions',
    'rare',
    '⌘'
  ),
  define(
    'strategist',
    'Strategist',
    'Create highly rated strategy discussions.',
    'contributions',
    'rare',
    '♜'
  ),
  define(
    'screenshot-artist',
    'Screenshot Artist',
    'Receive strong engagement on screenshots or media posts.',
    'contributions',
    'uncommon',
    '▧'
  ),
  define(
    'reviewer',
    'Reviewer',
    'Publish thoughtful reviews for several games.',
    'contributions',
    'rare',
    '✎'
  ),
  define(
    'community-expert',
    'Community Expert',
    'Demonstrate strong participation within one specific game community.',
    'contributions',
    'rare',
    '✪'
  ),

  // ==================================================
  // FUN
  // ==================================================
  define(
    'night-owl',
    'Night Owl',
    'Frequently use NestPlay late at night.',
    'fun',
    'uncommon',
    '☾'
  ),
  define(
    'achievement-hunter',
    'Achievement Hunter',
    'Unlock a notable number of NestPlay achievements.',
    'fun',
    'rare',
    '⌑'
  ),
  define(
    'completionist',
    'Completionist',
    'Unlock every normal achievement within one category.',
    'fun',
    'epic',
    '◉'
  ),
  define(
    'lurker-no-more',
    'Lurker No More',
    'Create your first post after spending significant time browsing.',
    'fun',
    'uncommon',
    '◐'
  ),
  define(
    'against-the-crowd',
    'Against the Crowd',
    'Create a contrasting opinion that still receives meaningful engagement.',
    'fun',
    'rare',
    '⇄'
  ),
  define(
    'certified-yapper',
    'Certified Yapper',
    'Reach a very high total comment count.',
    'fun',
    'rare',
    '⋯'
  ),
  define(
    'touch-grass',
    'Touch Grass',
    'Be extremely active during a single week.',
    'fun',
    'rare',
    '♨',
    {
      hidden: true
    }
  ),
  define(
    'one-more-game',
    'One More Game',
    'Use NestPlay across several consecutive late-night sessions.',
    'fun',
    'rare',
    '↻'
  ),

  // ==================================================
  // SPECIAL
  // ==================================================
  define(
    'developer',
    'Developer',
    'Verified game developer.',
    'special',
    'epic',
    '</>',
    {
      manualOnly: true,
      metadata: { awardMode: 'verification' }
    }
  ),
  define(
    'creator',
    'Creator',
    'Verified gaming creator or streamer.',
    'special',
    'epic',
    '●',
    {
      manualOnly: true,
      metadata: { awardMode: 'verification' }
    }
  ),
  define(
    'moderator',
    'Moderator',
    'Recognized NestPlay community moderator.',
    'special',
    'epic',
    '◆',
    {
      manualOnly: true,
      metadata: { awardMode: 'verification' }
    }
  ),
  define(
    'nestplay-staff',
    'NestPlay Staff',
    'Official member of the NestPlay team.',
    'special',
    'legendary',
    'N',
    {
      manualOnly: true,
      metadata: { awardMode: 'verification' }
    }
  ),
  define(
    'bug-hunter',
    'Bug Hunter',
    'Report a meaningful bug that is verified by NestPlay.',
    'special',
    'rare',
    '⌕',
    {
      manualOnly: true,
      metadata: { awardMode: 'manual' }
    }
  ),
  define(
    'beta-tester',
    'Beta Tester',
    'Participate in an official NestPlay beta period.',
    'special',
    'epic',
    'β',
    {
      manualOnly: true,
      metadata: { awardMode: 'event' }
    }
  ),
  define(
    'event-winner',
    'Event Winner',
    'Win an official NestPlay community event.',
    'special',
    'epic',
    '♛',
    {
      manualOnly: true,
      metadata: { awardMode: 'event' }
    }
  ),
  define(
    'tournament-champion',
    'Tournament Champion',
    'Win an official NestPlay tournament.',
    'special',
    'legendary',
    '♛',
    {
      manualOnly: true,
      metadata: { awardMode: 'event' }
    }
  ),
  define(
    'community-choice',
    'Community Choice',
    'Receive special recognition through community voting or manual selection.',
    'special',
    'epic',
    '♡',
    {
      manualOnly: true,
      metadata: { awardMode: 'manual' }
    }
  ),
  define(
    'legendary-member',
    'Legendary Member',
    'Receive extremely rare long-term recognition from NestPlay.',
    'special',
    'legendary',
    '✦',
    {
      manualOnly: true,
      metadata: { awardMode: 'manual' }
    }
  )
]

// Game-specific achievements should be instantiated as real definitions with a
// concrete gameId/hubId. Keeping templates separate prevents fake locked cards
// from appearing for games a user has never touched.
const GAME_MASTERY_TEMPLATES = {
  communityVeteran: {
    name: 'Community Veteran',
    description: 'Become a long-term member of this game community.',
    category: 'game-mastery',
    rarity: 'rare',
    icon: '◇'
  },
  expert: {
    name: 'Game Expert',
    description: 'Earn strong recognition through sustained contribution to this game community.',
    category: 'game-mastery',
    rarity: 'rare',
    icon: '✪'
  }
}

function createGameMasteryDefinition({
  slug,
  template,
  gameId,
  hubId = null,
  gameName,
  gameArtUrl = null,
  requirementType = null,
  requirementValue = null,
  autoEvaluable = false,
  description = null,
  rarity = null,
  icon = null
}) {
  const base =
    GAME_MASTERY_TEMPLATES[template]

  if (!base) {
    throw new Error(
      `Unknown Game Mastery template: ${template}`
    )
  }

  if (!slug || gameId == null || !gameName) {
    throw new Error(
      'Game Mastery achievements require slug, gameId, and gameName.'
    )
  }

  return define(
    slug,
    `${gameName} ${base.name}`,
    description || base.description,
    'game-mastery',
    rarity || base.rarity,
    icon || base.icon,
    {
      requirementType,
      requirementValue,
      autoEvaluable,
      gameId: String(gameId),
      hubId:
        hubId == null
          ? null
          : String(hubId),
      metadata: {
        gameName,
        gameArtUrl,
        template
      }
    }
  )
}

module.exports = {
  ACHIEVEMENT_DEFINITIONS,
  GAME_MASTERY_TEMPLATES,
  createGameMasteryDefinition,
  RARITIES,
  CATEGORIES
}
