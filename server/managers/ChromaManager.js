const { ChromaClient, Collection } = require('chromadb');
const Logger = require('../Logger');
const path = require('path');

class ChromaManager {
  constructor() {
    // Use environment variables for ChromaDB connection
    const chromaHost = process.env.CHROMA_HOST || 'http://10.10.2.248';
    const chromaPort = process.env.CHROMA_PORT || '8000';
    const chromaAuthProvider = process.env.CHROMA_AUTH_PROVIDER || 'basic';
    const chromaAuthCredentials = process.env.CHROMA_AUTH_CREDENTIALS || 'admin:admin';
    
    this.client = new ChromaClient({
      path: `${chromaHost}:${chromaPort}`,
      auth: {
        provider: chromaAuthProvider,
        credentials: chromaAuthCredentials
      }
    });
    this.collection = null;
    this.collectionName = 'podcast_transcripts';
  }

  async initialize() {
    try {
      // Test connection first
      try {
        await this.client.heartbeat();
        Logger.info('[ChromaManager] ChromaDB connection successful');
      } catch (error) {
        Logger.error('[ChromaManager] ChromaDB connection failed', error);
        Logger.warn('[ChromaManager] Make sure ChromaDB is running: docker run -p 8000:8000 chromadb/chroma:latest');
        throw new Error('ChromaDB connection failed');
      }

      this.collection = await this.client.getOrCreateCollection({
        name: this.collectionName,
        metadata: {
          description: "Consolidated podcast transcript embeddings"
        }
      });
      Logger.info('[ChromaManager] Successfully initialized ChromaDB collection');
    } catch (error) {
      Logger.error('[ChromaManager] Failed to initialize ChromaDB', error);
      throw error;
    }
  }

  async addTranscriptChunk(chunk, metadata) {
    if (!this.collection) {
      throw new Error('ChromaDB collection not initialized');
    }

    try {
      await this.collection.add({
        ids: [metadata.chunkId],
        documents: [chunk],
        metadatas: [{
          episodeId: metadata.episodeId,
          podcastId: metadata.podcastId,
          episodeTitle: metadata.episodeTitle,
          podcastTitle: metadata.podcastTitle,
          startTime: metadata.startTime,
          endTime: metadata.endTime,
          libraryId: metadata.libraryId
        }]
      });
    } catch (error) {
      Logger.error('[ChromaManager] Failed to add transcript chunk', error);
      throw error;
    }
  }

  async queryTranscripts(query, filter = {}, limit = 3) {
    if (!this.collection) {
      throw new Error('ChromaDB collection not initialized');
    }

    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit,
        where: filter,
        include: ["metadatas", "documents", "distances"]
      });

      // Sort results by relevance (distance)
      const sortedResults = results.documents[0].map((doc, index) => ({
        content: doc,
        metadata: results.metadatas[0][index],
        distance: results.distances[0][index]
      })).sort((a, b) => a.distance - b.distance);

      return sortedResults;
    } catch (error) {
      Logger.error('[ChromaManager] Failed to query transcripts', error);
      throw error;
    }
  }

  async deleteTranscriptsByEpisodeId(episodeId) {
    if (!this.collection) {
      throw new Error('ChromaDB collection not initialized');
    }

    try {
      await this.collection.delete({
        where: {
          episodeId: episodeId
        }
      });
    } catch (error) {
      Logger.error('[ChromaManager] Failed to delete episode transcripts', error);
      throw error;
    }
  }

  async checkConnection() {
    try {
      await this.client.heartbeat();
      return true;
    } catch (error) {
      Logger.error('[ChromaManager] ChromaDB connection check failed', error);
      return false;
    }
  }
}

module.exports = new ChromaManager(); 