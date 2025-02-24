'use strict'

const migrationVersion = '2.22.0'
const migrationName = `${migrationVersion}-create-podcast-summaries`
const loggerPrefix = `[${migrationVersion} migration]`

module.exports = {
  up: async ({ context: { queryInterface } }) => {
    const { Sequelize } = queryInterface.sequelize

    await queryInterface.createTable('podcast_episode_summaries', {
      id: {
        type: Sequelize.DataTypes.UUID,
        defaultValue: Sequelize.DataTypes.UUIDV4,
        primaryKey: true
      },
      episodeId: {
        type: Sequelize.DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'podcastEpisodes',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      summary: {
        type: Sequelize.DataTypes.TEXT,
        allowNull: true
      },
      summaryFormat: {
        type: Sequelize.DataTypes.STRING,
        allowNull: false,
        defaultValue: 'default'
      },
      vectorDbId: {
        type: Sequelize.DataTypes.STRING,
        allowNull: true
      },
      status: {
        type: Sequelize.DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending'
      },
      error: {
        type: Sequelize.DataTypes.TEXT,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DataTypes.DATE,
        allowNull: false
      }
    })

    // Add index on episodeId for faster lookups
    await queryInterface.addIndex('podcast_episode_summaries', ['episodeId'])
    
    // Add index on status for filtering
    await queryInterface.addIndex('podcast_episode_summaries', ['status'])
  },

  down: async ({ context: { queryInterface } }) => {
    await queryInterface.dropTable('podcast_episode_summaries')
  }
} 