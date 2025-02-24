'use strict'

const migrationVersion = '2.21.1'
const migrationName = `${migrationVersion}-transcript-to-json`
const loggerPrefix = `[${migrationVersion} migration]`

module.exports = {
  up: async ({ context: { queryInterface } }) => {
    // Use sequelize instance from queryInterface
    const { Sequelize } = queryInterface.sequelize

    // First get all episodes with transcripts
    const episodes = await queryInterface.sequelize.query(
      'SELECT id, transcript FROM "podcastEpisodes" WHERE transcript IS NOT NULL',
      { type: Sequelize.QueryTypes.SELECT }
    )

    // Convert TEXT transcripts to JSON format
    for (const episode of episodes) {
      if (typeof episode.transcript === 'string') {
        // Convert old text transcript to new JSON format
        const structuredTranscript = [{
          transcript: episode.transcript,
          words: [] // Empty array since we don't have word timing info for old transcripts
        }]

        await queryInterface.sequelize.query(
          'UPDATE "podcastEpisodes" SET transcript = :transcript WHERE id = :id',
          {
            replacements: {
              id: episode.id,
              transcript: JSON.stringify(structuredTranscript)
            },
            type: Sequelize.QueryTypes.UPDATE
          }
        )
      }
    }

    // Change column type to JSON
    await queryInterface.changeColumn('podcastEpisodes', 'transcript', {
      type: Sequelize.DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    })
  },

  down: async ({ context: { queryInterface } }) => {
    // Use sequelize instance from queryInterface
    const { Sequelize } = queryInterface.sequelize

    // First get all episodes with JSON transcripts
    const episodes = await queryInterface.sequelize.query(
      'SELECT id, transcript FROM "podcastEpisodes" WHERE transcript IS NOT NULL',
      { type: Sequelize.QueryTypes.SELECT }
    )

    // Convert JSON transcripts back to TEXT format
    for (const episode of episodes) {
      if (typeof episode.transcript === 'object') {
        // Convert JSON transcript back to text
        const textTranscript = episode.transcript
          .map(result => result.transcript)
          .join('\n')

        await queryInterface.sequelize.query(
          'UPDATE "podcastEpisodes" SET transcript = :transcript WHERE id = :id',
          {
            replacements: {
              id: episode.id,
              transcript: textTranscript
            },
            type: Sequelize.QueryTypes.UPDATE
          }
        )
      }
    }

    // Change column type back to TEXT
    await queryInterface.changeColumn('podcastEpisodes', 'transcript', {
      type: Sequelize.DataTypes.TEXT,
      allowNull: true
    })
  }
} 