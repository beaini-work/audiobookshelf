<template>
  <div v-if="show" class="w-full bg-black bg-opacity-80 p-4 rounded-lg shadow-lg">
    <div class="relative">
      <!-- Current caption text -->
      <div ref="captionContainer" class="h-24 overflow-y-auto">
        <div v-if="currentSegment" class="text-center">
          <p :class="captionSizeClass">{{ currentSegment.text }}</p>
        </div>
        <div v-else-if="!hasSegments" class="text-white text-sm text-center">No captions available</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    transcript: {
      type: Object,
      default: () => ({ results: [], segments: [] })
    },
    currentTime: {
      type: Number,
      default: 0
    },
    captionSize: {
      type: Number,
      default: 2
    }
  },
  computed: {
    captionSizeClass() {
      const sizes = {
        0: 'text-lg',
        1: 'text-xl',
        2: 'text-2xl',
        3: 'text-3xl'
      }
      return `text-white ${sizes[this.captionSize] || sizes[2]}`
    },
    hasSegments() {
      return this.transcript?.segments?.length > 0
    }
  },
  data() {
    return {
      show: true,
      currentSegment: null
    }
  },
  watch: {
    currentTime: {
      immediate: true,
      handler(newTime) {
        this.updateCurrentSegment(newTime)
      }
    }
  },
  methods: {
    updateCurrentSegment(currentTime) {
      if (!this.hasSegments) {
        this.currentSegment = null
        return
      }

      // Find the segment that contains the current playback time
      for (let i = 0; i < this.transcript.segments.length; i++) {
        const segment = this.transcript.segments[i]
        const segmentStart = segment.start || 0
        const segmentEnd = segment.end || 0

        if (currentTime >= segmentStart && currentTime <= segmentEnd) {
          this.currentSegment = segment
          return
        }
      }

      this.currentSegment = null
    },
    toggleCaptions() {
      this.show = !this.show
    }
  }
}
</script>

<style scoped>
.caption-container {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
  position: relative;
  z-index: 70;
}
.caption-container::-webkit-scrollbar {
  width: 6px;
}
.caption-container::-webkit-scrollbar-track {
  background: transparent;
}
.caption-container::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}
</style> 