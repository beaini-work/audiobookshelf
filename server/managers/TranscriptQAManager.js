const { PromptTemplate } = require("@langchain/core/prompts")
const { ChatOpenAI } = require("@langchain/openai")
const { StructuredOutputParser, OutputFixingParser } = require("langchain/output_parsers");
const { RunnableSequence } = require("@langchain/core/runnables");
const { z } = require("zod");
const Logger = require('../Logger');
const chromaManager = require('./ChromaManager');

class TranscriptQAManager {
  constructor() {
    this.llm = new ChatOpenAI({
      temperature: 0,
      modelName: 'gpt-4o-mini',
      maxTokens: 500
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

      // Transform the response to match our API format
      return {
        answer: response.answer,
        sources: response.relevantSegments.map(segment => ({
          episodeId: results.find(r => 
            r.metadata.episodeTitle === segment.episodeTitle)?.metadata.episodeId,
          podcastId: results.find(r => 
            r.metadata.podcastTitle === segment.podcastTitle)?.metadata.podcastId,
          timestamp: segment.timestamp
        }))
      };

    } catch (error) {
      Logger.error('[TranscriptQAManager] Query failed', error);
      throw error;
    }
  }
}

module.exports = new TranscriptQAManager(); 