<template>
  <div class="knowledge-page">
    <div class="bg-primary p-8 md:px-12 w-full">
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

    <!-- Results Area -->
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
          <div v-for="(source, index) in searchResults.sources" :key="index" class="bg-gray-800 p-4 rounded-lg">
            <div class="flex items-start justify-between mb-2">
              <div>
                <h4 class="font-medium">{{ getPodcastTitle(source.podcastId) }}</h4>
                <p class="text-sm text-gray-400">{{ getEpisodeTitle(source.episodeId) }}</p>
              </div>
              <button class="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded-md flex items-center" @click="playEpisodeAtTimestamp(source.episodeId, source.timestamp)">
                <span class="material-symbols fill text-sm mr-1">play_arrow</span>
                {{ source.timestamp }}
              </button>
            </div>
          </div>
        </div>
        <div v-else class="text-gray-400 italic">No specific sources provided</div>
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
      searchExamples: ['What are the key insights about AI safety?', 'Summarize the discussion about climate change', 'What did they say about meditation benefits?']
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
      // Get podcast title from store or use a placeholder
      const libraryItem = this.$store.getters['getLibraryItemById'](podcastId)
      return libraryItem?.media?.metadata?.title || 'Unknown Podcast'
    },
    getEpisodeTitle(episodeId) {
      // Find the episode title across all podcasts
      // This is simplified and would need to be improved for production
      const podcasts = this.$store.getters['getAllPodcasts'] || []
      for (const podcast of podcasts) {
        const episode = podcast.media.episodes.find((ep) => ep.id === episodeId)
        if (episode) return episode.title
      }
      return 'Unknown Episode'
    },
    playEpisodeAtTimestamp(episodeId, timestamp) {
      // Find the podcast item and episode
      const podcasts = this.$store.getters['getAllPodcasts'] || []
      let foundEpisode = null
      let foundPodcast = null

      for (const podcast of podcasts) {
        const episode = podcast.media.episodes.find((ep) => ep.id === episodeId)
        if (episode) {
          foundEpisode = episode
          foundPodcast = podcast
          break
        }
      }

      if (!foundEpisode || !foundPodcast) {
        this.$toast.error('Could not find the episode to play')
        return
      }

      // Convert timestamp [HH:MM] to seconds
      // Remove brackets and split by colon
      const timeStr = timestamp.replace(/[\[\]]/g, '').split(':')
      const hours = parseInt(timeStr[0]) || 0
      const minutes = parseInt(timeStr[1]) || 0
      const startTime = hours * 3600 + minutes * 60

      // Prepare queue item
      const queueItem = {
        libraryItemId: foundPodcast.id,
        episodeId: episodeId,
        startTime
      }

      // Play the episode
      this.$store.commit('setPlaybackRate', 1)
      this.$store.dispatch('playQueueItems', [queueItem])
      this.$toast.success(`Playing "${foundEpisode.title}" at ${timestamp}`)
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
</style> 