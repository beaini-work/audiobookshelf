const { PromptTemplate } = require("@langchain/core/prompts")
const { ChatOpenAI } = require("@langchain/openai")
const { StructuredOutputParser, OutputFixingParser } = require("@langchain/core/output_parsers");
const { RunnableSequence } = require("@langchain/core/runnables");
const { z } = require("zod");
const Logger = require('../Logger');
const chromaManager = require('./ChromaManager');

class TranscriptQAManager {
  constructor() {
    // Hardcoded configuration variables for response customization
    this.responseStyle = 'bullet'; // Options: 'bullet', 'paragraph', 'numbered'
    this.responseLength = 'medium'; // Options: 'short', 'medium', 'long'
    
    // Similarity threshold for detecting overlapping content (0-1)
    // Higher values = less strict filtering (allows more similar content)
    // Lower values = more strict filtering (removes more similar content)
    this.similarityThreshold = 0.5; // 50% similarity is considered overlapping
    
    // Map response length to token count
    this.lengthToTokens = {
      'short': 300,
      'medium': 750,
      'long': 1500
    };

    // Validate OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      Logger.error('[SummaryManager] OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.')
      this.llm = null
      return
    }
      
    this.llm = new ChatOpenAI({
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0"),
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      maxTokens: this.lengthToTokens[this.responseLength],
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
      })).max(5).describe("Up to 5 most relevant transcript segments with context")
    });

    // Create output parser with fixing capability
    this.outputParser = StructuredOutputParser.fromZodSchema(this.outputSchema);

    // Create the prompt template with formatting instructions
    this.qaPrompt = PromptTemplate.fromTemplate(`
You are a helpful assistant that answers questions about podcast content based on transcript segments.
Only use the information provided in the context. If you cannot find the answer in the context, say "This information wasn't found in available transcripts."
Always include episode and podcast titles in your answer, and cite timestamps in [HH:MM] format.
Limit your response to the top 5 most relevant segments.

Format style: ${this.responseStyle}
Response length: ${this.responseLength}

${this.getStyleInstructions()}

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
    }},
    // Include up to 5 most relevant segments
  ]
}}

Response:`);
  }

  getStyleInstructions() {
    // Return specific instructions based on the response style
    switch(this.responseStyle) {
      case 'bullet':
        return 'Format your answer using bullet points for clarity, with each key point on a new line starting with a bullet (•).';
      case 'paragraph':
        return 'Format your answer in cohesive paragraphs with clear transitions between ideas.';
      case 'numbered':
        return 'Format your answer as a numbered list, with each key point numbered sequentially (1., 2., 3., etc.).';
      default:
        return 'Format your answer using bullet points for clarity, with each key point on a new line starting with a bullet (•).';
    }
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

  /**
   * Query transcripts and generate an answer using the LLM
   * Uses up to 50 transcript segments for context to provide comprehensive information,
   * but limits the response to the 5 most relevant segments for clarity.
   * 
   * @param {string} question - The user's question
   * @param {Array<string>} libraryIds - Array of library IDs to search in
   * @param {Object} options - Optional parameters
   * @param {string} options.style - Override the response style ('bullet', 'paragraph', 'numbered')
   * @param {string} options.length - Override the response length ('short', 'medium', 'long')
   * @returns {Promise<Object>} - Answer and sources
   */
  async query(question, libraryIds, options = {}) {
    try {
      // Apply temporary style and length overrides if provided
      const originalStyle = this.responseStyle;
      const originalLength = this.responseLength;
      const originalMaxTokens = this.llm.maxTokens;
      
      // Override style and length if provided in options
      if (options.style && ['bullet', 'paragraph', 'numbered'].includes(options.style)) {
        this.responseStyle = options.style;
      }
      
      if (options.length && this.lengthToTokens[options.length]) {
        this.responseLength = options.length;
        this.llm = new ChatOpenAI({
          ...this.llm,
          maxTokens: this.lengthToTokens[options.length]
        });
      }

      // Query ChromaDB with library access filtering
      const results = await chromaManager.queryTranscripts(
        question,
        { libraryId: { $in: libraryIds } },
        50  // Retrieve up to 50 segments for more comprehensive context
      );

      if (!results.length) {
        // Reset to original settings
        this.responseStyle = originalStyle;
        this.responseLength = originalLength;
        this.llm.maxTokens = originalMaxTokens;
        
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

      // Log the context size for debugging
      Logger.debug('[TranscriptQAManager] Context size for query:', {
        segmentsCount: results.length,
        tokensEstimate: context.split(/\s+/).length, // Rough estimate of token count
        question
      });

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

      // Log the final prompt for debugging
      const finalPrompt = await this.qaPrompt.format({
        context,
        question
      });
      Logger.debug('[TranscriptQAManager] Final prompt:', {
        prompt: finalPrompt,
        style: this.responseStyle,
        length: this.responseLength,
        maxTokens: this.llm.maxTokens
      });

      // Run the chain
      const response = await chain.invoke({
        question,
        context
      });

      // Transform the response to match our API format with enhanced metadata
      const sourcesWithMetadata = response.relevantSegments.map(segment => {
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
          episodeTitle: matchingResult?.metadata.episodeTitle || segment.episodeTitle,
          // Include the transcript content that contains the answer
          transcriptContent: matchingResult ? matchingResult.content : segment.context || ''
        };
      });

      // Filter out duplicate and overlapping sources
      const nonOverlappingSources = this.filterOverlappingSources(sourcesWithMetadata);
      Logger.debug('[TranscriptQAManager] Filtered sources from', { 
        original: sourcesWithMetadata.length, 
        filtered: nonOverlappingSources.length 
      });

      return {
        answer: response.answer,
        sources: nonOverlappingSources
      };

    } catch (error) {
      Logger.error('[TranscriptQAManager] Query failed', error);
      throw error;
    } finally {
      // Reset to original settings if they were temporarily changed
      if (options.style || options.length) {
        // Only recreate the LLM instance if the maxTokens was changed
        if (options.length && this.lengthToTokens[options.length]) {
          this.responseLength = originalLength;
          this.llm = new ChatOpenAI({
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0"),
            modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            maxTokens: this.lengthToTokens[originalLength],
            apiKey: process.env.OPENAI_API_KEY,
          });
        }
        
        if (options.style) {
          this.responseStyle = originalStyle;
        }
        
        // Recreate the prompt template to reflect the original settings
        this.qaPrompt = PromptTemplate.fromTemplate(`
You are a helpful assistant that answers questions about podcast content based on transcript segments.
Only use the information provided in the context. If you cannot find the answer in the context, say "This information wasn't found in available transcripts."
Always include episode and podcast titles in your answer, and cite timestamps in [HH:MM] format.
Limit your response to the top 5 most relevant segments.

Format style: ${this.responseStyle}
Response length: ${this.responseLength}

${this.getStyleInstructions()}

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
    }},
    // Include up to 5 most relevant segments
  ]
}}

Response:`);
      }
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
      
      // Example adaptive chunking
      const targetChunkSize = 500; // target word count
      const chunks = [];
      let currentChunk = [];
      let wordCount = 0;
      
      for (const segment of segments) {
        const segmentWordCount = segment.text.split(' ').length;
        
        if (wordCount + segmentWordCount > targetChunkSize && currentChunk.length > 0) {
          // Complete this chunk and start a new one
          chunks.push({
            text: currentChunk.map(seg => seg.text).join(' '),
            startTime: currentChunk[0].start,
            endTime: currentChunk[currentChunk.length - 1].end
          });
          currentChunk = [segment];
          wordCount = segmentWordCount;
        } else {
          // Add to current chunk
          currentChunk.push(segment);
          wordCount += segmentWordCount;
        }
      }
      
      // Add the last chunk if not empty
      if (currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.map(seg => seg.text).join(' '),
          startTime: currentChunk[0].start,
          endTime: currentChunk[currentChunk.length - 1].end
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

  filterOverlappingSources(sources) {
    if (!sources || sources.length <= 1) return sources;
    
    // First pass: Remove exact duplicates (same episodeId and timestamp)
    const uniqueSources = [];
    const seenKeys = new Set();
    
    for (const source of sources) {
      // Create a unique key for each source based on episodeId and timestamp
      const key = `${source.episodeId}-${source.timestamp}`;
      
      // Only add the source if we haven't seen this combination before
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueSources.push(source);
      }
    }
    
    if (uniqueSources.length <= 1) return uniqueSources;
    
    // Second pass: Check for content overlap
    const nonOverlappingSources = [];
    
    // Sort sources by timestamp to prioritize earlier mentions 
    // (assuming chronological order might be more important)
    const sortedSources = [...uniqueSources].sort((a, b) => {
      // Extract numeric values from timestamps [HH:MM]
      const timeA = a.timestamp.replace(/[\[\]]/g, '').split(':');
      const timeB = b.timestamp.replace(/[\[\]]/g, '').split(':');
      
      const minutesA = parseInt(timeA[0]) * 60 + parseInt(timeA[1]);
      const minutesB = parseInt(timeB[0]) * 60 + parseInt(timeB[1]);
      
      return minutesA - minutesB;
    });
    
    // Add the first source without checking (we need at least one)
    nonOverlappingSources.push(sortedSources[0]);
    
    // For each source after the first one, check overlap with all previously added sources
    for (let i = 1; i < sortedSources.length; i++) {
      const currentSource = sortedSources[i];
      let isOverlapping = false;
      let highestSimilarity = 0;
      let overlappingWithSource = null;
      
      for (const existingSource of nonOverlappingSources) {
        const similarity = this.calculateTextSimilarity(
          currentSource.transcriptContent,
          existingSource.transcriptContent
        );
        
        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          overlappingWithSource = existingSource;
        }
        
        if (similarity > this.similarityThreshold) {
          isOverlapping = true;
          break;
        }
      }
      
      if (isOverlapping) {
        Logger.debug('[TranscriptQAManager] Excluding overlapping source', {
          excluded: {
            episodeId: currentSource.episodeId,
            timestamp: currentSource.timestamp,
            episodeTitle: currentSource.episodeTitle
          },
          overlappingWith: {
            episodeId: overlappingWithSource.episodeId,
            timestamp: overlappingWithSource.timestamp,
            episodeTitle: overlappingWithSource.episodeTitle
          },
          similarityScore: highestSimilarity.toFixed(2)
        });
      } else {
        nonOverlappingSources.push(currentSource);
      }
    }
    
    return nonOverlappingSources;
  }
  
  /**
   * Calculate text similarity between two strings
   * Uses Jaccard similarity on word sets
   * 
   * @param {string} text1 - First text string
   * @param {string} text2 - Second text string
   * @returns {number} - Similarity score between 0 and 1
   */
  calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    // Tokenize texts into words, convert to lowercase, and remove punctuation
    const getWords = (text) => {
      return text.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ")
        .split(/\s+/)
        .filter(word => word.length > 0);
    };
    
    const words1 = getWords(text1);
    const words2 = getWords(text2);
    
    // Create sets for unique words
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    // Calculate Jaccard similarity: intersection size / union size
    const intersection = new Set([...set1].filter(word => set2.has(word)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }
}

module.exports = new TranscriptQAManager(); 