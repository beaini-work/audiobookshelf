const { PromptTemplate } = require("@langchain/core/prompts")
const { ChatOpenAI } = require("@langchain/openai")
const { StructuredOutputParser, OutputFixingParser } = require("@langchain/core/output_parsers");
const { RunnableSequence } = require("@langchain/core/runnables");
const { z } = require("zod");
const Logger = require('../Logger');
const chromaManager = require('./ChromaManager');

class TranscriptQAManager {
  constructor() {

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      Logger.error('[SummaryManager] OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.')
      this.llm = null
      return
    }
      
    this.llm = new ChatOpenAI({
      temperature: 0,
      modelName: 'gpt-4o-mini',
      maxTokens: 500,
      apiKey: process.env.OPENAI_API_KEY, 
    });

    // Define the output schema using Zod
    this.outputSchema = z.object({
      answer: z.string().describe("The answer to the user's question based on the transcript content"),
      relevantSegments: z.array(z.object({
        timestamp: z.string().describe("Timestamp in [HH:MM] format"),
        context: z.string().describe("The relevant transcript segment"),
        episodeTitle: z.string().describe("Title of the episode"),
        podcastTitle: z.string().describe("Title of the podcast")
      })).max(3).describe("Up to 3 most relevant transcript segments with context")
    });

    // Create output parser with fixing capability
    this.outputParser = StructuredOutputParser.fromZodSchema(this.outputSchema);

    // Create the prompt template with formatting instructions
    this.qaPrompt = PromptTemplate.fromTemplate(`
You are a helpful assistant that answers questions about podcast content based on transcript segments.
Only use the information provided in the context. If you cannot find the answer in the context, say "This information wasn't found in available transcripts."
Always include episode and podcast titles in your answer, and cite timestamps in [HH:MM] format.
Limit your response to the top 3 most relevant segments.

Context: {context}
Question: {question}

Format your response as a JSON object with the following structure:
{{
  "answer": "Your answer here, citing timestamps like [23:15] when referencing content",
  "relevantSegments": [
    {{
      "timestamp": "[HH:MM]",
      "context": "The relevant transcript segment",
      "episodeTitle": "Episode title",
      "podcastTitle": "Podcast title"
    }}
  ]
}}

Response:`);
  }

  async initialize() {
    try {
      await chromaManager.initialize();
      Logger.info('[TranscriptQAManager] Successfully initialized');
    } catch (error) {
      Logger.error('[TranscriptQAManager] Failed to initialize', error);
      throw error;
    }
  }

  formatTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `[${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}]`;
  }

  async query(question, libraryIds) {
    try {
      // Query ChromaDB with library access filtering
      const results = await chromaManager.queryTranscripts(
        question,
        { libraryId: { $in: libraryIds } }
      );

      if (!results.length) {
        return {
          answer: "This information wasn't found in available transcripts",
          relevantSegments: []
        };
      }

      // Format context from results
      const context = results.map(result => {
        const { content, metadata } = result;
        return `[Episode: ${metadata.episodeTitle}, Podcast: ${metadata.podcastTitle}, Timestamp: ${this.formatTimestamp(metadata.startTime)}] ${content}`;
      }).join('\n\n');

      // Create the chain
      const chain = RunnableSequence.from([
        {
          context: (input) => input.context,
          question: (input) => input.question
        },
        this.qaPrompt,
        this.llm,
        this.outputParser
      ]);

      // Run the chain
      const response = await chain.invoke({
        question,
        context
      });

      // Transform the response to match our API format with enhanced metadata
      return {
        answer: response.answer,
        sources: response.relevantSegments.map(segment => {
          // Find the corresponding result to get metadata
          const matchingResult = results.find(r => 
            r.metadata.episodeTitle === segment.episodeTitle && 
            r.metadata.podcastTitle === segment.podcastTitle);
          
          // Format timestamp properly or handle invalid formats
          let formattedTimestamp = segment.timestamp;
          if (!formattedTimestamp || formattedTimestamp === '[NaN:NaN]') {
            formattedTimestamp = matchingResult ? 
              this.formatTimestamp(matchingResult.metadata.startTime) : 
              '[00:00]';
          }
          
          return {
            episodeId: matchingResult?.metadata.episodeId,
            podcastId: matchingResult?.metadata.podcastId,
            timestamp: formattedTimestamp,
            // Add these new fields for client-side use
            podcastTitle: matchingResult?.metadata.podcastTitle || segment.podcastTitle,
            episodeTitle: matchingResult?.metadata.episodeTitle || segment.episodeTitle
          };
        })
      };

    } catch (error) {
      Logger.error('[TranscriptQAManager] Query failed', error);
      throw error;
    }
  }

  /**
   * Vectorize transcript segments from an episode for Q&A search
   * 
   * @param {Object} episode - The episode object
   * @param {string} podcastTitle - The podcast title
   * @param {string} libraryId - The library ID
   * @returns {Promise<boolean>} - Success status
   */
  async vectorizeEpisodeTranscript(episode, podcastTitle, libraryId) {
    try {
      if (!episode || !episode.id || !episode.transcript) {
        Logger.warn('[TranscriptQAManager] Cannot vectorize - episode has no transcript', { episodeId: episode?.id });
        return false;
      }

      // Delete any existing vectors for this episode
      await chromaManager.deleteTranscriptsByEpisodeId(episode.id);
      
      Logger.info(`[TranscriptQAManager] Vectorizing transcript for episode: ${episode.id}`);
      
      // Handle both old and new transcript formats
      let segments = [];
      
      if (Array.isArray(episode.transcript.segments)) {
        // New format with dedicated segments array
        segments = episode.transcript.segments;
      } else if (episode.transcript.results && Array.isArray(episode.transcript.results)) {
        // New format where we need to use results to create segments
        segments = episode.transcript.results.map(result => {
          // Extract first and last word timestamps if available
          const words = result.words || [];
          let start = 0;
          let end = 0;
          
          if (words.length > 0) {
            start = words[0].startTime.seconds || 0;
            end = words[words.length - 1].endTime.seconds || 0;
          }
          
          return {
            text: result.transcript,
            start,
            end
          };
        });
      } else if (Array.isArray(episode.transcript)) {
        // Old format: convert transcript results to segments
        segments = episode.transcript.map(result => {
          // Extract first and last word timestamps if available
          const words = result.words || [];
          let start = 0;
          let end = 0;
          
          if (words.length > 0) {
            start = words[0].startTime.seconds || 0;
            end = words[words.length - 1].endTime.seconds || 0;
          }
          
          return {
            text: result.transcript,
            start,
            end
          };
        });
      }
      
      if (!segments.length) {
        Logger.warn('[TranscriptQAManager] Cannot vectorize - transcript has no segments', { episodeId: episode.id });
        return false;
      }
      
      // Group segments into chunks of approximately 1000 characters or 5 segments
      const chunkSize = 5;
      const chunks = [];
      
      for (let i = 0; i < segments.length; i += chunkSize) {
        const chunk = segments.slice(i, i + chunkSize);
        const startTime = chunk[0].start;
        const endTime = chunk[chunk.length - 1].end;
        const text = chunk.map(seg => seg.text).join(' ');
        
        chunks.push({
          text,
          startTime,
          endTime
        });
      }
      
      // Vectorize each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkId = `${episode.id}_${i}`;
        
        await chromaManager.addTranscriptChunk(chunk.text, {
          chunkId,
          episodeId: episode.id,
          podcastId: episode.podcastId,
          episodeTitle: episode.title,
          podcastTitle,
          startTime: chunk.startTime,
          endTime: chunk.endTime,
          libraryId
        });
      }
      
      Logger.info(`[TranscriptQAManager] Successfully vectorized ${chunks.length} chunks for episode: ${episode.id}`);
      return true;
    } catch (error) {
      Logger.error('[TranscriptQAManager] Failed to vectorize episode transcript', error);
      return false;
    }
  }
}

module.exports = new TranscriptQAManager(); 