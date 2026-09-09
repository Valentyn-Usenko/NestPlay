/* global require, process */

require('dotenv').config()

const pool = require('../db')

const {
  createAchievementService
} = require('../achievements')

async function main() {
  const userId =
    process.argv[2]

  const slug =
    process.argv[3]

  if (!userId || !slug) {
    console.error(
      'Usage: node scripts/award-achievement.js <userId> <achievement-slug>'
    )

    process.exitCode = 1
    return
  }

  const service =
    createAchievementService(pool)

  try {
    await service.syncDefinitions()

    const result =
      await service.awardAchievement(
        pool,
        userId,
        slug,
        {
          awardedManually: true
        }
      )

    if (!result) {
      console.log(
        'No new unlock was created. The user may already have this achievement.'
      )

      return
    }

    console.log(
      `Awarded: ${result.name} (${slug})`
    )
  } catch (error) {
    console.error(
      'Manual achievement award failed:',
      error
    )

    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
