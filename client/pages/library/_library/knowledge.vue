<template>
  <div class="audiomind-page flex flex-col h-screen">
    <!-- Fixed search header -->
    <div class="bg-primary p-4 md:px-8 w-full flex-shrink-0">
      <div class="flex flex-col max-w-5xl mx-auto">
        <h1 class="text-xl md:text-2xl font-semibold mb-2">AudioMind</h1>
        <p class="text-gray-300 text-sm mb-3">Search your audio content with natural language questions and discover insights instantly.</p>

        <!-- Search interface -->
        <div class="w-full">
          <!-- Enhanced search input with better contrast and accessibility -->
          <div class="relative w-full search-container">
            <input v-model="searchQuery" type="text" class="w-full px-4 py-3 pr-14 rounded-lg border border-gray-600 bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 text-white text-base transition-all duration-200" placeholder="Ask anything about your audio content..." @keyup.enter="performSearch" aria-label="Search audio content" />

            <!-- Improved search button with better visual design and feedback -->
            <button
              class="search-button absolute right-3 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-500 active:bg-blue-400 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-md transition-all duration-200 focus:ring-2 focus:ring-blue-300 focus:ring-opacity-50"
              @click="performSearch"
              :class="{ 'animate-pulse': isSearching }"
              :disabled="isSearching"
              aria-label="Search audio content"
            >
              <span class="material-symbols" style="font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24; font-size: 22px">search</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Scrollable results area (takes remaining height) -->
    <div class="flex-grow overflow-y-auto content-container">
      <div class="max-w-5xl mx-auto px-8 py-6">
        <!-- Loading state -->
        <div v-if="isSearching" class="search-loading-container bg-gray-900 rounded-lg flex flex-col items-center justify-center">
          <!-- Query visualization (just a subtle pulse around the query) -->
          <div class="query-pulse-container my-8">
            <div class="bg-gray-800 rounded-lg py-3 px-5 inline-block max-w-full query-pulse">
              <p class="text-blue-400 font-medium text-lg truncate">{{ searchQuery }}</p>
            </div>
          </div>

          <!-- Enhanced animated loading visualizer -->
          <div class="podcast-visualizer mb-10">
            <div class="visualizer-container">
              <div class="bar" v-for="i in 12" :key="i"></div>
            </div>
          </div>
        </div>

        <!-- Empty state after search -->
        <div v-else-if="searchPerformed && !searchResults" class="text-center py-12">
          <div class="material-symbols text-6xl text-gray-600 mb-4">search_off</div>
          <h3 class="text-xl font-semibold mb-2">No insights found</h3>
          <p class="text-gray-400">Try rephrasing your question or expanding your search scope.</p>
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
            <div v-for="(source, index) in searchResults.sources" :key="index" class="bg-gray-800 p-4 rounded-lg transition-all duration-200 hover:bg-gray-750 hover:border-gray-600 border border-transparent">
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
                  <!-- Make only this header section clickable -->
                  <div class="flex justify-between items-center cursor-pointer source-header" @click="toggleTranscript(index)">
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
                      <div class="text-gray-300 text-sm bg-gray-800 bg-opacity-50 p-4 rounded whitespace-pre-line transcript-content overflow-y-auto max-h-64" @click.stop>
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
      expandedTranscripts: {}, // Track which transcripts are expanded by their index
      searchPhase: 0, // Track the current phase of searching
      searchPhaseInterval: null // Interval for updating search phases
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
    async performSearch() {
      if (!this.searchQuery.trim()) return

      // Safely get library IDs with a fallback to prevent "map of undefined" error
      const librariesToSearch = (this.userLibraries || []).map((lib) => lib.id)

      // If current library ID exists, make sure it's included
      if (this.libraryId && !librariesToSearch.includes(this.libraryId)) {
        librariesToSearch.push(this.libraryId)
      }

      if (!librariesToSearch.length) {
        this.$toast.error('No libraries available to search')
        return
      }

      this.isSearching = true
      this.searchPerformed = true
      this.searchResults = null
      this.searchError = null
      this.expandedTranscripts = {} // Reset expanded transcripts

      // Reset and start the search phase animation
      this.searchPhase = 0
      this.startSearchPhaseAnimation()

      try {
        const response = await this.$axios.$post('/api/transcripts/query', {
          query: this.searchQuery,
          libraryIds: librariesToSearch
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
        // Make sure we reach the final phase before ending
        if (this.searchPhase < 3) {
          this.searchPhase = 3
          // Allow the final phase to show briefly before hiding the loading state
          setTimeout(() => {
            this.isSearching = false
            this.clearSearchPhaseAnimation()
          }, 500)
        } else {
          this.isSearching = false
          this.clearSearchPhaseAnimation()
        }
      }
    },

    // New methods for managing search phase animation
    startSearchPhaseAnimation() {
      this.clearSearchPhaseAnimation() // Clear any existing interval

      // Create realistic timing for the search phases
      this.searchPhaseInterval = setInterval(() => {
        if (this.searchPhase < 3) {
          this.searchPhase++
        } else {
          clearInterval(this.searchPhaseInterval)
        }
      }, 1200) // Advance phase roughly every 1.2 seconds
    },

    clearSearchPhaseAnimation() {
      if (this.searchPhaseInterval) {
        clearInterval(this.searchPhaseInterval)
        this.searchPhaseInterval = null
      }
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
    // Initialize with current library if available
    if (this.libraryId) {
      this.selectedLibraryIds = [this.libraryId]
    }
  },
  beforeDestroy() {
    // Clean up the interval when component is destroyed
    this.clearSearchPhaseAnimation()
  }
}
</script>

<style>
.audiomind-page {
  /* Push content up to cover the toolbar */
  margin-top: -10px;
  position: relative;
  z-index: 50; /* Higher than the toolbar z-index of 40 */
}

/* Hide the toolbar specifically for the audiomind page */
.audiomind-page ~ div #toolbar {
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

/* Search container enhancements */
.search-container {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.search-container:focus-within {
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.3);
  transform: translateY(-1px);
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

/* Enhanced search button styles */
.search-button {
  overflow: hidden;
  transform-origin: center;
}

.search-button:hover {
  transform: translateY(-50%) scale(1.05);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.search-button:active {
  transform: translateY(-50%) scale(0.95);
}

.search-button::before {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  transform: scale(0);
  opacity: 0;
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.search-button:hover::before {
  transform: scale(1);
  opacity: 1;
}

.search-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Add keyframe animation for button when loading */
@keyframes search-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
  }
}

.search-button.animate-pulse {
  animation: search-pulse 1.5s infinite;
}

/* Loading state enhancements */
.search-loading-container {
  min-height: 350px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  padding: 3rem 2rem;
}

/* Query pulse effect */
.query-pulse {
  position: relative;
  box-shadow: 0 0 0 rgba(66, 153, 225, 0.4);
  animation: queryPulse 2s infinite;
}

@keyframes queryPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(66, 153, 225, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(66, 153, 225, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(66, 153, 225, 0);
  }
}

/* Modern audio visualizer */
.podcast-visualizer {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 120px;
  width: 100%;
}

.visualizer-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 100%;
  width: 240px;
}

.visualizer-container .bar {
  background-color: rgba(66, 153, 225, 0.7);
  border-radius: 15px;
  width: 4px;
  height: 100%;
  transform: scaleY(0.15);
  transform-origin: center;
}

.visualizer-container .bar:nth-child(1) {
  animation: barScale 1.1s infinite ease-in-out alternate;
  animation-delay: 0s;
}
.visualizer-container .bar:nth-child(2) {
  animation: barScale 1.4s infinite ease-in-out alternate;
  animation-delay: 0.1s;
}
.visualizer-container .bar:nth-child(3) {
  animation: barScale 1.6s infinite ease-in-out alternate;
  animation-delay: 0.2s;
}
.visualizer-container .bar:nth-child(4) {
  animation: barScale 1.2s infinite ease-in-out alternate;
  animation-delay: 0.3s;
}
.visualizer-container .bar:nth-child(5) {
  animation: barScale 1s infinite ease-in-out alternate;
  animation-delay: 0.4s;
}
.visualizer-container .bar:nth-child(6) {
  animation: barScale 1.7s infinite ease-in-out alternate;
  animation-delay: 0.5s;
}
.visualizer-container .bar:nth-child(7) {
  animation: barScale 1.5s infinite ease-in-out alternate;
  animation-delay: 0.6s;
}
.visualizer-container .bar:nth-child(8) {
  animation: barScale 1.3s infinite ease-in-out alternate;
  animation-delay: 0.7s;
}
.visualizer-container .bar:nth-child(9) {
  animation: barScale 1.1s infinite ease-in-out alternate;
  animation-delay: 0.8s;
}
.visualizer-container .bar:nth-child(10) {
  animation: barScale 1.4s infinite ease-in-out alternate;
  animation-delay: 0.9s;
}
.visualizer-container .bar:nth-child(11) {
  animation: barScale 1.2s infinite ease-in-out alternate;
  animation-delay: 1s;
}
.visualizer-container .bar:nth-child(12) {
  animation: barScale 1.6s infinite ease-in-out alternate;
  animation-delay: 1.1s;
}

@keyframes barScale {
  0% {
    transform: scaleY(0.15);
    background-color: rgba(66, 153, 225, 0.5);
  }
  100% {
    transform: scaleY(0.7);
    background-color: rgba(99, 179, 237, 0.9);
  }
}

/* Search progress bar animation */
.search-progress-bar {
  transition: width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
  overflow: hidden;
}

.search-progress-bar::after {
  content: '';
  position: absolute;
  top: 0;
  right: -50%;
  bottom: 0;
  left: -50%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* Progress dots */
.progress-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #2d3748;
  transition: all 0.4s ease;
  position: relative;
}

.progress-dot.active {
  background-color: #4299e1;
  transform: scale(1.4);
}

.progress-dot.active::after {
  content: '';
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  border-radius: 50%;
  border: 2px solid rgba(66, 153, 225, 0.3);
  animation: dotPulse 2s infinite;
}

@keyframes dotPulse {
  0% {
    transform: scale(0.8);
    opacity: 1;
  }
  70% {
    transform: scale(1.3);
    opacity: 0;
  }
  100% {
    transform: scale(0.8);
    opacity: 0;
  }
}

/* Remove the old animation styles to avoid conflicts */
.dots-container,
.dot-animation,
.dot,
.sound-wave {
  display: none;
}

/* Add styling for the clickable header */
.source-header {
  padding: 8px;
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

.source-header:hover {
  background-color: rgba(255, 255, 255, 0.05);
}
</style> 