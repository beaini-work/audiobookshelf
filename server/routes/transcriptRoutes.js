const express = require('express');
const Auth = require('../Auth');
const Logger = require('../Logger');
const TranscriptQAManager = require('../managers/TranscriptQAManager');
const Database = require('../Database');

const router = express.Router();

// Middleware to validate user has access to requested libraries
const validateLibraryAccess = async (req, res, next) => {
  try {
    const user = req.user;
    const requestedLibraryIds = req.body.libraryIds || [];

    if (!Array.isArray(requestedLibraryIds)) {
      return res.status(400).json({ error: 'libraryIds must be an array' });
    }

    // Check if user can access all libraries
    if (user.permissions?.accessAllLibraries) {
      return next();
    }

    // Check if user has access to the requested libraries
    const accessibleLibraries = user.librariesAccessible || [];
    const hasAccess = requestedLibraryIds.every(id => 
      accessibleLibraries.includes(id)
    );

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to one or more requested libraries' });
    }

    next();
  } catch (error) {
    Logger.error('[TranscriptRoutes] Access validation failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * @api {post} /api/transcripts/query Query podcast transcripts
 * @apiDescription Search across podcast transcripts with natural language queries
 * @apiName QueryTranscripts
 * @apiGroup Transcripts
 * @apiPermission user
 * 
 * @apiBody {String} query The natural language query
 * @apiBody {String[]} libraryIds Array of library IDs to search in
 * 
 * @apiSuccess {String} answer The generated answer
 * @apiSuccess {Object[]} sources Array of source references
 * @apiSuccess {String} sources.episodeId Episode ID
 * @apiSuccess {String} sources.podcastId Podcast ID
 * @apiSuccess {String} sources.timestamp Timestamp in HH:MM format
 * @apiSuccess {String} sources.podcastTitle Title of the podcast
 * @apiSuccess {String} sources.episodeTitle Title of the episode
 * @apiSuccess {String} sources.coverPath Path to episode or podcast cover image
 */
router.post('/query', validateLibraryAccess, async (req, res) => {
  try {
    const { query, libraryIds } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required and must be a string' });
    }

    // Get query results
    const result = await TranscriptQAManager.query(query, libraryIds);
    
    // Now enhance the response with episode cover images
    if (result.sources && result.sources.length > 0) {
      // Get unique podcast IDs
      const podcastIds = [...new Set(result.sources.map(source => source.podcastId))];
      
      // Fetch podcast data (containing episode information)
      const podcastsData = {};
      await Promise.all(podcastIds.map(async (podcastId) => {
        try {
          const libraryItem = await Database.libraryItemModel.getExpandedById(podcastId);
          if (libraryItem && libraryItem.isPodcast) {
            podcastsData[podcastId] = libraryItem;
          }
        } catch (err) {
          Logger.error('[TranscriptRoutes] Error fetching podcast data', err);
        }
      }));
      
      // Enhance each source with cover image URL
      result.sources = result.sources.map(source => {
        const podcast = podcastsData[source.podcastId];
        Logger.debug('[TranscriptRoutes] podcast', podcast);
        let coverPath = null;
        
        if (podcast) {
          // Try to get episode-specific cover image
          const episode = podcast.media?.podcastEpisodes?.find(ep => ep.id === source.episodeId);
          
          if (episode?.coverPath) {
            // Use episode-specific cover if available
            coverPath = episode.coverPath;
          } else if (podcast.coverPath) {
            // Fall back to podcast cover
            coverPath = podcast.coverPath;
          }
        }
        
        return {
          ...source,
          coverPath
        };
      });
    }
    
    res.json(result);
  } catch (error) {
    Logger.error('[TranscriptRoutes] Query failed', error);
    res.status(500).json({ error: 'Failed to process transcript query' });
  }
});

/**
 * @api {post} /api/transcripts/vectorize/:episodeId Vectorize episode transcript
 * @apiDescription Process an episode transcript and add it to the vector database for Q&A search
 * @apiName VectorizeTranscript
 * @apiGroup Transcripts
 * @apiPermission admin
 * 
 * @apiParam {String} episodeId Episode ID
 * @apiParam {String} podcastId Podcast ID
 * @apiParam {String} libraryId Library ID
 * 
 * @apiSuccess {Boolean} success Whether vectorization was successful
 */
router.post('/vectorize/:episodeId', async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || !req.user.isAdminOrUp) {
      return res.status(403).json({ 
        success: false, 
        error: 'Admin access required' 
      });
    }
    
    const { episodeId } = req.params;
    const { podcastId, libraryId } = req.body;

    if (!episodeId || !podcastId || !libraryId) {
      return res.status(400).json({ 
        success: false, 
        error: 'episodeId, podcastId, and libraryId are required' 
      });
    }

    // Get podcast and episode details using Database model directly
    const libraryItem = await Database.libraryItemModel.getExpandedById(podcastId);
    if (!libraryItem || !libraryItem.isPodcast) {
      return res.status(404).json({ success: false, error: 'Podcast not found' });
    }

    const episode = libraryItem.media.podcastEpisodes.find(ep => ep.id === episodeId);
    if (!episode) {
      return res.status(404).json({ success: false, error: 'Episode not found' });
    }

    if (!episode.transcript) {
      return res.status(400).json({ 
        success: false, 
        error: 'Episode does not have a transcript' 
      });
    }

    // Vectorize the transcript
    const success = await TranscriptQAManager.vectorizeEpisodeTranscript(
      episode, 
      libraryItem.media.title, 
      libraryId
    );

    return res.json({ success });
  } catch (error) {
    Logger.error('[TranscriptRoutes] Vectorization failed', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to vectorize transcript' 
    });
  }
});

/**
 * Helper function to automatically vectorize a transcript
 * Can be called after transcription is complete
 * 
 * @param {Object} episode - The episode object with transcript
 * @param {Object} podcast - The podcast object
 * @param {String} libraryId - The library ID
 * @returns {Promise<Boolean>} - Success status
 */
async function autoVectorizeTranscript(episode, podcast, libraryId) {
  if (!episode || !podcast || !libraryId) {
    Logger.warn('[TranscriptRoutes] Cannot auto-vectorize - missing required parameters');
    return false;
  }

  if (!episode.transcript) {
    Logger.warn('[TranscriptRoutes] Cannot auto-vectorize - episode has no transcript', { episodeId: episode.id });
    return false;
  }

  try {
    Logger.info(`[TranscriptRoutes] Auto-vectorizing transcript for episode: ${episode.id}`);
    const success = await TranscriptQAManager.vectorizeEpisodeTranscript(
      episode, 
      podcast.title, 
      libraryId
    );
    
    if (success) {
      Logger.info(`[TranscriptRoutes] Successfully auto-vectorized transcript for episode: ${episode.id}`);
    } else {
      Logger.warn(`[TranscriptRoutes] Failed to auto-vectorize transcript for episode: ${episode.id}`);
    }
    
    return success;
  } catch (error) {
    Logger.error('[TranscriptRoutes] Auto-vectorization failed', error);
    return false;
  }
}

// Attach helper function to router
router.autoVectorizeTranscript = autoVectorizeTranscript;

module.exports = router;