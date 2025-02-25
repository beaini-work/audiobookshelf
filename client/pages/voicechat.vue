<template>
  <div class="px-2 sm:px-4 py-4 flex flex-col h-full">
    <h1 class="mb-4 text-2xl font-medium text-white">Voice Chat</h1>

    <div class="flex flex-col items-center justify-center border border-primary/30 rounded-md p-8 bg-bg-dark">
      <p class="text-center text-lg mb-4">Voice Chat is now available as a modal that can be accessed from different parts of the app.</p>
      <button @click="openVoiceChat" class="rounded-md bg-primary text-white px-6 py-3 text-xl hover:bg-primary-600 transition-colors flex items-center gap-2">
        <span class="material-symbols">record_voice_over</span>
        Open Voice Chat Modal
      </button>
    </div>
  </div>
</template>

<script>
export default {
  layout: 'default',
  mounted() {
    // Open the voice chat modal automatically
    this.$store.commit('globals/setShowVoiceChatModal', true)
  },
  methods: {
    openVoiceChat() {
      this.$store.commit('globals/setShowVoiceChatModal', true)
    }
  }
}
</script>

<style scoped>
.bg-bg-dark {
  background-color: rgba(40, 40, 40, 0.6);
}
</style> 