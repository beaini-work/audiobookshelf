const { Model, DataTypes } = require('sequelize')

class PodcastEpisodeSummary extends Model {
  static associate(models) {
    PodcastEpisodeSummary.belongsTo(models.podcastEpisode, {
      foreignKey: 'episodeId',
      as: 'episode'
    })
  }

  toJSON() {
    return {
      id: this.id,
      episodeId: this.episodeId,
      summary: this.summary,
      summaryFormat: this.summaryFormat,
      status: this.status,
      error: this.error,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  static init(sequelize) {
    super.init({
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      episodeId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'podcastEpisodes',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      summary: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      summaryFormat: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'default'
      },
      vectorDbId: {
        type: DataTypes.STRING,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending'
      },
      error: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    }, {
      sequelize,
      modelName: 'podcastEpisodeSummary',
      tableName: 'podcast_episode_summaries'
    })
  }
}

module.exports = PodcastEpisodeSummary 