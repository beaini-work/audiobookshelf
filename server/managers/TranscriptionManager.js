const Path = require('path')
const fs = require('fs')
const axios = require('axios')
const FormData = require('form-data')
const { spawn } = require('child_process')
const Logger = require('../Logger')
const TaskManager = require('./TaskManager')
const Task = require('../objects/Task')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')

class TranscriptionManager {
  constructor() {
    this.currentTranscription = null
    this.transcriptionQueue = []
    
    // OpenAI API key validation
    if (!process.env.OPENAI_API_KEY) {
      Logger.error('[TranscriptionManager] OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.')
    }
    
    // Maximum file size for Whisper API in bytes (25MB)
    this.MAX_FILE_SIZE = 25 * 1024 * 1024;
    
    // Retry configuration
    this.maxRetries = 3;
    this.retryDelayMs = 5000; // 5 seconds between retries
    
    // Failed transcription tracking
    this.failedTranscriptionMap = {};
    this.maxFailedTranscriptionAttempts = 5;
    
    // Set up polling interval (check every 1 minute for stalled operations)
    this.pollingInterval = setInterval(() => {
      this.pollTranscriptionStatus().catch(error => {
        Logger.error('[TranscriptionManager] Error in polling interval', error);
      });
    }, 1 * 60 * 1000); // 1 minute
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

  clearTranscriptionQueue(libraryItemId = null) {
    if (!this.transcriptionQueue.length) return

    if (!libraryItemId) {
      Logger.info(`[TranscriptionManager] Clearing all transcriptions in queue (${this.transcriptionQueue.length})`)
      this.transcriptionQueue = []
    } else {
      const itemTranscriptions = this.getEpisodesInQueue(libraryItemId)
      Logger.info(`[TranscriptionManager] Clearing transcriptions in queue for item "${libraryItemId}" (${itemTranscriptions.length})`)
      this.transcriptionQueue = this.transcriptionQueue.filter(t => t.libraryItemId !== libraryItemId)
      SocketAuthority.emitter('episode_transcription_queue_cleared', libraryItemId)
    }
  }

  async startTranscription(libraryItem, episode) {
    // Check if transcriptions are enabled in server settings
    if (!Database.serverSettings.transcriptionsEnabled) {
      Logger.warn('[TranscriptionManager] Transcriptions are disabled in server settings')
      return
    }

    // Validate required data
    if (!libraryItem || !episode) {
      Logger.error('[TranscriptionManager] Invalid library item or episode provided')
      return
    }

    // Validate audio file exists
    if (!episode.audioFile || !episode.audioFile.metadata || !episode.audioFile.metadata.path) {
      Logger.error(`[TranscriptionManager] Episode "${episode.id}" has no valid audio file`)
      return
    }

    // Check if audio file exists on disk
    const audioFilePath = episode.audioFile.metadata.path
    if (!fs.existsSync(audioFilePath)) {
      Logger.error(`[TranscriptionManager] Audio file does not exist at path: ${audioFilePath}`)
      return
    }

    if (this.currentTranscription) {
      // Add to queue if there's already a transcription running
      const transcriptionObject = {
        libraryItemId: libraryItem.id,
        libraryId: libraryItem.libraryId,
        episodeId: episode.id,
        episodeTitle: episode.title,
        podcastTitle: libraryItem.media.title,
        toJSONForClient: function() {
          return {
            libraryItemId: this.libraryItemId,
            libraryId: this.libraryId,
            episodeId: this.episodeId,
            episodeTitle: this.episodeTitle,
            podcastTitle: this.podcastTitle
          }
        }
      }
      this.transcriptionQueue.push(transcriptionObject)
      SocketAuthority.emitter('episode_transcription_queued', transcriptionObject.toJSONForClient())
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
      podcastTitle: libraryItem.media.title,
      toJSONForClient: function() {
        return {
          libraryItemId: this.libraryItemId,
          libraryId: this.libraryId,
          episodeId: this.episodeId,
          episodeTitle: this.episodeTitle,
          podcastTitle: this.podcastTitle
        }
      }
    }

    SocketAuthority.emitter('episode_transcription_started', this.currentTranscription.toJSONForClient())

    try {
      // Create operation ID for tracking
      const operationId = `whisper-transcription-${Date.now()}-${libraryItem.id}-${episode.id}`;
      
      // Store operation name for later polling if needed
      episode.transcriptionOperation = operationId;
      await episode.save();
      
      const audioFileStats = fs.statSync(audioFilePath);
      
      if (audioFileStats.size <= this.MAX_FILE_SIZE) {
        // File is small enough to be processed directly
        Logger.info(`[TranscriptionManager] Audio file size (${Math.round(audioFileStats.size / (1024 * 1024))}MB) is within the Whisper API limit, processing directly.`);
        const transcript = await this.transcribeWithRetry(audioFilePath);
        if (transcript) {
          await this.saveTranscription(transcript, task, episode);
        } else {
          throw new Error('Failed to get transcript after multiple attempts');
        }
      } else {
        // File exceeds size limit, needs chunking
        Logger.info(`[TranscriptionManager] Audio file size (${Math.round(audioFileStats.size / (1024 * 1024))}MB) exceeds Whisper API limit, splitting into chunks.`);
        const tempDir = Path.join(Path.dirname(audioFilePath), '.temp_chunks');
        
        // Create temporary directory for chunks if it doesn't exist
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        try {
          // Split audio file into chunks (20-minute segments to stay under 25MB)
          const chunkFiles = await this.splitAudioFile(audioFilePath, tempDir);
          
          if (!chunkFiles || chunkFiles.length === 0) {
            throw new Error('Failed to split audio file into chunks');
          }
          
          // Transcribe each chunk
          const transcriptions = [];
          let failedChunks = 0;
          
          for (let i = 0; i < chunkFiles.length; i++) {
            Logger.info(`[TranscriptionManager] Transcribing chunk ${i+1}/${chunkFiles.length}`);
            
            // Set progress safely
            try {
              if (typeof task.setProgress === 'function') {
                task.setProgress((i / chunkFiles.length) * 100);
              }
            } catch (progressError) {
              Logger.warn(`[TranscriptionManager] Could not update progress: ${progressError.message}`);
            }
            
            try {
              const chunkTranscript = await this.transcribeWithRetry(chunkFiles[i]);
              if (chunkTranscript) {
                transcriptions.push(chunkTranscript);
              } else {
                failedChunks++;
                Logger.error(`[TranscriptionManager] Failed to transcribe chunk ${i+1} after retries`);
              }
            } catch (chunkError) {
              failedChunks++;
              Logger.error(`[TranscriptionManager] Error transcribing chunk ${i+1}:`, chunkError);
            }
            
            // Remove chunk file after processing
            try {
              fs.unlinkSync(chunkFiles[i]);
            } catch (unlinkError) {
              Logger.warn(`[TranscriptionManager] Error removing chunk file: ${unlinkError.message}`);
            }
          }
          
          if (transcriptions.length === 0) {
            throw new Error('All chunks failed to transcribe');
          }
          
          if (failedChunks > 0) {
            Logger.warn(`[TranscriptionManager] ${failedChunks} of ${chunkFiles.length} chunks failed to transcribe`);
          }
          
          // Merge transcriptions
          const mergedTranscript = this.mergeTranscriptions(transcriptions);
          await this.saveTranscription(mergedTranscript, task, episode);
        } finally {
          // Clean up temporary directory
          try {
            if (fs.existsSync(tempDir)) {
              const remainingFiles = fs.readdirSync(tempDir);
              for (const file of remainingFiles) {
                fs.unlinkSync(Path.join(tempDir, file));
              }
              fs.rmdirSync(tempDir);
            }
          } catch (cleanupError) {
            Logger.warn(`[TranscriptionManager] Error cleaning up temp directory: ${cleanupError.message}`);
          }
        }
      }
      
      // Clear failed attempts on success
      delete this.failedTranscriptionMap[episode.id];
      
    } catch (error) {
      Logger.error('[TranscriptionManager] Failed to get transcription result', error.response?.data || error.message);
      
      // Track failed attempts
      if (!this.failedTranscriptionMap[episode.id]) {
        this.failedTranscriptionMap[episode.id] = 0;
      }
      this.failedTranscriptionMap[episode.id]++;
      
      // Update episode to remove in-progress operation
      try {
        delete episode.transcriptionOperation;
        await episode.save();
      } catch (saveError) {
        Logger.error('[TranscriptionManager] Error updating episode after failed transcription', saveError);
      }
      
      // Emit error event
      SocketAuthority.emitter('episode_transcription_error', {
        libraryItemId: libraryItem.id,
        episodeId: episode.id,
        error: error.message || 'Unknown error during transcription'
      });
      
      const taskFailedString = {
        text: 'Failed to get transcription result',
        key: 'MessageTaskTranscriptionResultFailed'
      }
      task.setFailed(taskFailedString);
      TaskManager.taskFinished(task);

      this.currentTranscription = null;
      if (this.transcriptionQueue.length) {
        const next = this.transcriptionQueue.shift();
        const nextLibraryItem = await Database.libraryItemModel.getExpandedById(next.libraryItemId);
        const nextEpisode = nextLibraryItem.media.podcastEpisodes.find(ep => ep.id === next.episodeId);
        if (nextLibraryItem && nextEpisode) {
          this.startTranscription(nextLibraryItem, nextEpisode);
        }
      }
    }
  }

  // Transcribe a single audio file using OpenAI's Whisper API with retry functionality
  async transcribeWithRetry(filePath, currentAttempt = 0) {
    try {
      return await this.transcribeAudioFile(filePath);
    } catch (error) {
      if (currentAttempt < this.maxRetries) {
        Logger.warn(`[TranscriptionManager] Transcription attempt ${currentAttempt + 1} failed, retrying in ${this.retryDelayMs/1000} seconds...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
        
        // Increase delay for next attempt (exponential backoff)
        this.retryDelayMs *= 1.5;
        
        return this.transcribeWithRetry(filePath, currentAttempt + 1);
      } else {
        Logger.error(`[TranscriptionManager] All ${this.maxRetries} retry attempts failed for ${filePath}`);
        return null;
      }
    }
  }

  // Transcribe a single audio file using OpenAI's Whisper API
  async transcribeAudioFile(filePath) {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    
    // Update parameters according to OpenAI documentation
    // The correct parameter is just 'response_format' with value 'verbose_json'
    // Word timestamps are included when using verbose_json format
    
    // Optional parameters
    formData.append('language', 'en');
    
    Logger.info(`[TranscriptionManager] Sending file ${filePath} to Whisper API with verbose_json format`);
    
    try {
      // Handle timeout gracefully - set timeout to 5 minutes
      const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 5 * 60 * 1000 // 5 minutes timeout
      });

      // Log the first part of the response to understand its structure
      const responseData = response.data;
      Logger.info(`[TranscriptionManager] Received response from Whisper API for ${filePath}`);
      
      // Debug: Log the shape of the response
      Logger.info(`[TranscriptionManager] Response keys: ${Object.keys(responseData).join(', ')}`);
      Logger.info(`[TranscriptionManager] Has text: ${!!responseData.text}, Text length: ${responseData.text?.length || 0}`);
      Logger.info(`[TranscriptionManager] Has segments: ${Array.isArray(responseData.segments)}, Segments count: ${responseData.segments?.length || 0}`);
      
      return this.processWhisperResponse(responseData);
    } catch (error) {
      Logger.error(`[TranscriptionManager] Error transcribing file: ${error.message}`);
      if (error.response) {
        Logger.error(`[TranscriptionManager] API error status: ${error.response.status}`);
        Logger.error(`[TranscriptionManager] API error data: ${JSON.stringify(error.response.data)}`);
      } else if (error.code === 'ECONNABORTED') {
        Logger.error('[TranscriptionManager] Request timed out');
      }
      throw error;
    }
  }

  // Split audio file into chunks of approximately 20 minutes each
  async splitAudioFile(audioFilePath, outputDir) {
    return new Promise((resolve, reject) => {
      const basename = Path.basename(audioFilePath, Path.extname(audioFilePath));
      const outputPattern = Path.join(outputDir, `${basename}_%03d${Path.extname(audioFilePath)}`);
      
      // Using ffmpeg to split the audio file into 20-minute segments
      // -c copy maintains the original codec to avoid reencoding
      // -f segment splits the file into segments
      // -segment_time 1200 makes each segment 20 minutes (1200 seconds)
      const ffmpeg = spawn('ffmpeg', [
        '-i', audioFilePath,
        '-f', 'segment',
        '-segment_time', '1200',
        '-c', 'copy',
        outputPattern
      ]);
      
      let stderr = '';
      
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
          return;
        }
        
        // Get the list of created chunk files
        fs.readdir(outputDir, (err, files) => {
          if (err) {
            reject(err);
            return;
          }
          
          const chunkFiles = files
            .filter(file => file.startsWith(`${basename}_`))
            .map(file => Path.join(outputDir, file))
            .sort(); // Ensure files are in correct order
          
          resolve(chunkFiles);
        });
      });
      
      // Handle case where ffmpeg process fails to start
      ffmpeg.on('error', (err) => {
        reject(new Error(`Failed to start ffmpeg process: ${err.message}`));
      });
      
      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        ffmpeg.kill('SIGKILL');
        reject(new Error('FFmpeg process timed out after 10 minutes'));
      }, 10 * 60 * 1000); // 10 minute timeout
      
      ffmpeg.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  // Merge multiple chunk transcriptions into a single transcript
  mergeTranscriptions(transcriptions) {
    if (transcriptions.length === 0) return null;
    if (transcriptions.length === 1) return transcriptions[0];
    
    let timeOffset = 0;
    const mergedResults = [];
    const mergedSegments = [];
    
    transcriptions.forEach(transcript => {
      if (!transcript) return; // Skip null transcripts
      
      // Process results (for word-level details)
      const adjustedResults = (transcript.results || []).map(result => {
        const adjustedWords = (result.words || []).map(word => ({
          ...word,
          startTime: {
            seconds: (word.startTime?.seconds || 0) + timeOffset,
            nanos: word.startTime?.nanos || 0
          },
          endTime: {
            seconds: (word.endTime?.seconds || 0) + timeOffset,
            nanos: word.endTime?.nanos || 0
          }
        }));
        
        return {
          transcript: result.transcript,
          words: adjustedWords
        };
      });
      
      // Process segments (for higher-level chunks)
      const adjustedSegments = (transcript.segments || []).map(segment => ({
        text: segment.text,
        start: (segment.start || 0) + timeOffset,
        end: (segment.end || 0) + timeOffset
      }));
      
      mergedResults.push(...adjustedResults);
      mergedSegments.push(...adjustedSegments);
      
      // Calculate time offset for next chunk based on the last word's end time
      if (adjustedResults.length > 0 && adjustedResults[adjustedResults.length - 1].words.length > 0) {
        const lastWords = adjustedResults[adjustedResults.length - 1].words;
        const lastWord = lastWords[lastWords.length - 1];
        timeOffset = lastWord.endTime.seconds;
      } else if (adjustedSegments.length > 0) {
        timeOffset = adjustedSegments[adjustedSegments.length - 1].end;
      }
    });
    
    return {
      results: mergedResults,
      segments: mergedSegments
    };
  }

  // Save transcription to the database and finalize the task
  async saveTranscription(structuredTranscript, task, episode) {
    try {
      // Get library item and episode
      const libraryItem = await Database.libraryItemModel.getExpandedById(this.currentTranscription.libraryItemId);
      if (!libraryItem) {
        Logger.error(`[TranscriptionManager] Library item not found "${this.currentTranscription.libraryItemId}"`);
        throw new Error(`Library item not found "${this.currentTranscription.libraryItemId}"`);
      }

      if (!episode) {
        episode = libraryItem.media.podcastEpisodes.find((ep) => ep.id === this.currentTranscription.episodeId);
        if (!episode) {
          Logger.error(`[TranscriptionManager] Episode not found "${this.currentTranscription.episodeId}"`);
          throw new Error(`Episode not found "${this.currentTranscription.episodeId}"`);
        }
      }

      // Save the transcript
      episode.transcript = structuredTranscript;
      
      // Remove the operation name to indicate completion
      delete episode.transcriptionOperation;
      await episode.save();

      // Notify clients
      SocketAuthority.emitter('item_updated', libraryItem.toOldJSONExpanded());
      SocketAuthority.emitter('episode_transcription_finished', this.currentTranscription.toJSONForClient());

      task.setFinished();
      TaskManager.taskFinished(task);

      this.currentTranscription = null;
      this.processNextInQueue();
      
      return true;
    } catch (error) {
      Logger.error(`[TranscriptionManager] Error saving transcription: ${error.message}`);
      
      const taskFailedString = {
        text: `Failed to save transcription: ${error.message}`,
        key: 'MessageTaskTranscriptionSaveFailed'
      };
      task.setFailed(taskFailedString);
      TaskManager.taskFinished(task);
      
      this.currentTranscription = null;
      this.processNextInQueue();
      
      return false;
    }
  }
  
  // Process the next item in the queue
  async processNextInQueue() {
    if (this.transcriptionQueue.length) {
      const next = this.transcriptionQueue.shift();
      try {
        const nextLibraryItem = await Database.libraryItemModel.getExpandedById(next.libraryItemId);
        if (!nextLibraryItem) {
          Logger.error(`[TranscriptionManager] Next library item not found "${next.libraryItemId}"`);
          this.processNextInQueue();
          return;
        }
        
        const nextEpisode = nextLibraryItem.media.podcastEpisodes.find(ep => ep.id === next.episodeId);
        if (!nextEpisode) {
          Logger.error(`[TranscriptionManager] Next episode not found "${next.episodeId}"`);
          this.processNextInQueue();
          return;
        }
        
        this.startTranscription(nextLibraryItem, nextEpisode);
      } catch (error) {
        Logger.error(`[TranscriptionManager] Error starting next transcription: ${error.message}`);
        this.processNextInQueue();
      }
    }
  }

  // Add method for polling operation status (compatible with old implementation)
  async pollTranscriptionStatus() {
    // This method can be called periodically to check for any stalled operations
    Logger.info('[TranscriptionManager] Checking for stalled transcription operations');
    
    try {
      // Find episodes with pending transcription operations
      const episodesWithPendingOperations = await Database.podcastEpisodeModel.findAllWithTranscriptionOperation();
      
      if (episodesWithPendingOperations.length > 0) {
        Logger.info(`[TranscriptionManager] Found ${episodesWithPendingOperations.length} episodes with pending transcription operations`);
        
        // Process each pending operation
        for (const episode of episodesWithPendingOperations) {
          try {
            // Check if operation has been running for too long (e.g., more than 1 hour)
            const operationId = episode.transcriptionOperation;
            if (!operationId) continue;
            
            const operationTimestamp = parseInt(operationId.split('-')[2], 10);
            const currentTime = Date.now();
            
            // If operation has been running for more than 1 hour, consider it stalled
            if (currentTime - operationTimestamp > 60 * 60 * 1000) {
              Logger.warn(`[TranscriptionManager] Detected stalled transcription operation for episode ${episode.id}: ${operationId}`);
              
              // Clear the stalled operation
              delete episode.transcriptionOperation;
              await episode.save();
              
              // Notify about the failure
              SocketAuthority.emitter('episode_transcription_error', {
                libraryItemId: episode.libraryItemId,
                episodeId: episode.id,
                error: 'Transcription operation timed out'
              });
              
              // If current transcription is stalled, clear it and process next in queue
              if (this.currentTranscription && this.currentTranscription.episodeId === episode.id) {
                Logger.warn(`[TranscriptionManager] Clearing stalled current transcription for episode ${episode.id}`);
                this.currentTranscription = null;
                this.processNextInQueue();
              }
            }
          } catch (episodeError) {
            Logger.error(`[TranscriptionManager] Error processing stalled operation for episode ${episode.id}:`, episodeError);
          }
        }
      }
    } catch (error) {
      Logger.error('[TranscriptionManager] Error polling transcription status', error);
    }
  }

  // Helper method to process Whisper API response into the expected format
  processWhisperResponse(whisperResponse) {
    // Extract segments and words with timestamps
    if (!whisperResponse) {
      Logger.error('[TranscriptionManager] Received empty or null response from Whisper API');
      return { results: [], segments: [] };
    }
    
    // Log the received response for debugging
    Logger.info(`[TranscriptionManager] Processing Whisper response: has text=${!!whisperResponse.text}, has segments=${!!(whisperResponse.segments && whisperResponse.segments.length)}`);
    
    const segments = whisperResponse.segments || [];
    
    if (segments.length === 0) {
      Logger.warn('[TranscriptionManager] No segments found in Whisper response');
      
      // If there's at least text in the response, create a basic segment
      if (whisperResponse.text) {
        Logger.info('[TranscriptionManager] Using text from response to create segment');
        segments.push({
          text: whisperResponse.text,
          start: 0,
          end: whisperResponse.duration || 0,
          words: []
        });
      }
    }
    
    // Create structured transcript format comparable to Google's format
    const structuredTranscript = {
      results: [],
      segments: []
    };
    
    // Process segments
    structuredTranscript.segments = segments.map(segment => ({
      text: segment.text,
      start: segment.start || 0,
      end: segment.end || 0
    }));
    
    // Process results (with words if available)
    structuredTranscript.results = segments.map(segment => {
      // Check if this segment has words
      const words = [];
      
      // In verbose_json format, words are not directly included in segments
      // We need to create them based on the segment text
      // This is a placeholder - the actual API doesn't return word-level timestamps in this way
      
      return {
        transcript: segment.text,
        words: words
      };
    });
    
    // If we have the full text but no results, create at least one result
    if (structuredTranscript.results.length === 0 && whisperResponse.text) {
      structuredTranscript.results.push({
        transcript: whisperResponse.text,
        words: []
      });
    }
    
    // Log the structure of what we're returning
    Logger.info(`[TranscriptionManager] Generated structured transcript with ${structuredTranscript.results.length} results and ${structuredTranscript.segments.length} segments`);
    
    return structuredTranscript;
  }
}

module.exports = new TranscriptionManager() 