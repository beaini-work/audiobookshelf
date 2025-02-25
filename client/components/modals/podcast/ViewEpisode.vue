<template>
  <modals-modal v-model="show" name="podcast-episode-view-modal" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ $strings.LabelEpisode }}</p>
      </div>
    </template>
    <div ref="wrapper" class="p-4 w-full text-sm rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-y-auto" style="max-height: 80vh">
      <div class="flex mb-4">
        <div class="w-12 h-12">
          <covers-book-cover :library-item="libraryItem" :width="48" :book-cover-aspect-ratio="bookCoverAspectRatio" />
        </div>
        <div class="flex-grow px-2">
          <p class="text-base mb-1">{{ podcastTitle }}</p>
          <p class="text-xs text-gray-300">{{ podcastAuthor }}</p>
        </div>
        <div class="flex items-center">
          <button @click="openVoiceChat" class="px-3 py-1 rounded-md bg-primary text-white hover:bg-primary-600 transition-colors flex items-center">
            <span class="material-symbols mr-1">record_voice_over</span>
            Voice Chat
          </button>
        </div>
      </div>
      <p dir="auto" class="text-lg font-semibold mb-6">{{ title }}</p>

      <!-- Tab Navigation -->
      <div class="flex border-b border-white/10 mb-4">
        <button v-for="tab in tabs" :key="tab.id" @click="activeTab = tab.id" :class="['px-4 py-2 -mb-px', activeTab === tab.id ? 'border-b-2 border-primary text-primary' : 'text-gray-300']">
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
        <div v-if="hasTranscript" class="flex justify-between items-center mb-4">
          <p class="text-sm">{{ $strings.LabelTranscript }}</p>
          <div class="flex gap-2">
            <ui-btn @click="viewTranscript" variant="secondary">
              <span class="material-symbols mr-2">description</span>
              View Full Transcript
            </ui-btn>
            <ui-btn v-if="qaEnabled" @click="vectorizeTranscript" variant="accent" :loading="isVectorizing" :disabled="isVectorizing">
              <span class="material-symbols mr-2">psychology</span>
              Vectorize for Q&A
            </ui-btn>
          </div>
        </div>
        <div v-else class="flex justify-between items-center mb-4">
          <p class="text-sm">{{ $strings.LabelTranscript }}</p>
          <ui-btn v-if="transcriptionsEnabled && !isTranscribing && !isQueued" @click="transcribeEpisode" :loading="isTranscribing">
            <span class="material-symbols mr-2">record_voice_over</span>
            Transcribe
          </ui-btn>
          <ui-btn v-else-if="isQueued" disabled>
            <span class="material-symbols mr-2">queue</span>
            Queued for Transcription
          </ui-btn>
          <ui-btn v-else-if="isTranscribing" disabled>
            <span class="material-symbols mr-2 animate-spin">refresh</span>
            Transcribing...
          </ui-btn>
        </div>
      </div>

      <!-- Summary Tab -->
      <div v-if="activeTab === 'summary'" class="tab-content">
        <div class="flex justify-between items-center mb-4">
          <p class="text-sm">{{ $strings.LabelSummary }}</p>
          <div class="flex gap-2">
            <ui-btn v-if="!hasSummary && !isSummarizing && !isSummaryQueued && hasTranscript" @click="generateSummary" :loading="isSummarizing">
              <span class="material-symbols mr-2">summarize</span>
              Generate Summary
            </ui-btn>
            <ui-btn v-if="hasSummary" @click="deleteSummary" variant="danger" :loading="isDeletingSummary">
              <span class="material-symbols mr-2">delete</span>
              Delete Summary
            </ui-btn>
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
        <div v-else class="text-center py-8">
          <span class="material-symbols text-4xl mb-2">summarize</span>
          <p>No Summary Available</p>
          <p class="text-xs text-gray-400 mt-2">Click "Generate Summary" to create one</p>
        </div>
      </div>

      <div class="w-full h-px bg-white/5 my-4" />

      <div class="flex items-center">
        <div class="flex-grow">
          <p class="font-semibold text-xs mb-1">{{ $strings.LabelFilename }}</p>
          <p class="mb-2 text-xs">
            {{ audioFileFilename }}
          </p>
        </div>
        <div class="flex-grow">
          <p class="font-semibold text-xs mb-1">{{ $strings.LabelSize }}</p>
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
      return this.episode.transcript != null
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
    }
  },
  methods: {
    openVoiceChat() {
      this.$store.commit('globals/setShowVoiceChatModal', true)
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
    viewTranscript() {
      this.$store.commit('globals/setShowTranscriptModal', {
        libraryItem: this.libraryItem,
        episode: this.episode
      })
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
  min-height: 200px;
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
  @apply font-bold mb-2 mt-4;
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
  @apply mb-4 ml-4;
}

.summary-content ::v-deep ul {
  @apply list-disc;
}

.summary-content ::v-deep ol {
  @apply list-decimal;
}

.summary-content ::v-deep li {
  @apply mb-1;
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
</style>
