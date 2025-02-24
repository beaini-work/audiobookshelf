const Router = require('@koa/router')
const Logger = require('../Logger')
const { validateAuthentication } = require('../middleware/auth')
const SummaryManager = require('../managers/SummaryManager')
const Database = require('../Database')

const router = new Router({
  prefix: '/api'
})

// Middleware to validate podcast episode access
async function validatePodcastEpisodeAccess(ctx, next) {
  const { podcastId, episodeId } = ctx.params
  
  const libraryItem = await Database.libraryItemModel.getExpandedById(podcastId)
  if (!libraryItem) {
    ctx.status = 404
    ctx.body = { error: 'Podcast not found' }
    return
  }

  const episode = libraryItem.media.podcastEpisodes.find(ep => ep.id === episodeId)
  if (!episode) {
    ctx.status = 404
    ctx.body = { error: 'Episode not found' }
    return
  }

  ctx.state.libraryItem = libraryItem
  ctx.state.episode = episode
  await next()
}

// Generate summary for an episode
router.post('/podcasts/:podcastId/episodes/:episodeId/summary', 
  validateAuthentication,
  validatePodcastEpisodeAccess,
  async (ctx) => {
    try {
      const { libraryItem, episode } = ctx.state

      // Check if summary already exists and is not in error state
      const existingSummary = await Database.PodcastEpisodeSummary.findOne({
        where: {
          episodeId: episode.id,
          status: ['completed', 'pending']
        }
      })

      if (existingSummary) {
        ctx.body = {
          status: 'exists',
          summaryId: existingSummary.id,
          message: 'Summary already exists or is being generated'
        }
        return
      }

      // Start summary generation
      await SummaryManager.startSummaryGeneration(libraryItem, episode)

      ctx.body = {
        status: 'started',
        message: 'Summary generation started'
      }
    } catch (error) {
      Logger.error('[summaryRoutes] Error starting summary generation:', error)
      ctx.status = 500
      ctx.body = { error: 'Failed to start summary generation' }
    }
  }
)

// Get summary for an episode
router.get('/podcasts/:podcastId/episodes/:episodeId/summary',
  validateAuthentication,
  validatePodcastEpisodeAccess,
  async (ctx) => {
    try {
      const { episode } = ctx.state

      const summary = await Database.PodcastEpisodeSummary.findOne({
        where: { episodeId: episode.id }
      })

      if (!summary) {
        ctx.status = 404
        ctx.body = { error: 'Summary not found' }
        return
      }

      ctx.body = {
        status: summary.status,
        summary: summary.summary,
        error: summary.error,
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt
      }
    } catch (error) {
      Logger.error('[summaryRoutes] Error retrieving summary:', error)
      ctx.status = 500
      ctx.body = { error: 'Failed to retrieve summary' }
    }
  }
)

// Get summary generation status
router.get('/podcasts/:podcastId/episodes/:episodeId/summary/status',
  validateAuthentication,
  validatePodcastEpisodeAccess,
  async (ctx) => {
    try {
      const { libraryItem, episode } = ctx.state

      // Check queue status
      const queueDetails = SummaryManager.getQueueDetails(libraryItem.libraryId)
      const isQueued = queueDetails.queue.some(item => item.episodeId === episode.id)
      const isCurrentlyProcessing = queueDetails.currentSummary?.episodeId === episode.id

      // Get summary record if exists
      const summary = await Database.PodcastEpisodeSummary.findOne({
        where: { episodeId: episode.id }
      })

      ctx.body = {
        status: summary?.status || 'not_started',
        isQueued,
        isCurrentlyProcessing,
        queuePosition: isQueued ? 
          queueDetails.queue.findIndex(item => item.episodeId === episode.id) + 1 : 
          null,
        error: summary?.error,
        updatedAt: summary?.updatedAt
      }
    } catch (error) {
      Logger.error('[summaryRoutes] Error checking summary status:', error)
      ctx.status = 500
      ctx.body = { error: 'Failed to check summary status' }
    }
  }
)

// Delete a summary
router.delete('/podcasts/:podcastId/episodes/:episodeId/summary',
  validateAuthentication,
  validatePodcastEpisodeAccess,
  async (ctx) => {
    try {
      const { episode } = ctx.state

      const summary = await Database.PodcastEpisodeSummary.findOne({
        where: { episodeId: episode.id }
      })

      if (!summary) {
        ctx.status = 404
        ctx.body = { error: 'Summary not found' }
        return
      }

      // Delete from ChromaDB if vectorDbId exists
      if (summary.vectorDbId) {
        const collection = await SummaryManager.initializeChromaDB()
        const chunkIds = summary.vectorDbId.split(',')
        await collection.delete({
          ids: chunkIds
        })
      }

      // Delete from database
      await summary.destroy()

      ctx.body = {
        status: 'deleted',
        message: 'Summary deleted successfully'
      }
    } catch (error) {
      Logger.error('[summaryRoutes] Error deleting summary:', error)
      ctx.status = 500
      ctx.body = { error: 'Failed to delete summary' }
    }
  }
)

module.exports = router 