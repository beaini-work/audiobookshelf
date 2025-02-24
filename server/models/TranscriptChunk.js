const { Model, DataTypes } = require('sequelize')

class TranscriptChunk extends Model { }

// Instead of initializing immediately, export a function that initializes the model
function initTranscriptChunk(sequelize) {
  TranscriptChunk.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    episodeId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    podcastId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    libraryId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    startTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Start time in seconds'
    },
    endTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'End time in seconds'
    },
    vectorId: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'ID of the vector in ChromaDB'
    }
  }, {
    sequelize,
    modelName: 'TranscriptChunk',
    timestamps: true
  })
  
  return TranscriptChunk
}

module.exports = { TranscriptChunk, initTranscriptChunk } 