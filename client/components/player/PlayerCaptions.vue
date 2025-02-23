<template>
  <div v-if="show" class="w-full bg-black bg-opacity-80 p-4 rounded-lg shadow-lg">
    <div class="relative">
      <!-- Caption controls -->
      <div class="absolute top-0 right-0 flex items-center space-x-2">
        <ui-tooltip direction="top" :text="show ? $strings.LabelHideCaptions : $strings.LabelShowCaptions">
          <button @click="toggleCaptions" class="text-gray-300 hover:text-white">
            <span class="material-symbols text-xl">{{ show ? 'closed_caption_disabled' : 'closed_caption' }}</span>
          </button>
        </ui-tooltip>
      </div>

      <!-- Current caption text -->
      <div ref="captionContainer" class="max-h-32 overflow-y-auto">
        <div v-if="currentSegment" class="text-center">
          <p class="text-lg text-white mb-2">{{ currentSegment.transcript }}</p>
          <div class="flex flex-wrap justify-center gap-1">
            <span
              v-for="(word, index) in currentSegment.words"
              :key="index"
              :class="{
                'text-white font-bold': isWordActive(word),
                'text-gray-400': !isWordActive(word)
              }"
              class="text-sm transition-colors duration-200 cursor-pointer hover:text-white"
              @click="seekToWord(word)"
            >
              {{ word.word }}
            </span>
          </div>
        </div>
        <div v-else class="text-white text-sm text-center">No captions available</div>
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
    }
  },
  data() {
    return {
      show: true,
      currentSegment: null,
      currentWordIndex: -1
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
    isWordActive(word) {
      if (!word?.startTime?.seconds || !word?.endTime?.seconds) return false
      const startTime = this.getWordTime(word)
      const endSeconds = word.endTime.seconds
      let endTime = 0
      if (typeof endSeconds === 'object' && 'low' in endSeconds && 'high' in endSeconds) {
        endTime = endSeconds.low + endSeconds.high * Math.pow(2, 32)
      } else {
        endTime = parseFloat(endSeconds) || 0
      }
      return this.currentTime >= startTime && this.currentTime <= endTime
    },
    updateCurrentSegment(currentTime) {
      if (!this.transcript?.length) {
        this.currentSegment = null
        this.currentWordIndex = -1
        return
      }

      for (let i = 0; i < this.transcript.length; i++) {
        const segment = this.transcript[i]
        if (!segment.words?.length) continue

        const segmentStart = this.getWordTime(segment.words[0])
        const segmentEnd = this.getWordTime(segment.words[segment.words.length - 1])

        if (currentTime >= segmentStart && currentTime <= segmentEnd) {
          this.currentSegment = segment

          // Find current word
          for (let j = 0; j < segment.words.length; j++) {
            if (this.isWordActive(segment.words[j])) {
              this.currentWordIndex = j
              this.$nextTick(() => {
                const activeWord = this.$refs.word?.[j]
                if (activeWord) {
                  activeWord.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              })
              return
            }
          }
          return
        }
      }

      this.currentSegment = null
      this.currentWordIndex = -1
    },
    toggleCaptions() {
      this.show = !this.show
    },
    seekToWord(word) {
      if (word?.startTime) {
        const time = this.getWordTime(word)
        this.$emit('seek', time)
      }
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