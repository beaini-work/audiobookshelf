<template>
  <div class="page" :class="streamLibraryItem ? 'streaming' : ''">
    <app-book-shelf-toolbar page="podcast-search" />

    <div id="bookshelf" class="w-full overflow-y-auto px-2 py-6 sm:px-4 md:p-12 relative">
      <div class="w-full max-w-5xl mx-auto py-4">
        <p class="text-xl mb-2 font-semibold px-4 md:px-0">{{ $strings.HeaderCurrentTranscriptions }}</p>
        <p v-if="!episodesTranscribing.length" class="text-lg py-4">{{ $strings.MessageNoTranscriptionsInProgress }}</p>
        <template v-for="episode in episodesTranscribing">
          <div :key="episode.id" class="flex py-5 relative">
            <covers-preview-cover :src="$store.getters['globals/getLibraryItemCoverSrcById'](episode.libraryItemId)" :width="96" :book-cover-aspect-ratio="bookCoverAspectRatio" :show-resolution="false" class="hidden md:block" />
            <div class="flex-grow pl-4 max-w-2xl">
              <!-- mobile -->
              <div class="flex md:hidden mb-2">
                <covers-preview-cover :src="$store.getters['globals/getLibraryItemCoverSrcById'](episode.libraryItemId)" :width="48" :book-cover-aspect-ratio="bookCoverAspectRatio" :show-resolution="false" class="md:hidden" />
                <div class="flex-grow px-2">
                  <div class="flex items-center">
                    <nuxt-link :to="`/item/${episode.libraryItemId}`" class="text-sm text-gray-200 hover:underline">{{ episode.podcastTitle }}</nuxt-link>
                  </div>
                </div>
              </div>
              <!-- desktop -->
              <div class="hidden md:block">
                <div class="flex items-center">
                  <nuxt-link :to="`/item/${episode.libraryItemId}`" class="text-sm text-gray-200 hover:underline">{{ episode.podcastTitle }}</nuxt-link>
                </div>
              </div>

              <div class="flex items-center mb-2">
                <span class="font-semibold text-sm md:text-base">{{ episode.episodeTitle }}</span>
              </div>
            </div>
          </div>
        </template>

        <tables-podcast-transcription-queue-table v-if="episodeTranscriptionsQueued.length" :queue="episodeTranscriptionsQueued"></tables-podcast-transcription-queue-table>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  async asyncData({ params, redirect, store }) {
    var libraryId = params.library
    var libraryData = await store.dispatch('libraries/fetch', libraryId)
    if (!libraryData) {
      return redirect('/oops?message=Library not found')
    }

    // Redirect book libraries
    const library = libraryData.library
    if (library.mediaType === 'book') {
      return redirect(`/library/${libraryId}`)
    }

    return {
      libraryId: params.library
    }
  },
  data() {
    return {
      episodesTranscribing: [],
      episodeTranscriptionsQueued: [],
      processing: false
    }
  },
  computed: {
    bookCoverAspectRatio() {
      return this.$store.getters['libraries/getBookCoverAspectRatio']
    },
    streamLibraryItem() {
      return this.$store.state.streamLibraryItem
    }
  },
  methods: {
    episodeTranscriptionQueued(transcriptionQueued) {
      if (transcriptionQueued.libraryId === this.libraryId) {
        this.episodeTranscriptionsQueued.push(transcriptionQueued)
      }
    },
    episodeTranscriptionStarted(transcriptionStarted) {
      if (transcriptionStarted.libraryId === this.libraryId) {
        this.episodeTranscriptionsQueued = this.episodeTranscriptionsQueued.filter((d) => d.episodeId !== transcriptionStarted.episodeId)
        this.episodesTranscribing.push(transcriptionStarted)
      }
    },
    episodeTranscriptionFinished(transcriptionFinished) {
      if (transcriptionFinished.libraryId === this.libraryId) {
        this.episodeTranscriptionsQueued = this.episodeTranscriptionsQueued.filter((d) => d.episodeId !== transcriptionFinished.episodeId)
        this.episodesTranscribing = this.episodesTranscribing.filter((d) => d.episodeId !== transcriptionFinished.episodeId)
      }
    },
    async loadInitialTranscriptionQueue() {
      this.processing = true
      const queuePayload = await this.$axios.$get(`/api/libraries/${this.libraryId}/episode-transcriptions`).catch((error) => {
        console.error('Failed to get transcription queue', error)
        this.$toast.error(this.$strings.ToastFailedToLoadData)
        return null
      })
      this.processing = false
      this.episodeTranscriptionsQueued = queuePayload?.queue || []

      if (queuePayload?.currentTranscription) {
        this.episodesTranscribing.push(queuePayload.currentTranscription)
      }

      // Initialize listeners after load to prevent event race conditions
      this.initListeners()
    },
    initListeners() {
      this.$root.socket.on('episode_transcription_queued', this.episodeTranscriptionQueued)
      this.$root.socket.on('episode_transcription_started', this.episodeTranscriptionStarted)
      this.$root.socket.on('episode_transcription_finished', this.episodeTranscriptionFinished)
    }
  },
  mounted() {
    this.loadInitialTranscriptionQueue()
  },
  beforeDestroy() {
    this.$root.socket.off('episode_transcription_queued', this.episodeTranscriptionQueued)
    this.$root.socket.off('episode_transcription_started', this.episodeTranscriptionStarted)
    this.$root.socket.off('episode_transcription_finished', this.episodeTranscriptionFinished)
  }
}
</script> 