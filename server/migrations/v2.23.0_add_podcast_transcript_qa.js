'use strict'

const migrationVersion = '2.23.0'
const migrationName = `${migrationVersion}-add-podcast-transcript-qa`
const loggerPrefix = `[${migrationVersion} migration]`
const Logger = require('../Logger')

module.exports = {
  up: async (context) => {
    const { queryInterface } = context.context;
    const { Sequelize } = queryInterface.sequelize;
    
    Logger.info('[Migration] Running: add-podcast-transcript-qa');

    // Create TranscriptChunks table
    await queryInterface.createTable('TranscriptChunks', {
      id: {
        type: Sequelize.DataTypes.UUID,
        defaultValue: Sequelize.DataTypes.UUIDV4,
        primaryKey: true
      },
      episodeId: {
        type: Sequelize.DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'PodcastEpisodes',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      podcastId: {
        type: Sequelize.DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Podcasts',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      libraryId: {
        type: Sequelize.DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'Libraries',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      content: {
        type: Sequelize.DataTypes.TEXT,
        allowNull: false
      },
      startTime: {
        type: Sequelize.DataTypes.INTEGER,
        allowNull: false,
        comment: 'Start time in seconds'
      },
      endTime: {
        type: Sequelize.DataTypes.INTEGER,
        allowNull: false,
        comment: 'End time in seconds'
      },
      vectorId: {
        type: Sequelize.DataTypes.STRING,
        allowNull: false,
        comment: 'ID of the vector in ChromaDB'
      },
      createdAt: {
        type: Sequelize.DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: Sequelize.DataTypes.DATE,
        allowNull: false
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('TranscriptChunks', ['episodeId'], {
      name: 'transcript_chunks_episode_id_idx'
    });
    await queryInterface.addIndex('TranscriptChunks', ['podcastId'], {
      name: 'transcript_chunks_podcast_id_idx'
    });
    await queryInterface.addIndex('TranscriptChunks', ['libraryId'], {
      name: 'transcript_chunks_library_id_idx'
    });
    await queryInterface.addIndex('TranscriptChunks', ['vectorId'], {
      name: 'transcript_chunks_vector_id_idx'
    });
    await queryInterface.addIndex('TranscriptChunks', ['startTime', 'endTime'], {
      name: 'transcript_chunks_time_range_idx'
    });

    Logger.info('[Migration] Completed: add-podcast-transcript-qa');
  },

  down: async (context) => {
    const { queryInterface } = context.context;
    Logger.info('[Migration] Reverting: add-podcast-transcript-qa');

    // Drop indexes first
    await queryInterface.removeIndex('TranscriptChunks', 'transcript_chunks_episode_id_idx');
    await queryInterface.removeIndex('TranscriptChunks', 'transcript_chunks_podcast_id_idx');
    await queryInterface.removeIndex('TranscriptChunks', 'transcript_chunks_library_id_idx');
    await queryInterface.removeIndex('TranscriptChunks', 'transcript_chunks_vector_id_idx');
    await queryInterface.removeIndex('TranscriptChunks', 'transcript_chunks_time_range_idx');

    // Drop the table
    await queryInterface.dropTable('TranscriptChunks');

    Logger.info('[Migration] Reverted: add-podcast-transcript-qa');
  }
}; 