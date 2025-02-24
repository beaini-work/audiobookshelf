const express = require('express');
const Auth = require('../Auth');
const Logger = require('../Logger');
const TranscriptQAManager = require('../managers/TranscriptQAManager');

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
 */
router.post('/query', validateLibraryAccess, async (req, res) => {
  try {
    const { query, libraryIds } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required and must be a string' });
    }

    const result = await TranscriptQAManager.query(query, libraryIds);
    
    res.json(result);
  } catch (error) {
    Logger.error('[TranscriptRoutes] Query failed', error);
    res.status(500).json({ error: 'Failed to process transcript query' });
  }
});

module.exports = router; 