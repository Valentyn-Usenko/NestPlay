/* global require, process */

const {
  ACHIEVEMENT_DEFINITIONS,
  RARITIES,
  CATEGORIES
} = require('../achievementDefinitions')

const errors = []
const slugs = new Set()

for (const definition of ACHIEVEMENT_DEFINITIONS) {
  if (!definition.slug) {
    errors.push(
      'Achievement is missing a slug.'
    )
  } else if (slugs.has(definition.slug)) {
    errors.push(
      `Duplicate slug: ${definition.slug}`
    )
  } else {
    slugs.add(definition.slug)
  }

  if (!definition.name) {
    errors.push(
      `${definition.slug}: missing name`
    )
  }

  if (!definition.description) {
    errors.push(
      `${definition.slug}: missing description`
    )
  }

  if (!CATEGORIES.includes(definition.category)) {
    errors.push(
      `${definition.slug}: invalid category ${definition.category}`
    )
  }

  if (!RARITIES.includes(definition.rarity)) {
    errors.push(
      `${definition.slug}: invalid rarity ${definition.rarity}`
    )
  }

  if (
    definition.autoEvaluable &&
    (
      !definition.requirementType ||
      definition.requirementValue == null
    )
  ) {
    errors.push(
      `${definition.slug}: auto-evaluable achievements need requirementType and requirementValue`
    )
  }
}

if (errors.length > 0) {
  console.error(
    errors.join('\n')
  )

  process.exitCode = 1
} else {
  console.log(
    `Achievement definitions valid: ${ACHIEVEMENT_DEFINITIONS.length}`
  )
}
