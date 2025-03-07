export const state = () => ({
  isMobile: false,
  isMobileLandscape: false,
  isMobilePortrait: false,
  showBatchCollectionModal: false,
  showCollectionsModal: false,
  showEditCollectionModal: false,
  showPlaylistsModal: false,
  showEditPlaylistModal: false,
  showEditPodcastEpisode: false,
  showViewPodcastEpisodeModal: false,
  showRSSFeedOpenCloseModal: false,
  showShareModal: false,
  showConfirmPrompt: false,
  showRawCoverPreviewModal: false,
  showVoiceChatModal: false,
  voiceChatEpisodeData: null,
  confirmPromptOptions: null,
  showEditAuthorModal: false,
  rssFeedEntity: null,
  selectedEpisode: null,
  selectedEpisodeTab: 'description', // Default tab for episode view
  selectedPlaylistItems: null,
  selectedPlaylist: null,
  selectedCollection: null,
  selectedAuthor: null,
  selectedMediaItems: [],
  selectedRawCoverUrl: null,
  selectedMediaItemShare: null,
  isCasting: false, // Actively casting
  isChromecastInitialized: false, // Script loadeds
  showBatchQuickMatchModal: false,
  dateFormats: [
    {
      text: 'MM/DD/YYYY',
      value: 'MM/dd/yyyy'
    },
    {
      text: 'DD/MM/YYYY',
      value: 'dd/MM/yyyy'
    },
    {
      text: 'DD.MM.YYYY',
      value: 'dd.MM.yyyy'
    },
    {
      text: 'YYYY-MM-DD',
      value: 'yyyy-MM-dd'
    },
    {
      text: 'MMM do, yyyy',
      value: 'MMM do, yyyy'
    },
    {
      text: 'MMMM do, yyyy',
      value: 'MMMM do, yyyy'
    },
    {
      text: 'dd MMM yyyy',
      value: 'dd MMM yyyy'
    },
    {
      text: 'dd MMMM yyyy',
      value: 'dd MMMM yyyy'
    }
  ],
  timeFormats: [
    {
      text: 'h:mma (am/pm)',
      value: 'h:mma'
    },
    {
      text: 'HH:mm (24-hour)',
      value: 'HH:mm'
    }
  ],
  podcastTypes: [
    { text: 'Episodic', value: 'episodic', descriptionKey: 'LabelEpisodic' },
    { text: 'Serial', value: 'serial', descriptionKey: 'LabelSerial' }
  ],
  episodeTypes: [
    { text: 'Full', value: 'full', descriptionKey: 'LabelFull' },
    { text: 'Trailer', value: 'trailer', descriptionKey: 'LabelTrailer' },
    { text: 'Bonus', value: 'bonus', descriptionKey: 'LabelBonus' }
  ],
  libraryIcons: ['database', 'audiobookshelf', 'books-1', 'books-2', 'book-1', 'microphone-1', 'microphone-3', 'radio', 'podcast', 'rss', 'headphones', 'music', 'file-picture', 'rocket', 'power', 'star', 'heart'],
  showTranscriptModal: false,
  transcriptModalData: null
})

export const getters = {
  getLibraryItemCoverSrc:
    (state, getters, rootState, rootGetters) =>
    (libraryItem, placeholder = null, raw = false) => {
      if (!placeholder) placeholder = `${rootState.routerBasePath}/book_placeholder.jpg`
      if (!libraryItem) return placeholder
      const media = libraryItem.media
      if (!media?.coverPath || media.coverPath === placeholder) return placeholder

      // Absolute URL covers (should no longer be used)
      if (media.coverPath.startsWith('http:') || media.coverPath.startsWith('https:')) return media.coverPath

      const userToken = rootGetters['user/getToken']
      const lastUpdate = libraryItem.updatedAt || Date.now()
      const libraryItemId = libraryItem.libraryItemId || libraryItem.id // Workaround for /users/:id page showing media progress covers
      return `${rootState.routerBasePath}/api/items/${libraryItemId}/cover?ts=${lastUpdate}${raw ? '&raw=1' : ''}`
    },
  getLibraryItemCoverSrcById:
    (state, getters, rootState, rootGetters) =>
    (libraryItemId, timestamp = null, raw = false) => {
      const placeholder = `${rootState.routerBasePath}/book_placeholder.jpg`
      if (!libraryItemId) return placeholder
      const userToken = rootGetters['user/getToken']
      return `${rootState.routerBasePath}/api/items/${libraryItemId}/cover?${raw ? '&raw=1' : ''}${timestamp ? `&ts=${timestamp}` : ''}`
    },
  getIsBatchSelectingMediaItems: (state) => {
    return state.selectedMediaItems.length
  }
}

export const mutations = {
  updateWindowSize(state, { width, height }) {
    state.isMobile = width < 640 || height < 640
    state.isMobileLandscape = state.isMobile && height < width
    state.isMobilePortrait = state.isMobile && height >= width
  },
  setShowCollectionsModal(state, val) {
    state.showBatchCollectionModal = false
    state.showCollectionsModal = val
  },
  setShowBatchCollectionsModal(state, val) {
    state.showBatchCollectionModal = true
    state.showCollectionsModal = val
  },
  setShowEditCollectionModal(state, val) {
    state.showEditCollectionModal = val
  },
  setShowPlaylistsModal(state, val) {
    state.showPlaylistsModal = val
  },
  setShowEditPlaylistModal(state, val) {
    state.showEditPlaylistModal = val
  },
  setShowEditPodcastEpisodeModal(state, val) {
    state.showEditPodcastEpisode = val
  },
  setShowViewPodcastEpisodeModal(state, val) {
    state.showViewPodcastEpisodeModal = val
    if (!val) state.selectedEpisode = null
  },
  setShowRSSFeedOpenCloseModal(state, val) {
    state.showRSSFeedOpenCloseModal = val
  },
  setRSSFeedOpenCloseModal(state, entity) {
    state.rssFeedEntity = entity
    state.showRSSFeedOpenCloseModal = true
  },
  setShowShareModal(state, val) {
    state.showShareModal = val
  },
  setShareModal(state, mediaItemShare) {
    state.selectedMediaItemShare = mediaItemShare
    state.showShareModal = true
  },
  setShowConfirmPrompt(state, val) {
    state.showConfirmPrompt = val
  },
  setConfirmPrompt(state, options) {
    state.confirmPromptOptions = options
    state.showConfirmPrompt = true
  },
  setShowRawCoverPreviewModal(state, val) {
    state.showRawCoverPreviewModal = val
  },
  setRawCoverPreviewModal(state, rawCoverUrl) {
    state.selectedRawCoverUrl = rawCoverUrl
    state.showRawCoverPreviewModal = true
  },
  setEditCollection(state, collection) {
    state.selectedCollection = collection
    state.showEditCollectionModal = true
  },
  setEditPlaylist(state, playlist) {
    state.selectedPlaylist = playlist
    state.showEditPlaylistModal = true
  },
  setSelectedEpisode(state, episode) {
    state.selectedEpisode = episode
  },
  setSelectedEpisodeTab(state, tab) {
    state.selectedEpisodeTab = tab
  },
  setSelectedPlaylistItems(state, items) {
    state.selectedPlaylistItems = items
  },
  showEditAuthorModal(state, author) {
    state.selectedAuthor = author
    state.showEditAuthorModal = true
  },
  setShowEditAuthorModal(state, val) {
    state.showEditAuthorModal = val
  },
  setSelectedAuthor(state, author) {
    state.selectedAuthor = author
  },
  setChromecastInitialized(state, val) {
    state.isChromecastInitialized = val
  },
  setCasting(state, val) {
    state.isCasting = val
  },
  setShowBatchQuickMatchModal(state, val) {
    state.showBatchQuickMatchModal = val
  },
  resetSelectedMediaItems(state) {
    state.selectedMediaItems = []
  },
  toggleMediaItemSelected(state, item) {
    if (state.selectedMediaItems.some((i) => i.id === item.id)) {
      state.selectedMediaItems = state.selectedMediaItems.filter((i) => i.id !== item.id)
    } else {
      state.selectedMediaItems.push(item)
    }
  },
  setMediaItemSelected(state, { item, selected }) {
    const isAlreadySelected = state.selectedMediaItems.some((i) => i.id === item.id)
    if (isAlreadySelected && !selected) {
      state.selectedMediaItems = state.selectedMediaItems.filter((i) => i.id !== item.id)
    } else if (selected && !isAlreadySelected) {
      state.selectedMediaItems.push(item)
    }
  },
  setShowTranscriptModal(state, data) {
    if (data === false) {
      state.showTranscriptModal = false
      state.transcriptModalData = null
    } else {
      state.showTranscriptModal = true
      state.transcriptModalData = data
    }
  },
  setShowVoiceChatModal(state, val) {
    state.showVoiceChatModal = val
    if (!val) {
      state.voiceChatEpisodeData = null
    }
  },
  setVoiceChatEpisodeData(state, data) {
    state.voiceChatEpisodeData = data
  }
}
