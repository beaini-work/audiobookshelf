<template>
  <div v-if="show" class="w-full bg-black bg-opacity-80 p-4 rounded-lg shadow-lg">
    <div class="relative">
      <!-- Current caption text -->
      <div ref="captionContainer" class="h-24 overflow-y-auto">
        <div v-if="currentSegment" class="text-center">
          <p :class="captionSizeClass">{{ currentSegment.transcript }}</p>
        </div>
        <div v-else-if="!transcript?.length" class="text-white text-sm text-center">No captions available</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    transcript: {
      type: Array,
      default: () => []
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
    getWordTime(word) {
      if (!word?.startTime?.seconds) return 0
      const seconds = word.startTime.seconds
      if (typeof seconds === 'object' && 'low' in seconds && 'high' in seconds) {
        return seconds.low + seconds.high * Math.pow(2, 32)
      }
      return parseFloat(seconds) || 0
    },
    updateCurrentSegment(currentTime) {
      if (!this.transcript?.length) {
        this.currentSegment = null
        return
      }

      for (let i = 0; i < this.transcript.length; i++) {
        const segment = this.transcript[i]
        if (!segment.words?.length) continue

        const segmentStart = this.getWordTime(segment.words[0])
        const segmentEnd = this.getWordTime(segment.words[segment.words.length - 1])

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