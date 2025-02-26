const Logger = require('../Logger')
const TaskManager = require('./TaskManager')
const Task = require('../objects/Task')
const SocketAuthority = require('../SocketAuthority')
const Database = require('../Database')
const { ChromaClient } = require('chromadb')
const { loadSummarizationChain } = require("langchain/chains")
const { ChatOpenAI } = require("@langchain/openai")
const { PromptTemplate } = require("@langchain/core/prompts")
const { Document } = require("langchain/document")
const { TokenTextSplitter } = require("langchain/text_splitter")

class SummaryManager {
  constructor() {
    this.currentSummary = null
    this.summaryQueue = []
    
    // Use environment variables for ChromaDB connection
    const chromaHost = process.env.CHROMA_HOST || 'http://10.10.2.248';
    const chromaPort = process.env.CHROMA_PORT || '8000';
    const chromaAuthProvider = process.env.CHROMA_AUTH_PROVIDER || 'basic';
    const chromaAuthCredentials = process.env.CHROMA_AUTH_CREDENTIALS || 'admin:admin';
    
    // Text splitter configuration
    this.chunkSize = parseInt(process.env.CHUNK_SIZE || '110000', 10); // Default: 110000 tokens per chunk
    this.chunkOverlap = parseInt(process.env.CHUNK_OVERLAP || '50', 10); // Default: 50 tokens overlap
    this.encodingName = process.env.ENCODING_NAME || 'cl100k_base'; // Default: OpenAI's encoding
    
    this.chromaClient = new ChromaClient({
      path: `${chromaHost}:${chromaPort}`,
      auth: {
        provider: chromaAuthProvider,
        credentials: chromaAuthCredentials
      }
    })
    this.collectionName = 'podcast_episodes'
    
    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      Logger.error('[SummaryManager] OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.')
      this.llm = null
      return
    }
    
    // Initialize LangChain components with environment variables
    try {
      this.llm = new ChatOpenAI({
        modelName: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0.3"),
        apiKey: process.env.OPENAI_API_KEY, 
      })
    } catch (error) {
      Logger.error('[SummaryManager] Failed to initialize OpenAI client:', error)
      this.llm = null
      return
    }

    this.summaryTemplate = `
You are an expert in summarizing podcast content.
Your goal is to create a comprehensive yet concise summary of a podcast episode.
Below you find a portion of the transcript:
--------
{text}
--------

Create a clear and engaging summary that captures:
1. Main topics and key points discussed
2. Important insights or conclusions
3. Any notable quotes or memorable moments
4. Key takeaways for listeners

Keep the summary focused and well-structured.

SUMMARY:
`

    this.summaryRefineTemplate = `
You are an expert in summarizing podcast content.
We have provided an existing summary up to a certain point:

EXISTING SUMMARY:
{existing_answer}

Below you find a new portion of the transcript to analyze:
--------
{text}
--------

Please refine the existing summary by:
1. Incorporating new key points and insights
2. Maintaining a coherent narrative flow
3. Avoiding redundancy
4. Preserving important details from the existing summary

If the new context isn't useful or redundant, return the original summary.

REFINED SUMMARY:
`

    this.SUMMARY_PROMPT = PromptTemplate.fromTemplate(this.summaryTemplate)
    this.SUMMARY_REFINE_PROMPT = PromptTemplate.fromTemplate(this.summaryRefineTemplate)
  }

  getSummariesInQueue(libraryItemId) {
    return this.summaryQueue.filter(t => t.libraryItemId === libraryItemId)
  }

  getQueueDetails(libraryId) {
    return {
      queue: this.summaryQueue.filter(t => t.libraryId === libraryId),
      currentSummary: this.currentSummary || null
    }
  }

  async initializeChromaDB() {
    try {
      const collection = await this.chromaClient.getOrCreateCollection({
        name: this.collectionName,
        metadata: { description: 'Podcast episode transcripts for semantic search and Q&A' }
      })
      Logger.info('[SummaryManager] ChromaDB collection initialized')
      return collection
    } catch (error) {
      Logger.error('[SummaryManager] ChromaDB initialization failed', error)
      throw error
    }
  }

  async startSummaryGeneration(libraryItem, episode) {
    if (this.currentSummary) {
      // Add to queue if there's already a summary being generated
      this.summaryQueue.push({
        libraryItemId: libraryItem.id,
        libraryId: libraryItem.libraryId,
        episodeId: episode.id,
        episodeTitle: episode.title,
        podcastTitle: libraryItem.media.title
      })
      SocketAuthority.emitter('episode_summary_queued', {
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
      text: 'Processing episode transcript and generating summary',
      key: 'MessageProcessingEpisodeTranscript'
    }

    const taskDescriptionString = {
      text: `Processing transcript and generating summary for episode "${episode.title}"`,
      key: 'MessageTaskProcessingTranscriptDescription',
      subs: [episode.title]
    }

    const task = TaskManager.createAndAddTask('summarize-episode', taskTitleString, taskDescriptionString, false, taskData)

    this.currentSummary = {
      libraryItemId: libraryItem.id,
      libraryId: libraryItem.libraryId,
      episodeId: episode.id,
      episodeTitle: episode.title,
      podcastTitle: libraryItem.media.title
    }

    SocketAuthority.emitter('episode_summary_started', this.currentSummary)

    try {
      // Check if episode has transcript
      if (!episode.transcript) {
        throw new Error('Episode transcript not found')
      }

      // Initialize ChromaDB collection
      const collection = await this.initializeChromaDB()

      // Process transcript into chunks for vector storage
      const processedChunks = await this.processTranscriptIntoChunks(episode.transcript)
      
      // Store transcript chunks in ChromaDB
      const chunkIds = processedChunks.map((_, index) => `${episode.id}_chunk_${index}`)
      await collection.add({
        ids: chunkIds,
        documents: processedChunks.map(chunk => chunk.text),
        metadatas: processedChunks.map(chunk => ({
          episodeId: episode.id,
          podcastId: libraryItem.id,
          type: 'transcript',
          ...chunk.metadata
        }))
      })

      // Generate summary using LangChain (to be implemented)
      const summary = await this.generateSummary(episode.transcript)

      // Store summary in database (but not in vector store)
      await Database.podcastEpisodeSummaryModel.create({
        episodeId: episode.id,
        summary: summary,
        summaryFormat: 'default',
        status: 'completed',
        vectorDbId: chunkIds.join(',') // Store all chunk IDs for reference
      })

      // Notify clients
      SocketAuthority.emitter('episode_summary_finished', this.currentSummary)

      task.setFinished()
      TaskManager.taskFinished(task)

      this.currentSummary = null
      if (this.summaryQueue.length) {
        const next = this.summaryQueue.shift()
        const nextLibraryItem = await Database.libraryItemModel.getExpandedById(next.libraryItemId)
        const nextEpisode = nextLibraryItem.media.podcastEpisodes.find(ep => ep.id === next.episodeId)
        if (nextLibraryItem && nextEpisode) {
          this.startSummaryGeneration(nextLibraryItem, nextEpisode)
        }
      }
    } catch (error) {
      Logger.error('[SummaryManager] Failed to process transcript and generate summary', error)
      const taskFailedString = {
        text: 'Failed to process transcript and generate summary',
        key: 'MessageTaskTranscriptProcessingFailed'
      }
      task.setFailed(taskFailedString)
      TaskManager.taskFinished(task)

      // Create failed summary record
      await Database.podcastEpisodeSummaryModel.create({
        episodeId: episode.id,
        status: 'error',
        error: error.message
      })

      this.currentSummary = null
      if (this.summaryQueue.length) {
        const next = this.summaryQueue.shift()
        const nextLibraryItem = await Database.libraryItemModel.getExpandedById(next.libraryItemId)
        const nextEpisode = nextLibraryItem.media.podcastEpisodes.find(ep => ep.id === next.episodeId)
        if (nextLibraryItem && nextEpisode) {
          this.startSummaryGeneration(nextLibraryItem, nextEpisode)
        }
      }
    }
  }

  async processTranscriptIntoChunks(transcript) {
    Logger.info('[SummaryManager] Starting transcript chunking using TokenTextSplitter');
    Logger.debug('[SummaryManager] Chunk configuration:', {
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
      encodingName: this.encodingName
    });

    // First, process transcript segments to maintain timestamp information
    const processedSegments = transcript.segments.map(segment => ({
      text: segment.text,
      startTime: segment.start || null,
      endTime: segment.end || null
    }))

    // Combine all segments into a single text while tracking segment boundaries
    let fullText = '';
    const segmentBoundaries = [];
    
    for (const segment of processedSegments) {
      const startPosition = fullText.length;
      fullText += (fullText ? ' ' : '') + segment.text;
      const endPosition = fullText.length;
      
      segmentBoundaries.push({
        text: segment.text,
        startPos: startPosition,
        endPos: endPosition,
        startTime: segment.startTime,
        endTime: segment.endTime
      });
    }

    // Use TokenTextSplitter to chunk the full text
    const tokenSplitter = new TokenTextSplitter({
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
      encodingName: this.encodingName
    });

    // Split the text into chunks - using await as splitText returns a Promise
    const textChunks = await tokenSplitter.splitText(fullText);
    Logger.debug(`[SummaryManager] Created ${textChunks.length} chunks from transcript`);
    
    // For each chunk, determine its timing information based on segment boundaries
    const chunksWithMetadata = textChunks.map((chunkText, index) => {
      // Find the chunk's position in the full text
      const chunkStartPos = fullText.indexOf(chunkText);
      const chunkEndPos = chunkStartPos + chunkText.length;
      
      // Find the segments that overlap with this chunk
      const overlappingSegments = segmentBoundaries.filter(
        segment => (segment.startPos < chunkEndPos && segment.endPos > chunkStartPos)
      );
      
      // If there are overlapping segments, use the earliest start time and latest end time
      const startTime = overlappingSegments.length 
        ? Math.min(...overlappingSegments.map(s => s.startTime).filter(t => t !== null))
        : null;
      
      const endTime = overlappingSegments.length 
        ? Math.max(...overlappingSegments.map(s => s.endTime).filter(t => t !== null))
        : null;
      
      return {
        text: chunkText,
        metadata: {
          chunkIndex: index,
          totalChunks: textChunks.length,
          startTime,
          endTime,
          sentenceCount: (chunkText.match(/[.!?]+\s/g) || []).length + 1,
          approximateTokenCount: Math.round(chunkText.length / 4), // Rough estimate of tokens
          approximateCharCount: chunkText.length
        }
      };
    });

    Logger.info(`[SummaryManager] Finished chunking transcript into ${chunksWithMetadata.length} chunks`);
    return chunksWithMetadata;
  }

  async generateSummary(transcript) {
    try {
      // Check if LLM is properly initialized
      if (!this.llm) {
        throw new Error('OpenAI client not initialized. Please check your API key configuration.')
      }

      // Convert transcript chunks to LangChain documents
      const docs = await this.processTranscriptToDocuments(transcript)
      Logger.info(`[SummaryManager] Processing ${docs.length} transcript chunks for summarization`)
      
      // Estimate total token count for all documents
      const estimatedTotalTokens = docs.reduce((sum, doc) => sum + (doc.metadata.approximateTokenCount || 0), 0)
      Logger.debug(`[SummaryManager] Estimated total tokens for summarization: ${estimatedTotalTokens}`)

      // Create the summarization chain
      const chain = loadSummarizationChain(this.llm, {
        type: "refine",
        verbose: true,
        questionPrompt: this.SUMMARY_PROMPT,
        refinePrompt: this.SUMMARY_REFINE_PROMPT
      })

      // Generate the summary
      Logger.info(`[SummaryManager] Starting LLM summarization chain`)
      const summary = await chain.run(docs)
      Logger.info(`[SummaryManager] Successfully generated summary (${summary.trim().length} characters)`)
      return summary.trim()
    } catch (error) {
      Logger.error('[SummaryManager] Error generating summary:', error)
      throw new Error('Failed to generate summary: ' + error.message)
    }
  }

  async processTranscriptToDocuments(transcript) {
    // Process transcript segments into LangChain documents
    // We'll use the same chunking logic but format for LangChain
    const chunks = await this.processTranscriptIntoChunks(transcript)
    
    return chunks.map(chunk => {
      return new Document({
        pageContent: chunk.text,
        metadata: {
          ...chunk.metadata,
          source: 'podcast_transcript'
        }
      })
    })
  }
}

module.exports = SummaryManager 