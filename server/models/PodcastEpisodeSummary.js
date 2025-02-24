const { Model } = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  class PodcastEpisodeSummary extends Model {
    static associate(models) {
      PodcastEpisodeSummary.belongsTo(models.PodcastEpisode, {
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
  }

  PodcastEpisodeSummary.init({
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
    modelName: 'PodcastEpisodeSummary',
    tableName: 'podcast_episode_summaries'
  })

  return PodcastEpisodeSummary
} 