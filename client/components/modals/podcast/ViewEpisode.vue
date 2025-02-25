<template>
  <modals-modal v-model="show" name="podcast-episode-view-modal" :width="900" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ $strings.LabelEpisode }}</p>
      </div>
    </template>
    <div ref="wrapper" class="p-6 w-full text-sm rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-y-auto" style="max-height: 85vh">
      <div class="flex flex-col md:flex-row gap-4 mb-6">
        <div class="w-16 h-16">
          <covers-book-cover :library-item="libraryItem" :width="64" :book-cover-aspect-ratio="bookCoverAspectRatio" />
        </div>
        <div class="flex-grow px-2">
          <p class="text-lg mb-2">{{ podcastTitle }}</p>
          <p class="text-sm text-gray-300">{{ podcastAuthor }}</p>
        </div>
        <div class="flex flex-wrap gap-2 items-center mt-2 md:mt-0">
          <ui-btn @click="openPodcastKnowledgeQuiz" icon="psychology" variant="accent" :disabled="!canTestKnowledge"> Test Knowledge </ui-btn>
          <!-- <ui-btn v-if="hasTranscript && qaEnabled" @click="vectorizeTranscript" variant="secondary" icon="psychology" :loading="isVectorizing" :disabled="isVectorizing"> Vectorize for Q&A </ui-btn> -->
        </div>
      </div>
      <p dir="auto" class="text-xl font-semibold mb-8">{{ title }}</p>

      <!-- Tab Navigation -->
      <div class="flex border-b border-white/10 mb-6">
        <button v-for="tab in tabs" :key="tab.id" @click="activeTab = tab.id" :class="['px-4 py-3 -mb-px', activeTab === tab.id ? 'border-b-2 border-primary text-white font-medium' : 'text-gray-300']">
          <div class="flex items-center">
            <span class="material-symbols mr-2">{{ tab.icon }}</span>
            {{ tab.label }}
          </div>
        </button>
      </div>

      <!-- Description Tab -->
      <div v-if="activeTab === 'description'" class="tab-content">
        <div v-if="description" dir="auto" class="default-style less-spacing" v-html="description" />
        <p v-else class="mb-2">{{ $strings.MessageNoDescription }}</p>
      </div>

      <!-- Transcript Tab -->
      <div v-if="activeTab === 'transcript'" class="tab-content">
        <div v-if="hasTranscript" class="transcript-container">
          <div v-if="groupedTranscript" class="space-y-3">
            <div v-for="(group, index) in groupedTranscript" :key="index" class="transcript-group">
              <p class="transcript-text">{{ group.text }}</p>
            </div>
          </div>
          <div v-else class="text-center py-4 text-gray-400">
            <p>Transcript format not supported for display.</p>
          </div>
        </div>
        <div v-else class="flex flex-col items-center justify-center h-full py-10">
          <div class="max-w-lg text-center">
            <div class="bg-black-300/20 rounded-lg p-6 mb-6">
              <span class="material-symbols text-5xl text-primary mb-4">record_voice_over</span>
              <h3 class="text-xl font-medium mb-2">No Transcript Available</h3>
              <p class="text-gray-300 mb-6">Generate a transcript to easily search, review, and analyze the content of this episode.</p>

              <div v-if="transcriptionsEnabled">
                <ui-btn v-if="!isTranscribing && !isQueued" @click="transcribeEpisode" size="lg" icon="record_voice_over" :loading="isTranscribing" class="w-full justify-center"> Generate Transcript </ui-btn>
                <div v-else-if="isQueued" class="text-center p-4 bg-black-300/30 rounded-lg">
                  <span class="material-symbols text-2xl mb-2">queue</span>
                  <p class="text-sm mb-1">Queued for Transcription</p>
                  <p class="text-xs text-gray-400">Your transcript will be generated soon.</p>
                </div>
                <div v-else-if="isTranscribing" class="text-center p-4 bg-black-300/30 rounded-lg">
                  <span class="material-symbols text-2xl mb-2 animate-spin">refresh</span>
                  <p class="text-sm mb-1">Transcribing Episode...</p>
                  <p class="text-xs text-gray-400">This may take a few minutes.</p>
                </div>
              </div>
              <div v-else class="text-center p-4 bg-black-300/30 rounded-lg">
                <span class="material-symbols text-2xl mb-2">info</span>
                <p class="text-sm text-gray-300">Transcriptions are not enabled on this server.</p>
              </div>
            </div>

            <p class="text-xs text-gray-500">Transcripts help with content discovery, accessibility, and enable AI-powered features like summaries and knowledge testing.</p>
          </div>
        </div>
      </div>

      <!-- Summary Tab -->
      <div v-if="activeTab === 'summary'" class="tab-content">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6">
          <p class="text-sm">{{ $strings.LabelSummary }}</p>
          <div class="flex flex-wrap gap-2">
            <ui-btn v-if="hasSummary" @click="deleteSummary" variant="danger" icon="delete" :loading="isDeletingSummary"> Delete Summary </ui-btn>
          </div>
        </div>

        <div v-if="hasSummary" class="prose prose-invert max-w-none summary-content">
          <div v-html="formattedSummary"></div>
        </div>
        <div v-else-if="isSummaryQueued" class="text-center py-8">
          <span class="material-symbols text-4xl mb-2">queue</span>
          <p>Queued for Summary Generation</p>
          <p class="text-xs text-gray-400 mt-2">Position in queue: {{ summaryQueuePosition }}</p>
        </div>
        <div v-else-if="isSummarizing" class="text-center py-8">
          <span class="material-symbols text-4xl mb-2 animate-spin">refresh</span>
          <p>Generating Summary...</p>
        </div>
        <div v-else-if="!hasTranscript" class="text-center py-8">
          <span class="material-symbols text-4xl mb-2">record_voice_over</span>
          <p>Transcript Required</p>
          <p class="text-xs text-gray-400 mt-2">Generate a transcript first to create a summary</p>
        </div>
        <div v-else class="flex flex-col items-center justify-center h-full py-10">
          <div class="max-w-lg text-center">
            <div class="rounded-lg p-6 mb-4">
              <span class="material-symbols text-5xl text-primary mb-4">summarize</span>
              <h3 class="text-xl font-medium mb-2">No Summary Available</h3>
              <p class="text-gray-300 mb-6">Generate a summary to quickly understand the key points of this episode.</p>

              <ui-btn @click="generateSummary" icon="summarize" :loading="isSummarizing" size="lg" class="w-full justify-center"> Generate Summary </ui-btn>
            </div>
          </div>
        </div>
      </div>

      <div class="w-full h-px bg-white/10 my-6" />

      <div class="flex flex-col md:flex-row gap-4 bg-black-300/20 p-4 rounded-lg">
        <div class="flex-grow">
          <p class="font-semibold text-sm mb-2">{{ $strings.LabelFilename }}</p>
          <p class="mb-2 text-xs overflow-hidden text-ellipsis">
            {{ audioFileFilename }}
          </p>
        </div>
        <div class="flex-grow">
          <p class="font-semibold text-sm mb-2">{{ $strings.LabelSize }}</p>
          <p class="mb-2 text-xs">
            {{ audioFileSize }}
          </p>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
import { marked } from '@/static/libs/marked/index.js'

export default {
  data() {
    return {
      processing: false,
      isTranscribing: false,
      isQueued: false,
      transcriptionQueueInterval: null,
      summaryCheckInterval: null,
      activeTab: 'description',
      isSummarizing: false,
      isSummaryQueued: false,
      summaryQueuePosition: 0,
      isDeletingSummary: false,
      summary: null,
      isVectorizing: false,
      tabs: [
        { id: 'description', label: 'Description', icon: 'description' },
        { id: 'transcript', label: 'Transcript', icon: 'record_voice_over' },
        { id: 'summary', label: 'Summary', icon: 'summarize' }
      ]
    }
  },
  watch: {
    libraryItem: {
      immediate: true,
      handler(newVal) {
        if (newVal && this.episodeId) {
          this.checkTranscriptionStatus()
          this.checkSummaryStatus()
          if (!this.transcriptionQueueInterval) {
            this.transcriptionQueueInterval = setInterval(this.checkTranscriptionStatus, 5000)
          }
          if (!this.summaryCheckInterval) {
            this.summaryCheckInterval = setInterval(this.checkSummaryStatus, 5000)
          }
        }
      }
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showViewPodcastEpisodeModal
      },
      set(val) {
        this.$store.commit('globals/setShowViewPodcastEpisodeModal', val)
      }
    },
    libraryItem() {
      return this.$store.state.selectedLibraryItem
    },
    episode() {
      return this.$store.state.globals.selectedEpisode || {}
    },
    episodeId() {
      return this.episode.id
    },
    title() {
      return this.episode.title || 'No Episode Title'
    },
    description() {
      return this.episode.description || ''
    },
    media() {
      return this.libraryItem?.media || {}
    },
    mediaMetadata() {
      return this.media.metadata || {}
    },
    podcastTitle() {
      return this.mediaMetadata.title
    },
    podcastAuthor() {
      return this.mediaMetadata.author
    },
    audioFileFilename() {
      return this.episode.audioFile?.metadata?.filename || ''
    },
    audioFileSize() {
      const size = this.episode.audioFile?.metadata?.size || 0
      return this.$bytesPretty(size)
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    hasTranscript() {
      if (!this.episode.transcript) return false

      // Check for new format (object with segments array)
      if (typeof this.episode.transcript === 'object' && !Array.isArray(this.episode.transcript)) {
        return this.episode.transcript.segments && this.episode.transcript.segments.length > 0
      }

      // Check for old format (array of results)
      if (Array.isArray(this.episode.transcript)) {
        return this.episode.transcript.length > 0
      }

      // String format (deprecated but check anyway)
      if (typeof this.episode.transcript === 'string') {
        return this.episode.transcript.trim().length > 0
      }

      return false
    },
    transcriptionsEnabled() {
      return this.$store.state.serverSettings?.transcriptionsEnabled ?? false
    },
    hasSummary() {
      return this.summary !== null
    },
    formattedSummary() {
      try {
        if (!this.summary) return ''
        const parsed = marked.parse(this.summary, {
          gfm: true,
          breaks: true,
          // Disable potentially unsafe features
          tables: false,
          code: false
        })
        return parsed || 'No summary available'
      } catch (error) {
        console.error('Failed to parse summary markdown', error)
        return this.summary // Fallback to raw text
      }
    },
    qaEnabled() {
      return this.$store.state.serverSettings?.openQA ?? false
    },
    canTestKnowledge() {
      // Podcast knowledge quiz can only be tested if there's a summary
      return this.hasSummary
    },
    groupedTranscript() {
      try {
        if (!this.hasTranscript) return null

        let segments = []

        // Handle new format (object with segments array)
        if (typeof this.episode.transcript === 'object' && !Array.isArray(this.episode.transcript)) {
          if (this.episode.transcript.segments && this.episode.transcript.segments.length > 0) {
            segments = this.episode.transcript.segments.map((segment) => ({
              timestamp: segment.startTime || 0,
              text: segment.text || ''
            }))
          }
        }

        // Handle old format (array of results)
        else if (Array.isArray(this.episode.transcript)) {
          segments = this.episode.transcript.map((item) => ({
            timestamp: item.start || 0,
            text: item.text || ''
          }))
        }

        if (segments.length === 0) return null

        // Group segments with timestamps every 5 minutes
        const FIVE_MINUTES = 300 // 5 minutes in seconds
        let lastTimestampShown = -FIVE_MINUTES
        let currentGroup = { timestamp: 0, text: '', showTimestamp: true }
        let groups = []

        segments.forEach((segment) => {
          // Check if we need to show a new timestamp (every 5 minutes)
          const roundedTimestamp = Math.floor(segment.timestamp / FIVE_MINUTES) * FIVE_MINUTES

          if (roundedTimestamp >= lastTimestampShown + FIVE_MINUTES) {
            // If we have content in the current group, add it to groups
            if (currentGroup.text) {
              groups.push(currentGroup)
            }

            // Start a new group with a timestamp
            currentGroup = {
              timestamp: roundedTimestamp,
              text: segment.text,
              showTimestamp: true
            }

            lastTimestampShown = roundedTimestamp
          } else {
            // Add to current group without showing timestamp
            currentGroup.text += ' ' + segment.text
          }
        })

        // Add the last group if it has content
        if (currentGroup.text) {
          groups.push(currentGroup)
        }

        return groups
      } catch (error) {
        console.error('Failed to format grouped transcript', error)
        return null
      }
    }
  },
  methods: {
    openPodcastKnowledgeQuiz() {
      // Prepare episode data for the knowledge quiz
      const episodeData = {
        title: this.title,
        podcastTitle: this.podcastTitle,
        author: this.podcastAuthor,
        description: this.description,
        summary: this.hasSummary ? this.summary : null,
        transcript: this.hasTranscript ? this.episodeId : null // For possible future transcript access
      }

      // Set the episode data in the store
      this.$store.commit('globals/setVoiceChatEpisodeData', episodeData)

      // Open the voice chat modal
      this.$store.commit('globals/setShowVoiceChatModal', true)

      // Short delay to make sure the modal is open and can receive the toast
      setTimeout(() => {
        this.$toast.info('Podcast knowledge quiz ready! Ask the assistant to test your knowledge about this episode.', {
          position: 'bottom-center',
          timeout: 5000
        })
      }, 500)
    },
    async checkTranscriptionStatus() {
      try {
        if (!this.libraryItem || !this.episodeId) return
        const response = await this.$axios.$get(`/api/podcasts/${this.libraryItem.id}/episode/${this.episodeId}/transcription-status`)
        this.isQueued = response.queued.some((ep) => ep.episodeId === this.episodeId)
      } catch (error) {
        console.error('Failed to check transcription status', error)
      }
    },
    async checkSummaryStatus() {
      try {
        if (!this.libraryItem || !this.episodeId) return
        const response = await this.$axios.$get(`/api/podcasts/${this.libraryItem.id}/episode/${this.episodeId}/summary/status`)

        this.isSummaryQueued = response.isQueued
        this.isSummarizing = response.isCurrentlyProcessing
        this.summaryQueuePosition = response.queuePosition

        if (response.status === 'completed') {
          await this.fetchSummary()
        }
      } catch (error) {
        console.error('Failed to check summary status', error)
      }
    },
    async fetchSummary() {
      try {
        const response = await this.$axios.$get(`/api/podcasts/${this.libraryItem.id}/episode/${this.episodeId}/summary`)
        this.summary = response.summary
      } catch (error) {
        console.error('Failed to fetch summary', error)
        this.summary = null
      }
    },
    async generateSummary() {
      try {
        this.isSummarizing = true
        await this.$axios.$post(`/api/podcasts/${this.libraryItem.id}/episode/${this.episodeId}/summary`)
        this.$toast.success('Summary generation started')
        await this.checkSummaryStatus()
      } catch (error) {
        console.error('Failed to start summary generation', error)
        this.$toast.error(error.response?.data?.error || 'Failed to start summary generation')
      } finally {
        this.isSummarizing = false
      }
    },
    async deleteSummary() {
      try {
        this.isDeletingSummary = true
        await this.$axios.$delete(`/api/podcasts/${this.libraryItem.id}/episode/${this.episodeId}/summary`)
        this.$toast.success('Summary deleted')
        this.summary = null
      } catch (error) {
        console.error('Failed to delete summary', error)
        this.$toast.error(error.response?.data?.error || 'Failed to delete summary')
      } finally {
        this.isDeletingSummary = false
      }
    },
    async transcribeEpisode() {
      try {
        this.isTranscribing = true
        await this.$axios.$post(`/api/podcasts/${this.libraryItem.id}/episode/${this.episodeId}/transcribe`)
        this.$toast.success('Transcription started')
        this.transcriptionQueueInterval = setInterval(this.checkTranscriptionStatus, 5000)
        await this.checkTranscriptionStatus()
      } catch (error) {
        console.error('Failed to start transcription', error)
        this.$toast.error(error.response?.data || 'Failed to start transcription')
      } finally {
        this.isTranscribing = false
      }
    },
    async vectorizeTranscript() {
      try {
        this.isVectorizing = true
        const response = await this.$axios.$post(`/api/transcripts/vectorize/${this.episodeId}`, {
          podcastId: this.libraryItem.id,
          libraryId: this.libraryItem.libraryId
        })

        if (response.success) {
          this.$toast.success('Episode transcript vectorized successfully for Q&A search')
        } else {
          this.$toast.error(response.error || 'Failed to vectorize transcript')
        }
      } catch (error) {
        console.error('Failed to vectorize transcript', error)
        this.$toast.error(error.response?.data?.error || 'Failed to vectorize transcript for Q&A')
      } finally {
        this.isVectorizing = false
      }
    },
    formatTime(seconds) {
      if (typeof seconds !== 'number') return '00:00'

      const hours = Math.floor(seconds / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)

      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:00`
      } else {
        return `${minutes}:00`
      }
    }
  },
  mounted() {
    if (this.libraryItem && this.episodeId) {
      this.checkSummaryStatus()
    }
  },
  beforeDestroy() {
    if (this.transcriptionQueueInterval) {
      clearInterval(this.transcriptionQueueInterval)
    }
    if (this.summaryCheckInterval) {
      clearInterval(this.summaryCheckInterval)
    }
  }
}
</script>

<style scoped>
.tab-content {
  min-height: 220px;
}

/* Transcript styles */
.transcript-container {
  max-height: 400px;
  overflow-y: auto;
  width: 100%;
}

.transcript-group {
  @apply py-1;
}

.transcript-group:hover {
  @apply bg-black-300/10;
  border-radius: 4px;
}

.transcript-text {
  @apply leading-relaxed;
}

/* Markdown styles */
.summary-content ::v-deep {
  @apply text-gray-100;
}

.summary-content ::v-deep h1,
.summary-content ::v-deep h2,
.summary-content ::v-deep h3,
.summary-content ::v-deep h4,
.summary-content ::v-deep h5,
.summary-content ::v-deep h6 {
  @apply font-bold mb-3 mt-5;
}

.summary-content ::v-deep h1 {
  @apply text-2xl;
}

.summary-content ::v-deep h2 {
  @apply text-xl;
}

.summary-content ::v-deep h3 {
  @apply text-lg;
}

.summary-content ::v-deep p {
  @apply mb-4;
}

.summary-content ::v-deep ul,
.summary-content ::v-deep ol {
  @apply mb-4 ml-6;
}

.summary-content ::v-deep ul {
  @apply list-disc;
}

.summary-content ::v-deep ol {
  @apply list-decimal;
}

.summary-content ::v-deep li {
  @apply mb-2;
}

.summary-content ::v-deep strong {
  @apply font-bold;
}

.summary-content ::v-deep em {
  @apply italic;
}

.summary-content ::v-deep a {
  @apply text-primary hover:underline;
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .tab-content {
    min-height: 280px;
  }
}
</style>
