<template>
  <div class="px-2 sm:px-4 py-4 flex flex-col h-full overflow-hidden">
    <h1 class="mb-4 text-2xl font-medium text-white">Voice Chat</h1>

    <div class="flex flex-1 flex-col md:flex-row gap-4 min-h-0">
      <!-- Session Controls and Response Panel -->
      <div class="flex-1 flex flex-col border border-primary/30 rounded-md p-4 min-h-0 bg-bg-dark">
        <div v-if="!isSessionActive" class="flex-1 flex flex-col items-center justify-center">
          <button @click="startSession" class="rounded-md bg-primary text-white px-6 py-3 text-xl hover:bg-primary-600 transition-colors">Start Voice Chat Session</button>
          <p class="mt-4 text-gray-300 text-center max-w-md">Start a realtime voice conversation with OpenAI's GPT-4o model. Speak naturally and get responses in real-time.</p>
        </div>

        <div v-else class="flex-1 flex flex-col min-h-0">
          <!-- Conversation Area -->
          <div class="flex-1 overflow-y-auto mb-4 border border-primary/20 rounded p-3 bg-bg-darker text-white">
            <div v-if="transcript" class="mb-4">
              <div class="font-medium mb-1 text-primary-300">You said:</div>
              <div class="pl-3 py-1 text-gray-200">{{ transcript }}</div>
            </div>

            <div v-if="responseText">
              <div class="font-medium mb-1 text-primary-300">Assistant:</div>
              <div class="pl-3 py-1 text-gray-200 whitespace-pre-wrap">{{ responseText }}</div>
            </div>

            <div v-if="!transcript && !responseText" class="flex items-center justify-center h-full text-gray-400 italic">Conversation will appear here</div>
          </div>

          <!-- Controls -->
          <div class="flex flex-col md:flex-row gap-3 items-center">
            <button v-if="!isRecording" @click="startRecording" class="w-full md:w-auto rounded-md bg-primary text-white px-4 py-2 text-md hover:bg-primary-600 transition-colors flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clip-rule="evenodd" />
              </svg>
              Start Speaking
            </button>

            <button v-else @click="stopRecording" class="w-full md:w-auto rounded-md bg-red-500 text-white px-4 py-2 text-md hover:bg-red-600 transition-colors flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" />
              </svg>
              Stop Speaking
            </button>

            <button @click="stopSession" class="w-full md:w-auto rounded-md bg-gray-700 text-white px-4 py-2 text-md hover:bg-gray-600 transition-colors">End Session</button>
          </div>
        </div>
      </div>

      <!-- Event Log -->
      <div class="w-full md:w-96 border border-primary/30 rounded-md p-4 flex flex-col min-h-0 bg-bg-dark">
        <h3 class="text-lg font-medium mb-2 text-white">Event Log</h3>
        <div class="flex-1 overflow-y-auto min-h-0 bg-bg-darker p-3 rounded text-sm font-mono border border-primary/20">
          <div v-for="(event, index) in events" :key="index" class="mb-3">
            <div class="font-medium text-xs mb-1 text-primary-300">{{ event.direction }} {{ formatTimestamp(event.timestamp) }}</div>
            <pre class="whitespace-pre-wrap break-all text-xs text-gray-300">{{ formatEventData(event.data) }}</pre>
          </div>
          <div v-if="events.length === 0" class="flex items-center justify-center h-full text-gray-400 italic">Events will appear here</div>
        </div>
      </div>
    </div>

    <!-- Status indicator -->
    <div v-if="isSessionActive" class="mt-4 px-3 py-2 bg-primary/20 border border-primary/30 rounded-md text-white">
      <div class="flex items-center">
        <div class="w-3 h-3 rounded-full mr-2" :class="isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'"></div>
        <span>{{ isRecording ? 'Recording in progress...' : 'Session active - Ready to record' }}</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  layout: 'default',
  data() {
    return {
      isSessionActive: false,
      events: [],
      dataChannel: null,
      isRecording: false,
      transcript: '',
      responseText: '',
      peerConnection: null,
      audioElement: null,
      mediaRecorder: null,
      audioChunks: []
    }
  },
  methods: {
    async startSession() {
      try {
        // Fetch token from our backend endpoint
        const tokenResponse = await fetch('/api/openai/token')
        const data = await tokenResponse.json()

        if (!data.client_secret?.value) {
          console.error('Failed to get token', data)
          this.$toast.error('Failed to get OpenAI token. Check your API key configuration.', { position: 'bottom-center' })
          return
        }

        const EPHEMERAL_KEY = data.client_secret.value

        // Set up WebRTC connection
        const pc = new RTCPeerConnection()

        // Handle audio output
        this.audioElement = document.createElement('audio')
        this.audioElement.autoplay = true
        pc.ontrack = (e) => (this.audioElement.srcObject = e.streams[0])

        // Set up audio input stream with constraints
        const ms = await navigator.mediaDevices
          .getUserMedia({
            audio: {
              channelCount: 1,
              sampleRate: 16000
            }
          })
          .catch((error) => {
            this.$toast.error(`Microphone access error: ${error.message}`, { position: 'bottom-center' })
            throw error
          })
        pc.addTrack(ms.getTracks()[0])

        // Initialize MediaRecorder
        this.mediaRecorder = new MediaRecorder(ms, {
          mimeType: 'audio/webm'
        })

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && this.isRecording) {
            // Convert blob to array buffer and send it
            event.data.arrayBuffer().then((buffer) => {
              if (this.dataChannel?.readyState === 'open') {
                this.sendClientEvent({
                  type: 'input_audio_buffer.append',
                  audio_buffer: Array.from(new Int16Array(buffer))
                })
              }
            })
          }
        }

        // Create data channel for events
        const dc = pc.createDataChannel('oai-events')
        this.setupDataChannel(dc)
        this.dataChannel = dc

        // Create and set local SDP offer
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        // Send offer to OpenAI and get answer
        const baseUrl = 'https://api.openai.com/v1/realtime'
        const model = 'gpt-4o-realtime-preview-2024-12-17'
        const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
          method: 'POST',
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${EPHEMERAL_KEY}`,
            'Content-Type': 'application/sdp'
          }
        })

        if (!sdpResponse.ok) {
          const errorText = await sdpResponse.text()
          console.error('SDP request failed:', errorText)
          this.$toast.error(`Failed to establish connection: ${errorText}`, { position: 'bottom-center' })
          return
        }

        // Set remote description from answer
        const answer = {
          type: 'answer',
          sdp: await sdpResponse.text()
        }
        await pc.setRemoteDescription(answer)

        this.peerConnection = pc
        this.isSessionActive = true
        this.$toast.success('Voice chat session started', { position: 'bottom-center', timeout: 3000 })

        // Send initial system message
        this.sendClientEvent({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'system',
            content: [
              {
                type: 'text',
                text: `You are an assistant that helps users find and manage their audiobooks. 
                You can engage in friendly conversation and provide information about books.
                Keep your responses relatively concise and conversational.`
              }
            ]
          }
        })
      } catch (error) {
        console.error('Failed to start session:', error)
        this.$toast.error(`Error starting session: ${error.message}`, { position: 'bottom-center' })
      }
    },

    setupDataChannel(dc) {
      dc.onopen = () => {
        console.log('Data channel open')
      }

      dc.onmessage = (event) => {
        const message = JSON.parse(event.data)
        this.events.push({
          direction: '⬅️ RECEIVED',
          timestamp: new Date(),
          data: message
        })

        this.handleServerMessage(message)
      }
    },

    handleServerMessage(message) {
      if (message.type === 'transcript.partial') {
        this.transcript = message.text
      } else if (message.type === 'transcript.complete') {
        this.transcript = message.text
      } else if (message.type === 'speech.generation.partial' || message.type === 'speech.generation.complete') {
        // Update the text response
        const textItems = message.content.filter((item) => item.type === 'text')
        if (textItems.length > 0) {
          this.responseText = textItems[0].text
        }
      }
    },

    sendClientEvent(message) {
      if (this.dataChannel?.readyState === 'open') {
        this.events.push({
          direction: '➡️ SENT',
          timestamp: new Date(),
          data: message
        })

        this.dataChannel.send(JSON.stringify(message))
      }
    },

    startRecording() {
      if (this.mediaRecorder && this.isSessionActive) {
        this.isRecording = true
        this.mediaRecorder.start(300) // Capture and send chunks every 300ms
        this.$toast.info('Recording started', { position: 'bottom-center', timeout: 2000 })
      }
    },

    stopRecording() {
      if (this.mediaRecorder && this.isRecording) {
        this.isRecording = false
        this.mediaRecorder.stop()
        this.$toast.info('Recording stopped', { position: 'bottom-center', timeout: 2000 })
      }
    },

    stopSession() {
      if (this.peerConnection) {
        // Close media tracks
        this.peerConnection.getSenders().forEach((sender) => {
          if (sender.track) {
            sender.track.stop()
          }
        })

        // Close data channel and connection
        if (this.dataChannel) {
          this.dataChannel.close()
        }

        this.peerConnection.close()
        this.peerConnection = null
        this.dataChannel = null

        // Clean up audio element
        if (this.audioElement) {
          this.audioElement.srcObject = null
          this.audioElement = null
        }

        // Reset state
        this.isSessionActive = false
        this.isRecording = false
        this.$toast.success('Voice chat session ended', { position: 'bottom-center', timeout: 3000 })
      }
    },

    formatTimestamp(timestamp) {
      return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    },

    formatEventData(data) {
      // Truncate large arrays for display
      const sanitizedData = JSON.parse(JSON.stringify(data))
      if (sanitizedData.audio_buffer && sanitizedData.audio_buffer.length > 100) {
        sanitizedData.audio_buffer = `[Array(${sanitizedData.audio_buffer.length}) truncated]`
      }
      return JSON.stringify(sanitizedData, null, 2)
    }
  }
}
</script>

<style scoped>
/* Add any additional custom styles here */
.bg-bg-darker {
  background-color: rgba(30, 30, 30, 0.8);
}

.bg-bg-dark {
  background-color: rgba(40, 40, 40, 0.6);
}

.text-primary-300 {
  color: #93c5fd;
}

/* Animation for recording indicator */
@keyframes pulse {
  0% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 1.5s infinite;
}
</style> 