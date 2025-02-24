const Path = require('path')
const { Storage } = require('@google-cloud/storage')
const { SpeechClient } = require('@google-cloud/speech')
const Logger = require('../Logger')
const TaskManager = require('./TaskManager')
const Task = require('../objects/Task')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

class TranscriptionManager {
  constructor() {
    this.currentTranscription = null
    this.transcriptionQueue = []
    this.storage = new Storage()
    this.speech = new SpeechClient()
    this.bucketName = '2893ue9' // TODO: Make this configurable
  }

  getEpisodesInQueue(libraryItemId) {
    return this.transcriptionQueue.filter(t => t.libraryItemId === libraryItemId)
  }

  getDownloadQueueDetails(libraryId) {
    return {
      queue: this.transcriptionQueue.filter(t => t.libraryId === libraryId).map(t => t.toJSONForClient()),
      currentTranscription: this.currentTranscription?.toJSONForClient() || null
    }
  }

  async startTranscription(libraryItem, episode) {
    // Check if transcriptions are enabled in server settings
    if (!Database.serverSettings.transcriptionsEnabled) {
      Logger.warn('[TranscriptionManager] Transcriptions are disabled in server settings')
      return
    }

    if (this.currentTranscription) {
      // Add to queue if there's already a transcription running
      this.transcriptionQueue.push({
        libraryItemId: libraryItem.id,
        libraryId: libraryItem.libraryId,
        episodeId: episode.id,
        episodeTitle: episode.title,
        podcastTitle: libraryItem.media.title
      })
      SocketAuthority.emitter('episode_transcription_queued', {
        libraryItemId: libraryItem.id,
        libraryId: libraryItem.libraryId,
        episodeId: episode.id,
        episodeTitle: episode.title,
        podcastTitle: libraryItem.media.title
      })
      return
    }

    const taskData = {
      libraryId: libraryItem.libraryId,
      libraryItemId: libraryItem.id,
      episodeId: episode.id
    }

    const taskTitleString = {
      text: 'Transcribing episode',
      key: 'MessageTranscribingEpisode'
    }

    const taskDescriptionString = {
      text: `Transcribing episode "${episode.title}"`,
      key: 'MessageTaskTranscribingEpisodeDescription',
      subs: [episode.title]
    }

    const task = TaskManager.createAndAddTask('transcribe-episode', taskTitleString, taskDescriptionString, false, taskData)

    this.currentTranscription = {
      libraryItemId: libraryItem.id,
      libraryId: libraryItem.libraryId,
      episodeId: episode.id,
      episodeTitle: episode.title,
      podcastTitle: libraryItem.media.title
    }

    SocketAuthority.emitter('episode_transcription_started', this.currentTranscription)

    try {
      // Create bucket if it doesn't exist
      const [bucket] = await this.storage.createBucket(this.bucketName).catch(async (err) => {
        if (err.code === 409) {
          // Bucket already exists
          return [this.storage.bucket(this.bucketName)]
        }
        throw err
      })

      // Upload file to GCS
      const gcsPath = `podcasts/${libraryItem.id}/${episode.id}/${Path.basename(episode.audioFile.metadata.path)}`
      await bucket.upload(episode.audioFile.metadata.path, {
        destination: gcsPath
      })

      // Start transcription
      const [operation] = await this.speech.longRunningRecognize({
        audio: {
          uri: `gs://${this.bucketName}/${gcsPath}`
        },
        config: {
          encoding: 'MP3',
          sampleRateHertz: 44100,
          languageCode: 'en-US',
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: true,
          enableSpeakerDiarization: true,
          maxSpeakerCount: 2,
          model: 'default'
        }
      })

      // Store operation name for later polling
      episode.transcriptionOperation = operation.name
      await episode.save()

      // Start polling for transcription completion
      this.pollTranscriptionOperation(libraryItem.id, episode.id, operation, task)
    } catch (error) {
      Logger.error('[TranscriptionManager] Failed to start transcription', error)
      const taskFailedString = {
        text: 'Failed to start transcription',
        key: 'MessageTaskTranscriptionFailed'
      }
      task.setFailed(taskFailedString)
      TaskManager.taskFinished(task)
      
      this.currentTranscription = null
      if (this.transcriptionQueue.length) {
        const next = this.transcriptionQueue.shift()
        const nextLibraryItem = await Database.libraryItemModel.getExpandedById(next.libraryItemId)
        const nextEpisode = nextLibraryItem.media.podcastEpisodes.find(ep => ep.id === next.episodeId)
        if (nextLibraryItem && nextEpisode) {
          this.startTranscription(nextLibraryItem, nextEpisode)
        }
      }
    }
  }

  async pollTranscriptionOperation(libraryItemId, episodeId, operation, task) {
    try {
      const [response] = await operation.promise()

      // Get library item and episode
      const libraryItem = await Database.libraryItemModel.getExpandedById(libraryItemId)
      if (!libraryItem) {
        Logger.error(`[TranscriptionManager] Library item not found "${libraryItemId}"`)
        return
      }

      const episode = libraryItem.media.podcastEpisodes.find((ep) => ep.id === episodeId)
      if (!episode) {
        Logger.error(`[TranscriptionManager] Episode not found "${episodeId}"`)
        return
      }

      // Store structured transcript with word timestamps
      const structuredTranscript = response.results.map(result => {
        const alternative = result.alternatives[0]
        return {
          transcript: alternative.transcript,
          words: alternative.words.map(wordInfo => ({
            word: wordInfo.word,
            startTime: {
              seconds: wordInfo.startTime.seconds,
              nanos: wordInfo.startTime.nanos
            },
            endTime: {
              seconds: wordInfo.endTime.seconds,
              nanos: wordInfo.endTime.nanos
            },
            speakerTag: wordInfo.speakerTag
          }))
        }
      })

      episode.transcript = structuredTranscript
      delete episode.transcriptionOperation
      await episode.save()

      // Notify clients
      SocketAuthority.emitter('item_updated', libraryItem.toOldJSONExpanded())
      SocketAuthority.emitter('episode_transcription_finished', this.currentTranscription)

      task.setFinished()
      TaskManager.taskFinished(task)

      this.currentTranscription = null
      if (this.transcriptionQueue.length) {
        const next = this.transcriptionQueue.shift()
        const nextLibraryItem = await Database.libraryItemModel.getExpandedById(next.libraryItemId)
        const nextEpisode = nextLibraryItem.media.podcastEpisodes.find(ep => ep.id === next.episodeId)
        if (nextLibraryItem && nextEpisode) {
          this.startTranscription(nextLibraryItem, nextEpisode)
        }
      }
    } catch (error) {
      Logger.error('[TranscriptionManager] Failed to get transcription result', error)
      const taskFailedString = {
        text: 'Failed to get transcription result',
        key: 'MessageTaskTranscriptionResultFailed'
      }
      task.setFailed(taskFailedString)
      TaskManager.taskFinished(task)

      this.currentTranscription = null
      if (this.transcriptionQueue.length) {
        const next = this.transcriptionQueue.shift()
        const nextLibraryItem = await Database.libraryItemModel.getExpandedById(next.libraryItemId)
        const nextEpisode = nextLibraryItem.media.podcastEpisodes.find(ep => ep.id === next.episodeId)
        if (nextLibraryItem && nextEpisode) {
          this.startTranscription(nextLibraryItem, nextEpisode)
        }
      }
    }
  }
}

module.exports = new TranscriptionManager() 