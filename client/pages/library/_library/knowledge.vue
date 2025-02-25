<template>
  <div class="knowledge-page flex flex-col h-screen">
    <!-- Fixed search header -->
    <div class="bg-primary p-8 md:px-12 w-full flex-shrink-0">
      <div class="flex flex-col max-w-5xl mx-auto">
        <h1 class="text-2xl md:text-3xl font-semibold mb-4">Knowledge Base</h1>
        <p class="text-gray-300 mb-6">Search across your podcast transcripts with natural language questions.</p>

        <!-- Search interface -->
        <div class="w-full">
          <div class="relative w-full">
            <input v-model="searchQuery" type="text" class="w-full px-4 py-3 pr-16 rounded-lg bg-black bg-opacity-30 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-base" placeholder="What would you like to know from your podcasts?" @keyup.enter="performSearch" />
            <button class="absolute right-1 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-1.5 text-sm font-medium" @click="performSearch">
              <span class="material-symbols fill">search</span>
            </button>
          </div>

          <!-- Library selector -->
          <div class="mt-3 flex flex-wrap gap-2">
            <div class="text-gray-300 text-sm mt-1">Libraries:</div>
            <div class="flex flex-wrap gap-2">
              <button v-for="library in userLibraries" :key="library.id" class="px-3 py-1 rounded text-sm" :class="selectedLibraryIds.includes(library.id) ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'" @click="toggleLibrary(library.id)">
                {{ library.name }}
              </button>
            </div>
          </div>

          <!-- Search examples -->
          <div class="mt-4">
            <p class="text-gray-400 text-sm mb-1">Try asking:</p>
            <div class="flex flex-wrap gap-2">
              <button v-for="(example, i) in searchExamples" :key="i" class="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-full text-sm text-gray-300" @click="useSearchExample(example)">
                {{ example }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Scrollable results area (takes remaining height) -->
    <div class="flex-grow overflow-y-auto content-container">
      <div class="max-w-5xl mx-auto px-8 py-6">
        <!-- Loading state -->
        <div v-if="isSearching" class="flex flex-col items-center justify-center py-12">
          <widgets-loading-spinner size="la-2x" />
          <p class="mt-4 text-gray-300">Searching your podcasts...</p>
        </div>

        <!-- Empty state after search -->
        <div v-else-if="searchPerformed && !searchResults" class="text-center py-12">
          <div class="material-symbols text-6xl text-gray-600 mb-4">search_off</div>
          <h3 class="text-xl font-semibold mb-2">No results found</h3>
          <p class="text-gray-400">Try a different query or select more libraries to search in.</p>
        </div>

        <!-- Error state -->
        <div v-else-if="searchError" class="text-center py-12">
          <div class="material-symbols text-6xl text-red-500 mb-4">error</div>
          <h3 class="text-xl font-semibold mb-2">Something went wrong</h3>
          <p class="text-gray-400">{{ searchError }}</p>
        </div>

        <!-- Results display -->
        <div v-else-if="searchResults" class="bg-gray-900 rounded-lg p-6 mb-8">
          <h2 class="text-xl font-semibold mb-4">Answer</h2>
          <div class="text-gray-200 mb-8 whitespace-pre-line">{{ searchResults.answer }}</div>

          <h3 class="text-lg font-semibold mb-3">Sources</h3>
          <div v-if="searchResults.sources && searchResults.sources.length" class="space-y-4">
            <div v-for="(source, index) in searchResults.sources" :key="index" class="bg-gray-800 p-4 rounded-lg transition-all duration-200 hover:bg-gray-750 hover:border-gray-600 border border-transparent" @click="toggleTranscript(index)">
              <div class="flex items-start">
                <!-- Episode cover image -->
                <div class="flex-shrink-0 mr-4">
                  <img v-if="source.coverPath" :src="'/api/items/path/' + source.coverPath" :alt="source.episodeTitle || 'Episode cover'" class="w-16 h-16 rounded-md object-cover" />
                  <div v-else class="w-16 h-16 rounded-md bg-gray-700 flex items-center justify-center">
                    <span class="material-symbols text-gray-500">podcasts</span>
                  </div>
                </div>

                <!-- Episode info section with accordion-style design -->
                <div class="flex-grow">
                  <div class="flex justify-between items-center">
                    <div class="flex-1 pr-4">
                      <h4 class="font-medium">{{ source.episodeTitle || getEpisodeTitle(source.episodeId) }}</h4>
                      <p class="text-sm text-gray-400">{{ source.podcastTitle || getPodcastTitle(source.podcastId) }}</p>
                    </div>
                    <!-- Large chevron indicator -->
                    <div v-if="source.transcriptContent" class="flex-shrink-0">
                      <span class="material-symbols chevron-icon text-3xl text-blue-400 transform transition-transform duration-300" :class="{ 'rotate-180': expandedTranscripts[index] }">expand_more</span>
                    </div>
                  </div>

                  <!-- Display transcript content with animation -->
                  <transition name="accordion">
                    <div v-if="source.transcriptContent && expandedTranscripts[index]" class="mt-3 border-t border-gray-700 pt-3">
                      <div class="text-gray-300 text-sm bg-gray-800 bg-opacity-50 p-4 rounded whitespace-pre-line transcript-content overflow-y-auto max-h-64">
                        {{ source.transcriptContent }}
                      </div>
                    </div>
                  </transition>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-gray-400 italic">No specific sources provided</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  layout: 'default',
  async asyncData({ params, store, app }) {
    const libraryId = params.library
    return {
      libraryId
    }
  },
  data() {
    return {
      searchQuery: '',
      searchResults: null,
      isSearching: false,
      searchPerformed: false,
      searchError: null,
      selectedLibraryIds: [],
      searchExamples: ['What are the key insights about AI safety?', 'Summarize the discussion about climate change', 'What did they say about meditation benefits?'],
      expandedTranscripts: {} // Track which transcripts are expanded by their index
    }
  },
  computed: {
    userLibraries() {
      return this.$store.getters['user/getUserLibraries']
    },
    currentLibrary() {
      return this.$store.getters['libraries/getLibrary']
    }
  },
  methods: {
    toggleLibrary(libraryId) {
      if (this.selectedLibraryIds.includes(libraryId)) {
        this.selectedLibraryIds = this.selectedLibraryIds.filter((id) => id !== libraryId)
      } else {
        this.selectedLibraryIds.push(libraryId)
      }
    },
    async performSearch() {
      if (!this.searchQuery.trim()) return
      if (!this.selectedLibraryIds.length) {
        this.$toast.error('Please select at least one library to search in')
        return
      }

      this.isSearching = true
      this.searchPerformed = true
      this.searchResults = null
      this.searchError = null
      this.expandedTranscripts = {} // Reset expanded transcripts

      try {
        const response = await this.$axios.$post('/api/transcripts/query', {
          query: this.searchQuery,
          libraryIds: this.selectedLibraryIds
        })

        // Ensure response has the expected structure
        this.searchResults = {
          answer: response.answer || 'No answer available',
          sources: Array.isArray(response.sources) ? response.sources : []
        }
      } catch (error) {
        console.error('Search error:', error)
        this.searchError = error.response?.data?.error || 'Failed to process your query'
        this.$toast.error(this.searchError)
      } finally {
        this.isSearching = false
      }
    },
    useSearchExample(example) {
      this.searchQuery = example
      this.performSearch()
    },
    getPodcastTitle(podcastId) {
      // Try both namespaced and non-namespaced paths to find the podcast
      // First check if we can access it directly as a library item
      const libraryItem = this.$store.getters['libraries/getLibraryItemById']?.(podcastId) || this.$store.getters['getLibraryItemById']?.(podcastId)

      if (libraryItem?.media?.metadata?.title) {
        return libraryItem.media.metadata.title
      }

      // Check in the current library items
      const libraryItems = this.$store.getters['libraries/getLibraryItems'] || []
      const foundItem = libraryItems.find((item) => item.id === podcastId)
      if (foundItem?.media?.metadata?.title) {
        return foundItem.media.metadata.title
      }

      return `Podcast (${podcastId.slice(0, 6)}...)`
    },
    getEpisodeTitle(episodeId) {
      // Try to find episode in various store locations

      // Check in all libraries first
      const libraries = this.$store.getters['user/getUserLibraries'] || []
      for (const library of libraries) {
        const libraryItems = this.$store.getters['libraries/getLibraryItems'] || []
        for (const item of libraryItems) {
          if (item.media && item.media.episodes) {
            const episode = item.media.episodes.find((ep) => ep.id === episodeId)
            if (episode?.title) return episode.title
          }
        }
      }

      // Check in podcast items
      const podcasts = this.$store.getters['libraries/getAllPodcasts'] || this.$store.getters['getAllPodcasts'] || []

      for (const podcast of podcasts) {
        if (podcast.media && podcast.media.episodes) {
          const episode = podcast.media.episodes.find((ep) => ep.id === episodeId)
          if (episode?.title) return episode.title
        }
      }

      return `Episode (${episodeId.slice(0, 6)}...)`
    },
    playEpisodeAtTimestamp(episodeId, timestamp) {
      // Find the podcast item and episode
      const podcasts = this.$store.getters['libraries/getAllPodcasts'] || this.$store.getters['getAllPodcasts'] || []
      let foundEpisode = null
      let foundPodcast = null

      // Try to find the episode in all podcasts
      for (const podcast of podcasts) {
        if (podcast.media && podcast.media.episodes) {
          const episode = podcast.media.episodes.find((ep) => ep.id === episodeId)
          if (episode) {
            foundEpisode = episode
            foundPodcast = podcast
            break
          }
        }
      }

      // If not found in podcasts, try searching all library items
      if (!foundEpisode) {
        const libraryItems = this.$store.getters['libraries/getLibraryItems'] || []
        for (const item of libraryItems) {
          if (item.media && item.media.episodes) {
            const episode = item.media.episodes.find((ep) => ep.id === episodeId)
            if (episode) {
              foundEpisode = episode
              foundPodcast = item
              break
            }
          }
        }
      }

      if (!foundEpisode || !foundPodcast) {
        this.$toast.error('Could not find the episode to play')
        return
      }

      // Convert timestamp [HH:MM] to seconds
      let startTime = 0
      try {
        // Handle invalid timestamp format
        if (timestamp === '[NaN:NaN]' || !timestamp.includes(':')) {
          this.$toast.info(`Playing "${foundEpisode.title}" from the beginning`)
        } else {
          // Remove brackets and split by colon
          const timeStr = timestamp.replace(/[\[\]]/g, '').split(':')
          const hours = parseInt(timeStr[0]) || 0
          const minutes = parseInt(timeStr[1]) || 0
          startTime = hours * 3600 + minutes * 60
          this.$toast.success(`Playing "${foundEpisode.title}" at ${hours}h${minutes}m`)
        }
      } catch (e) {
        console.error('Error parsing timestamp:', e)
        this.$toast.info(`Playing "${foundEpisode.title}" from the beginning`)
        // Default to beginning of episode
        startTime = 0
      }

      // Prepare queue item
      const queueItem = {
        libraryItemId: foundPodcast.id,
        episodeId: episodeId,
        startTime
      }

      // Play the episode
      this.$store.commit('setPlaybackRate', 1)
      this.$store.dispatch('playQueueItems', [queueItem])
    },
    toggleTranscript(index) {
      // Toggle the expanded state of a transcript
      this.$set(this.expandedTranscripts, index, !this.expandedTranscripts[index])
    }
  },
  mounted() {
    // Initialize with current library
    if (this.libraryId) {
      this.selectedLibraryIds = [this.libraryId]
    }
  }
}
</script>

<style>
.knowledge-page {
  /* Push content up to cover the toolbar */
  margin-top: -10px;
  position: relative;
  z-index: 50; /* Higher than the toolbar z-index of 40 */
}

/* Hide the toolbar specifically for the knowledge page */
.knowledge-page ~ div #toolbar {
  display: none !important;
}

/* Ensure material symbols still work */
.material-symbols {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* Custom styling for the large chevron icon */
.chevron-icon {
  font-size: 32px !important;
  font-variation-settings: 'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 40;
  text-shadow: 0 0 8px rgba(66, 153, 225, 0.3);
  cursor: pointer;
}

/* Animation styles for the transcript with accordion effect */
.accordion-enter-active,
.accordion-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
  opacity: 1;
  margin-top: 0.75rem;
}
.accordion-enter,
.accordion-leave-to {
  max-height: 0;
  opacity: 0;
  margin-top: 0;
  overflow: hidden;
}

/* Simpler animation that preserves the slide effect */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
  max-height: 1000px;
  opacity: 1;
  overflow: hidden;
}
.slide-fade-enter,
.slide-fade-leave-to {
  max-height: 0;
  opacity: 0;
  margin-top: 0;
}

/* Make transcript scrollable */
.transcript-content {
  scrollbar-width: thin;
  scrollbar-color: #4a5568 #1f2937;
}
.transcript-content::-webkit-scrollbar {
  width: 8px;
}
.transcript-content::-webkit-scrollbar-track {
  background: #1f2937;
}
.transcript-content::-webkit-scrollbar-thumb {
  background-color: #4a5568;
  border-radius: 4px;
}

/* Apply scrollbar styling to content container */
.content-container {
  scrollbar-width: thin;
  scrollbar-color: #4a5568 #1f2937;
}
.content-container::-webkit-scrollbar {
  width: 8px;
}
.content-container::-webkit-scrollbar-track {
  background: #1f2937;
}
.content-container::-webkit-scrollbar-thumb {
  background-color: #4a5568;
  border-radius: 4px;
}
</style> 