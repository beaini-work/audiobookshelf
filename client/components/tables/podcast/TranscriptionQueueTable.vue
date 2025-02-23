<template>
  <div class="w-full my-2">
    <div class="w-full bg-primary px-4 md:px-6 py-2 flex items-center">
      <p class="pr-2 md:pr-4">{{ $strings.HeaderTranscriptionQueue }}</p>
      <div class="h-5 md:h-7 w-5 md:w-7 rounded-full bg-white bg-opacity-10 flex items-center justify-center">
        <span class="text-sm font-mono">{{ queue.length }}</span>
      </div>
    </div>
    <transition name="slide">
      <div class="w-full">
        <table class="text-sm tracksTable">
          <tr>
            <th class="text-left px-4 min-w-48">{{ $strings.LabelPodcast }}</th>
            <th class="text-left px-4">{{ $strings.LabelEpisodeTitle }}</th>
          </tr>
          <template v-for="transcriptionQueued in queue">
            <tr :key="transcriptionQueued.episodeId">
              <td class="px-4">
                <div class="flex items-center">
                  <nuxt-link :to="`/item/${transcriptionQueued.libraryItemId}`" class="text-sm text-gray-200 hover:underline">{{ transcriptionQueued.podcastTitle }}</nuxt-link>
                </div>
              </td>
              <td dir="auto" class="px-4">
                {{ transcriptionQueued.episodeTitle }}
              </td>
            </tr>
          </template>
        </table>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  props: {
    queue: {
      type: Array,
      default: () => []
    },
    libraryItemId: String
  },
  data() {
    return {}
  },
  computed: {},
  methods: {},
  mounted() {}
}
</script> 