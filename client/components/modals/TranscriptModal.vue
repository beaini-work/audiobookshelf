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

      <div v-if="transcript" class="whitespace-pre-wrap font-mono text-sm">
        <div v-for="(segment, index) in transcript" :key="index" class="mb-4">
          <div class="text-gray-100">{{ segment.transcript }}</div>
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
    formatTime(timeObj) {
      if (!timeObj) return '0:00'
      const totalSeconds = Number(timeObj.seconds) + timeObj.nanos / 1000000000
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = Math.floor(totalSeconds % 60)
      return `${minutes}:${seconds.toString().padStart(2, '0')}`
    },
    seekToTime(timeObj) {
      if (!timeObj) return
      const totalSeconds = Number(timeObj.seconds) + timeObj.nanos / 1000000000
      // Emit event to seek player to this time
      this.$root.$emit('player-seek', totalSeconds)
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
    transcript() {
      if (!this.episode.transcript) return null
      // If transcript is a string (old format), try to parse it
      if (typeof this.episode.transcript === 'string') {
        try {
          return JSON.parse(this.episode.transcript)
        } catch (error) {
          console.error('Failed to parse transcript JSON', error)
          // If parsing fails, assume it's old text format and convert to new format
          return [
            {
              transcript: this.episode.transcript,
              words: []
            }
          ]
        }
      }
      // Already in new format
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
