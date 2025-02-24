<template>
  <div class="w-full h-full p-4 md:p-8">
    <div class="max-w-6xl mx-auto">
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-2xl font-semibold">Knowledge Base</h1>
        <div class="relative w-64">
          <input type="text" placeholder="Search content..." class="w-full h-10 px-4 py-2 bg-primary bg-opacity-50 border border-white border-opacity-10 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-opacity-20" v-model="searchQuery" />
          <span class="material-symbols absolute right-3 top-2.5 text-gray-400">search</span>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Content Summary Cards -->
        <div v-for="n in 6" :key="n" class="bg-primary bg-opacity-50 rounded-lg p-6 border border-white border-opacity-5 hover:border-opacity-10 transition-all cursor-pointer">
          <h3 class="text-lg font-medium mb-2">Content Summary {{ n }}</h3>
          <p class="text-gray-300 text-sm mb-4">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.</p>
          <div class="flex items-center text-sm text-gray-400">
            <span class="material-symbols text-base mr-1">schedule</span>
            <span>Last updated 2 days ago</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      searchQuery: ''
    }
  },
  computed: {
    currentLibraryId() {
      return this.$store.state.libraries.currentLibraryId
    }
  }
}
</script>

<style scoped>
.material-symbols {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style> 