<template>
  <modals-modal v-model="show" name="transcript-modal" :width="800" :height="'unset'" :processing="processing">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">{{ $strings.LabelTranscript }}</p>
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
      </div>
      <p dir="auto" class="text-lg font-semibold mb-6">{{ title }}</p>

      <div v-if="formattedTranscript" class="whitespace-pre-wrap font-mono text-sm">
        <div v-for="(segment, index) in formattedTranscript.segments" :key="index" class="mb-4">
          <div class="flex items-start">
            <div class="text-gray-400 mr-2 whitespace-nowrap">{{ formatTime(segment.start) }}</div>
            <div class="text-gray-100">{{ segment.text }}</div>
          </div>
        </div>
      </div>
      <div v-else class="text-center text-gray-300">
        <p>{{ $strings.MessageNoTranscriptAvailable }}</p>
      </div>
    </div>
  </modals-modal>
</template>

<script>
export default {
  data() {
    return {
      processing: false
    }
  },
  methods: {
    formatTime(seconds) {
      if (seconds === undefined || seconds === null) return '0:00'

      // Convert to number if it's a string
      const totalSeconds = Number(seconds)
      const minutes = Math.floor(totalSeconds / 60)
      const secs = Math.floor(totalSeconds % 60)
      return `${minutes}:${secs.toString().padStart(2, '0')}`
    },
    seekToTime(seconds) {
      if (seconds === undefined || seconds === null) return

      // Emit event to seek player to this time
      this.$root.$emit('player-seek', Number(seconds))
    },
    extractSeconds(timeObj) {
      if (!timeObj) return 0
      if (typeof timeObj === 'number') return timeObj

      // Handle old GCP format with seconds.low/high and nanos
      if (timeObj.seconds) {
        const seconds = timeObj.seconds
        if (typeof seconds === 'object' && 'low' in seconds && 'high' in seconds) {
          return seconds.low + seconds.high * Math.pow(2, 32)
        }
        return Number(seconds) + (timeObj.nanos || 0) / 1e9
      }

      return 0
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showTranscriptModal
      },
      set(val) {
        this.$store.commit('globals/setShowTranscriptModal', val)
      }
    },
    libraryItem() {
      return this.$store.state.globals.transcriptModalData?.libraryItem
    },
    episode() {
      return this.$store.state.globals.transcriptModalData?.episode || {}
    },
    title() {
      return this.episode.title || 'No Episode Title'
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
    formattedTranscript() {
      if (!this.episode.transcript) return null

      // Handle legacy string format (unlikely but possible)
      if (typeof this.episode.transcript === 'string') {
        try {
          return JSON.parse(this.episode.transcript)
        } catch (error) {
          console.error('Failed to parse transcript JSON', error)
          return null
        }
      }

      // If it's an array (old format), convert to new format
      if (Array.isArray(this.episode.transcript)) {
        const segments = this.episode.transcript.map((result) => ({
          text: result.transcript,
          start: result.words && result.words.length > 0 ? this.extractSeconds(result.words[0].startTime) : 0,
          end: result.words && result.words.length > 0 ? this.extractSeconds(result.words[result.words.length - 1].endTime) : 0
        }))

        return {
          results: this.episode.transcript,
          segments: segments
        }
      }

      // Already in new format with results and segments arrays
      return this.episode.transcript
    },
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    }
  }
}
</script>

<style scoped>
.word-timestamp {
  opacity: 0;
  transition: opacity 0.2s;
}
.word:hover .word-timestamp {
  opacity: 1;
}
</style>
