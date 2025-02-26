<template>
  <div :id="`lazy-episode-${index}`" class="w-full h-full cursor-pointer" @mouseover="mouseover" @mouseleave="mouseleave">
    <div class="flex" @click="clickedEpisode">
      <div class="flex-grow">
        <div dir="auto" class="flex items-center">
          <span class="text-sm font-semibold">{{ episodeTitle }}</span>
          <widgets-podcast-type-indicator :type="episodeType" />
        </div>

        <div class="h-10 flex items-center mt-1.5 mb-0.5 overflow-hidden">
          <p class="text-sm text-gray-200 line-clamp-2" v-html="episodeSubtitle"></p>
        </div>
        <div class="h-8 flex items-center">
          <div class="w-full inline-flex justify-between max-w-xl">
            <p v-if="episode?.season" class="text-sm text-gray-300">{{ $getString('LabelSeasonNumber', [episode.season]) }}</p>
            <p v-if="episode?.episode" class="text-sm text-gray-300">{{ $getString('LabelEpisodeNumber', [episode.episode]) }}</p>
            <p v-if="episode?.chapters?.length" class="text-sm text-gray-300">{{ $getString('LabelChapterCount', [episode.chapters.length]) }}</p>
            <p v-if="publishedAt" class="text-sm text-gray-300">{{ $getString('LabelPublishedDate', [$formatDate(publishedAt, dateFormat)]) }}</p>
          </div>
        </div>

        <div class="flex items-center pt-2">
          <button class="h-8 px-4 border border-white border-opacity-20 hover:bg-white hover:bg-opacity-10 rounded-full flex items-center justify-center cursor-pointer focus:outline-none" :class="userIsFinished ? 'text-white text-opacity-40' : ''" @click.stop="playClick">
            <span class="material-symbols fill text-2xl" :class="streamIsPlaying ? '' : 'text-success'">{{ streamIsPlaying ? 'pause' : 'play_arrow' }}</span>
            <p class="pl-2 pr-1 text-sm font-semibold">{{ timeRemaining }}</p>
          </button>

          <ui-tooltip v-if="libraryItemIdStreaming && !isStreamingFromDifferentLibrary" :text="isQueued ? $strings.MessageRemoveFromPlayerQueue : $strings.MessageAddToPlayerQueue" :class="isQueued ? 'text-success' : ''" direction="top">
            <ui-icon-btn :icon="isQueued ? 'playlist_add_check' : 'playlist_play'" borderless @click="queueBtnClick" />
          </ui-tooltip>

          <ui-tooltip :text="userIsFinished ? $strings.MessageMarkAsNotFinished : $strings.MessageMarkAsFinished" direction="top">
            <ui-read-icon-btn :disabled="isProcessingReadUpdate" :is-read="userIsFinished" borderless class="mx-1 mt-0.5" @click="toggleFinished" />
          </ui-tooltip>

          <ui-tooltip :text="$strings.LabelYourPlaylists" direction="top">
            <ui-icon-btn icon="playlist_add" borderless @click="clickAddToPlaylist" />
          </ui-tooltip>

          <!-- Knowledge dropdown button -->
          <ui-tooltip :text="'AI Knowledge Tools'" direction="top">
            <div class="knowledge-dropdown">
              <ui-context-menu-dropdown :items="knowledgeMenuItems" :icon-class="'text-blue-400'" :menu-width="220" @action="handleKnowledgeAction">
                <template v-slot:default="slotProps">
                  <button
                    type="button"
                    :disabled="slotProps.disabled"
                    class="relative h-9 w-9 flex items-center justify-center shadow-sm text-left focus:outline-none cursor-pointer text-blue-400 hover:text-blue-300 rounded-full hover:bg-white/5"
                    aria-label="AI Knowledge Tools"
                    aria-haspopup="menu"
                    :aria-expanded="slotProps.showMenu"
                    @click.stop.prevent="
                      () => {
                        slotProps.clickShowMenu()
                        $nextTick(checkAndRepositionDropdowns)
                      }
                    "
                  >
                    <span class="material-symbols text-2xl">psychology</span>
                  </button>
                </template>
              </ui-context-menu-dropdown>
            </div>
          </ui-tooltip>

          <ui-icon-btn v-if="userCanUpdate" icon="edit" borderless @click="clickEdit" />
          <ui-icon-btn v-if="userCanDelete" icon="close" borderless @click="removeClick" />
        </div>
      </div>
      <div v-if="isHovering || isSelected || isSelectionMode" class="hidden md:block w-12 min-w-12" />
    </div>

    <div v-if="isSelected || isSelectionMode" class="absolute top-0 left-0 w-full h-full bg-black bg-opacity-10 z-10 cursor-pointer" @click.stop="clickedSelectionBg" />
    <div class="hidden md:block md:w-12 md:min-w-12 md:-right-0 md:absolute md:top-0 h-full transform transition-transform z-20" :class="!isHovering && !isSelected && !isSelectionMode ? 'translate-x-24' : 'translate-x-0'">
      <div class="flex h-full items-center">
        <div class="mx-1">
          <ui-checkbox v-model="isSelected" @input="selectedUpdated" checkbox-bg="bg" />
        </div>
      </div>
    </div>

    <div v-if="!userIsFinished" class="absolute bottom-0 left-0 h-0.5 bg-warning" :style="{ width: itemProgressPercent * 100 + '%' }" />
  </div>
</template>

<script>
export default {
  props: {
    index: Number,
    libraryItemId: String,
    episode: {
      type: Object,
      default: () => null
    }
  },
  data() {
    return {
      isProcessingReadUpdate: false,
      processingRemove: false,
      isHovering: false,
      isSelected: false,
      isSelectionMode: false
    }
  },
  computed: {
    store() {
      return this.$store || this.$nuxt.$store
    },
    axios() {
      return this.$axios || this.$nuxt.$axios
    },
    userCanUpdate() {
      return this.store.getters['user/getUserCanUpdate']
    },
    userCanDelete() {
      return this.store.getters['user/getUserCanDelete']
    },
    episodeId() {
      return this.episode?.id || ''
    },
    episodeTitle() {
      return this.episode?.title || ''
    },
    episodeSubtitle() {
      return this.episode?.subtitle || this.episode?.description || ''
    },
    episodeType() {
      return this.episode?.episodeType || ''
    },
    publishedAt() {
      return this.episode?.publishedAt
    },
    dateFormat() {
      return this.store.state.serverSettings.dateFormat
    },
    itemProgress() {
      return this.store.getters['user/getUserMediaProgress'](this.libraryItemId, this.episodeId)
    },
    itemProgressPercent() {
      return this.itemProgress?.progress || 0
    },
    userIsFinished() {
      return !!this.itemProgress?.isFinished
    },
    libraryItemIdStreaming() {
      return this.store.getters['getLibraryItemIdStreaming']
    },
    isStreamingFromDifferentLibrary() {
      return this.store.getters['getIsStreamingFromDifferentLibrary']
    },
    isStreaming() {
      return this.store.getters['getIsMediaStreaming'](this.libraryItemId, this.episodeId)
    },
    isQueued() {
      return this.store.getters['getIsMediaQueued'](this.libraryItemId, this.episodeId)
    },
    streamIsPlaying() {
      return this.store.state.streamIsPlaying && this.isStreaming
    },
    timeRemaining() {
      if (this.streamIsPlaying) return this.$strings.ButtonPlaying
      if (!this.itemProgress) return this.$elapsedPretty(this.episode?.duration || 0)
      if (this.userIsFinished) return this.$strings.LabelFinished

      const duration = this.itemProgress.duration || this.episode?.duration || 0
      const remaining = Math.floor(duration - this.itemProgress.currentTime)
      return this.$getString('LabelTimeLeft', [this.$elapsedPretty(remaining)])
    },
    // Knowledge menu items
    knowledgeMenuItems() {
      // Check if transcript exists for this episode
      const hasTranscript = this.episode?.transcript !== undefined

      // Check if summary exists for this episode
      const hasSummary = this.episode?.summary !== undefined

      return [
        {
          text: hasTranscript ? 'View Transcript' : 'Generate Transcript',
          action: hasTranscript ? 'viewTranscript' : 'generateTranscript',
          icon: hasTranscript ? 'description' : 'add_comment'
        },
        {
          text: hasSummary ? 'View Summary' : 'Generate Summary',
          action: hasSummary ? 'viewSummary' : 'generateSummary',
          icon: hasSummary ? 'summarize' : 'auto_awesome_motion'
        },
        {
          text: 'Test my knowledge',
          action: 'testKnowledge',
          icon: 'quiz'
        }
      ]
    }
  },
  methods: {
    setSelectionMode(isSelectionMode) {
      this.isSelectionMode = isSelectionMode
      if (!this.isSelectionMode) this.isSelected = false
    },
    clickedEpisode() {
      this.$emit('view', this.episode)
    },
    clickedSelectionBg() {
      this.isSelected = !this.isSelected
      this.selectedUpdated(this.isSelected)
    },
    selectedUpdated(value) {
      this.$emit('selected', { isSelected: value, episode: this.episode })
    },
    mouseover() {
      this.isHovering = true
    },
    mouseleave() {
      this.isHovering = false
    },
    playClick() {
      if (this.streamIsPlaying) {
        const eventBus = this.$eventBus || this.$nuxt.$eventBus
        eventBus.$emit('pause-item')
      } else {
        this.$emit('play', this.episode)
      }
    },
    queueBtnClick() {
      if (this.isQueued) {
        // Remove from queue
        this.store.commit('removeItemFromQueue', { libraryItemId: this.libraryItemId, episodeId: this.episodeId })
      } else {
        // Add to queue
        this.$emit('addToQueue', this.episode)
      }
    },
    toggleFinished(confirmed = false) {
      if (!this.userIsFinished && this.itemProgressPercent > 0 && !confirmed) {
        const payload = {
          message: this.$getString('MessageConfirmMarkItemFinished', [this.episodeTitle]),
          callback: (confirmed) => {
            if (confirmed) {
              this.toggleFinished(true)
            }
          },
          type: 'yesNo'
        }
        this.store.commit('globals/setConfirmPrompt', payload)
        return
      }

      const updatePayload = {
        isFinished: !this.userIsFinished
      }
      this.isProcessingReadUpdate = true
      this.axios
        .$patch(`/api/me/progress/${this.libraryItemId}/${this.episodeId}`, updatePayload)
        .then(() => {
          this.isProcessingReadUpdate = false
        })
        .catch((error) => {
          console.error('Failed', error)
          this.isProcessingReadUpdate = false
          const toast = this.$toast || this.$nuxt.$toast
          toast.error(updatePayload.isFinished ? this.$strings.ToastItemMarkedAsFinishedFailed : this.$strings.ToastItemMarkedAsNotFinishedFailed)
        })
    },
    clickAddToPlaylist() {
      this.$emit('addToPlaylist', this.episode)
    },
    clickEdit() {
      this.$emit('edit', this.episode)
    },
    removeClick() {
      this.$emit('remove', this.episode)
    },
    destroy() {
      // destroy the vue listeners, etc
      this.$destroy()

      // remove the element from the DOM
      if (this.$el && this.$el.parentNode) {
        this.$el.parentNode.removeChild(this.$el)
      } else if (this.$el && this.$el.remove) {
        this.$el.remove()
      }
    },
    handleKnowledgeAction(action) {
      // Implement the logic for handling knowledge action
      console.log('Handling knowledge action:', action)

      switch (action.action) {
        case 'viewTranscript':
          this.$emit('viewTranscript', this.episode)
          break
        case 'generateTranscript':
          this.$emit('generateTranscript', this.episode)
          break
        case 'viewSummary':
          this.$emit('viewSummary', this.episode)
          break
        case 'generateSummary':
          this.$emit('generateSummary', this.episode)
          break
        case 'testKnowledge':
          this.$emit('testKnowledge', this.episode)
          break
        default:
          console.warn('Unknown knowledge action:', action)
      }
    },
    checkAndRepositionDropdowns() {
      // Wait for DOM updates
      this.$nextTick(() => {
        // Find all dropdown menus in the document
        const dropdownMenus = document.querySelectorAll('[role="menu"]')

        dropdownMenus.forEach((menu) => {
          if (menu.style.display !== 'none') {
            // Ensure high z-index
            menu.style.zIndex = '9999'
            // Make sure it's fixed position
            menu.style.position = 'fixed'

            // Get the button position
            const dropdownButton = this.$el.querySelector('.knowledge-dropdown button')
            if (dropdownButton) {
              const buttonRect = dropdownButton.getBoundingClientRect()

              // Calculate optimal position relative to viewport
              const viewportHeight = window.innerHeight
              const menuHeight = menu.offsetHeight

              // Position above if there's not enough space below
              if (buttonRect.bottom + menuHeight > viewportHeight) {
                menu.style.top = buttonRect.top - menuHeight - 5 + 'px'
              } else {
                menu.style.top = buttonRect.bottom + 5 + 'px'
              }

              // Align horizontally with the button
              menu.style.left = buttonRect.left + 'px'

              // Make sure the menu isn't clipped by window width
              const menuRight = buttonRect.left + menu.offsetWidth
              if (menuRight > window.innerWidth) {
                menu.style.left = window.innerWidth - menu.offsetWidth - 10 + 'px'
              }
            }
          }
        })
      })
    }
  },
  mounted() {
    // Add event listener to reposition any dropdowns when they open
    document.addEventListener('click', this.checkAndRepositionDropdowns)
  },
  beforeDestroy() {
    document.removeEventListener('click', this.checkAndRepositionDropdowns)
  }
}
</script>

<style scoped>
/* Ensure our Knowledge dropdown appears above other elements */
.knowledge-dropdown {
  z-index: 5; /* Reduced from 100 to a lower value so it doesn't appear above modals */
  position: relative;
}

/* Add a subtle highlight for the Knowledge button */
.text-blue-400 {
  color: #60a5fa;
}

.text-blue-300:hover {
  color: #93c5fd;
}

/* Force menu to appear above all other elements with improved styling */
:deep([role='menu']) {
  z-index: 9999 !important;
  position: fixed !important;
  overflow: visible !important;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  background-color: #1f2937 !important; /* Make sure background color is solid */
}

/* Enhance menu items styling */
:deep([role='menu'] button) {
  display: flex !important;
  align-items: center !important;
  padding: 10px 12px !important;
  border-radius: 4px !important;
  margin: 2px 4px !important;
}

:deep([role='menu'] button:hover) {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

/* Improve icon styling */
:deep([role='menu'] button span) {
  margin-right: 8px !important;
  color: #60a5fa !important;
}

/* Ensure menu transition is smooth */
:deep(.menu-enter-active),
:deep(.menu-leave-active) {
  transition: opacity 0.15s ease !important;
}

:deep(.menu-enter),
:deep(.menu-leave-to) {
  opacity: 0 !important;
}
</style>