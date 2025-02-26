<template>
  <modals-modal v-model="show" name="voice-chat-modal" :width="900" :height="'unset'" :processing="false">
    <template #outer>
      <div class="absolute top-0 left-0 p-5 w-2/3 overflow-hidden">
        <p class="text-3xl text-white truncate">Podcast Knowledge Quiz</p>
      </div>
    </template>
    <div ref="wrapper" class="p-4 w-full text-sm rounded-lg bg-bg shadow-lg border border-black-300 relative overflow-y-auto" style="max-height: 80vh">
      <div class="flex flex-1 flex-col md:flex-row gap-4 min-h-0">
        <!-- Session Controls and Response Panel -->
        <div class="flex-1 flex flex-col border border-primary/30 rounded-md p-4 min-h-0 bg-bg-dark">
          <div v-if="!isSessionActive" class="flex-1 flex flex-col items-center justify-center">
            <div v-if="hasEpisodeData">
              <p class="text-gray-300 text-center max-w-md">
                <span class="inline-block mb-3">
                  <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-primary inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Connecting to podcast quiz...
                </span>
                <br />
                Preparing quiz for "{{ episodeData.title }}". The session will start automatically.
              </p>
            </div>
            <div v-else class="text-center p-6">
              <p class="text-red-400 text-xl mb-4">No Episode Data Available</p>
              <p class="text-gray-300 max-w-md">Please select a podcast episode with a summary to take a knowledge quiz.</p>
            </div>
          </div>

          <div v-else class="flex-1 flex flex-col min-h-0">
            <!-- Q&A Card Display -->
            <div v-if="quizHistory.length > 0" class="mb-4 border border-primary/30 rounded-md p-4 bg-bg-darker">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-medium text-white">Quiz Results</h3>
                <div class="flex items-center gap-2">
                  <button @click="prevQuestion" class="p-1 rounded-full bg-primary/20 text-white hover:bg-primary/40 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="currentQuizIndex === 0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </button>
                  <span class="text-sm text-white">{{ currentQuizIndex + 1 }} / {{ quizHistory.length }}</span>
                  <button @click="nextQuestion" class="p-1 rounded-full bg-primary/20 text-white hover:bg-primary/40 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="currentQuizIndex >= quizHistory.length - 1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              <div class="card-content bg-bg-dark border border-primary/20 rounded-lg p-4">
                <div class="mb-3">
                  <div class="text-primary-300 font-medium">Question:</div>
                  <div class="text-white">{{ currentQuiz.question }}</div>
                </div>
                <div class="mb-3">
                  <div class="text-primary-300 font-medium">Your Answer:</div>
                  <div class="text-white">{{ currentQuiz.userAnswer }}</div>
                </div>
                <div class="mb-3">
                  <div class="text-primary-300 font-medium">Correct Answer:</div>
                  <div class="text-white">{{ currentQuiz.correctAnswer }}</div>
                </div>
                <div class="flex items-center">
                  <div class="text-primary-300 font-medium mr-2">Score:</div>
                  <div class="px-3 py-1 rounded-full text-white font-bold" :class="scoreClass(currentQuiz.score)">{{ currentQuiz.score }}%</div>
                </div>
              </div>
            </div>

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
        <div v-if="showDebug" class="w-full md:w-96 border border-primary/30 rounded-md p-4 flex flex-col min-h-0 bg-bg-dark">
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-lg font-medium text-white">Event Log</h3>
            <button @click="showDebug = false" class="text-gray-400 hover:text-white">
              <span class="material-symbols">close</span>
            </button>
          </div>
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
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <div class="w-3 h-3 rounded-full mr-2" :class="isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'"></div>
            <span>{{ isRecording ? 'Recording in progress...' : 'Session active - Ready to record' }}</span>
          </div>
          <button v-if="!showDebug" @click="showDebug = true" class="text-xs text-primary hover:underline">Show Debug</button>
        </div>
      </div>
    </div>
  </modals-modal>
</template>

<script>
// Function description similar to the React pattern
const functionDescription = `
Call this function when assessing a user's knowledge about a podcast episode they listened to. Evaluate their answer fairly and provide a score based on accuracy.
`

// Session update similar to the React pattern
const sessionUpdate = {
  type: 'session.update',
  session: {
    tools: [
      {
        type: 'function',
        name: 'assess_podcast_knowledge',
        description: functionDescription,
        parameters: {
          type: 'object',
          strict: true,
          properties: {
            question: {
              type: 'string',
              description: 'The question about the podcast episode'
            },
            correctAnswer: {
              type: 'string',
              description: 'Detailed correct answer explanation about the podcast content'
            },
            userAnswer: {
              type: 'string',
              description: "The user's provided answer"
            },
            score: {
              type: 'number',
              description: "Numerical score between 0-100 based on accuracy of the user's answer"
            }
          },
          required: ['question', 'correctAnswer', 'userAnswer', 'score']
        }
      }
    ],
    tool_choice: 'auto'
  }
}

export default {
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
      audioChunks: [],
      showDebug: false,
      functionAdded: false,
      functionCallOutput: null,
      podcastQuestionData: {
        question: '',
        correctAnswer: '',
        userAnswer: '',
        score: 0
      },
      quizHistory: [], // Array to store quiz history
      currentQuizIndex: 0 // Index to track the currently displayed quiz
    }
  },
  computed: {
    show: {
      get() {
        return this.$store.state.globals.showVoiceChatModal
      },
      set(val) {
        this.$store.commit('globals/setShowVoiceChatModal', val)
        if (!val && this.isSessionActive) {
          this.stopSession()
        }
      }
    },
    episodeData() {
      return this.$store.state.globals.voiceChatEpisodeData || {}
    },
    hasEpisodeData() {
      return this.episodeData && this.episodeData.summary
    },
    episodeSummaryText() {
      if (!this.hasEpisodeData) return ''

      const title = this.episodeData.title || 'Untitled Episode'
      const summary = this.episodeData.summary || this.episodeData.description || ''
      const author = this.episodeData.author || this.episodeData.podcastTitle || ''

      return `Title: ${title}\n${author ? `Podcast: ${author}\n` : ''}Summary: ${summary}`
    },
    currentQuiz() {
      if (this.quizHistory.length === 0) {
        return { question: '', correctAnswer: '', userAnswer: '', score: 0 }
      }
      return this.quizHistory[this.currentQuizIndex]
    }
  },
  watch: {
    show(newVal) {
      // Automatically start session when modal becomes visible and episode data is available
      if (newVal && this.hasEpisodeData && !this.isSessionActive) {
        this.startSession()
      }
    }
  },
  methods: {
    async startSession() {
      try {
        // Reset quiz history when starting a new session
        this.quizHistory = []
        this.currentQuizIndex = 0

        // Check if episode data exists before starting
        if (!this.hasEpisodeData) {
          this.$toast.error('Cannot start quiz: No episode data available.', { position: 'bottom-center' })
          return
        }

        // Reset function-related state when starting a new session
        this.functionAdded = false
        this.functionCallOutput = null
        this.resetPodcastAssessment()

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
        this.$toast.success('Podcast quiz session started', { position: 'bottom-center', timeout: 3000 })

        // Send initial system message
        this.sendClientEvent({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'system',
            content: [
              {
                type: 'text',
                text: `You are a podcast knowledge quiz master who tests users on their understanding of podcast episodes they've listened to. 
                Ask thoughtful, engaging questions about the podcast content when prompted.
                Evaluate answers fairly and provide constructive feedback.
                Keep your responses conversational and educational.`
              }
            ]
          }
        })

        // NOTE: We no longer add the function here, it will be added when the session.created event is detected

        // If we have episode data, automatically request a knowledge quiz after a short delay
        setTimeout(() => {
          console.log('Requesting podcast quiz')
          this.requestPodcastQuiz()
        }, 1500)
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

        // Store the raw event for processing
        this.events.unshift(message)

        // Also store the formatted event for display
        this.events.push({
          direction: '⬅️ RECEIVED',
          timestamp: new Date(),
          data: message
        })

        this.handleServerMessage(message)
        this.processEvents()
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

    // New method to process events systematically like in the React implementation
    processEvents() {
      if (!this.events || this.events.length === 0) return

      // Check for session.created event to add function (like the React useEffect)
      if (!this.functionAdded) {
        const sessionCreatedEvent = this.events.find((event) => event.type === 'session.created')

        if (sessionCreatedEvent) {
          console.log('Adding podcast assessment function')
          this.addPodcastAssessmentFunction()
          this.functionAdded = true
        }
      }

      // Check for response.done events with function calls (similar to the React implementation)
      const recentEvents = this.events.filter((e) => e.type === 'response.done')

      if (recentEvents.length > 0) {
        const mostRecentEvent = recentEvents[0]

        if (mostRecentEvent.response?.output) {
          mostRecentEvent.response.output.forEach((output) => {
            if (output.type === 'function_call' && output.name === 'assess_podcast_knowledge') {
              // Store the function call output
              this.functionCallOutput = output

              // Parse arguments if needed
              try {
                if (output.arguments) {
                  const args = JSON.parse(output.arguments)
                  this.podcastQuestionData = {
                    question: args.question || '',
                    correctAnswer: args.correctAnswer || '',
                    userAnswer: args.userAnswer || '',
                    score: args.score || 0
                  }

                  // Add to quiz history and set current index to the latest
                  this.quizHistory.push({ ...this.podcastQuestionData })
                  this.currentQuizIndex = this.quizHistory.length - 1
                }
              } catch (e) {
                console.error('Error parsing function arguments', e)
              }

              // Send a follow-up prompt after a short delay
              setTimeout(() => {
                this.continueAfterAssessment(output)
              }, 500)
            }
          })
        }
      }
    },

    // Method to add the podcast assessment function
    addPodcastAssessmentFunction() {
      if (this.isSessionActive && this.dataChannel?.readyState === 'open') {
        this.sendClientEvent(sessionUpdate)
        console.log('Function added in response to session.created')
      }
    },

    // New method to continue conversation after knowledge assessment
    continueAfterAssessment(output) {
      if (this.isSessionActive && this.dataChannel?.readyState === 'open') {
        let scoreBasedInstructions = ''

        // Parse the output arguments to get the score
        try {
          if (output.arguments) {
            const args = JSON.parse(output.arguments)
            const score = args.score || 0

            if (score >= 80) {
              // High score instruction
              scoreBasedInstructions = `
                Provide positive reinforcement highlighting what they understood well. 
                Then offer one additional insight about the topic that adds depth.
                Ask if they would like another question about the podcast.
              `
            } else if (score >= 50) {
              // Medium score instruction
              scoreBasedInstructions = `
                Acknowledge what they got right, then respectfully clarify misunderstandings. 
                Explain the concept in a clear, educational way.
                Ask if they want to try another question on a different aspect of the podcast.
              `
            } else {
              // Low score instruction
              scoreBasedInstructions = `
                Offer encouraging correction without being condescending. 
                Explain the topic in a simple, straightforward way before asking 
                if they'd like to try another question.
              `
            }
          }
        } catch (e) {
          console.error('Error parsing function arguments for score', e)
          // Default instruction if parsing fails
          scoreBasedInstructions = `
            Explain this answer in detail. Compare the user's answer with the correct answer,
            highlighting key points. Be encouraging and educational.
            Ask if they would like another question about the podcast.
          `
        }

        this.sendClientEvent({
          type: 'response.create',
          response: {
            instructions: scoreBasedInstructions
          }
        })
      }
    },

    sendClientEvent(message) {
      if (this.dataChannel?.readyState === 'open') {
        // Store the formatted event for display
        this.events.push({
          direction: '➡️ SENT',
          timestamp: new Date(),
          data: message
        })

        // Also store the raw event for processing
        this.events.unshift(message)

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
        this.functionAdded = false
        this.functionCallOutput = null
        this.resetPodcastAssessment()
        this.transcript = ''
        this.responseText = ''
        // Keep quiz history intact for the session
        this.$toast.success('Podcast quiz session ended', { position: 'bottom-center', timeout: 3000 })
      }
    },

    formatTimestamp(timestamp) {
      if (!timestamp) return ''
      return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    },

    formatEventData(data) {
      // Truncate large arrays for display
      const sanitizedData = JSON.parse(JSON.stringify(data))
      if (sanitizedData.audio_buffer && sanitizedData.audio_buffer.length > 100) {
        sanitizedData.audio_buffer = `[Array(${sanitizedData.audio_buffer.length}) truncated]`
      }
      return JSON.stringify(sanitizedData, null, 2)
    },

    requestPodcastQuiz() {
      if (!this.isSessionActive || !this.dataChannel?.readyState === 'open') {
        this.$toast.error('Session not active or connection not established', { position: 'bottom-center' })
        return
      }

      if (!this.hasEpisodeData) {
        this.$toast.error('Cannot start quiz: No episode data available.', { position: 'bottom-center' })
        return
      }

      // Clear any previous assessment
      this.resetPodcastAssessment()

      // Get episode data
      const title = this.episodeData.title || 'Untitled Episode'
      const podcastName = this.episodeData.podcastTitle || this.episodeData.author || ''
      const summary = this.episodeData.summary || ''

      // Construct the prompt
      let promptText = `I would like to test my knowledge about the podcast episode "${title}" I just listened to. Please ask me ONE clear question about an important concept or insight from this episode.`

      // Add episode information as context for the LLM
      let episodeContext = `\n\nEpisode Information:\nTitle: ${title}\n`
      if (podcastName) episodeContext += `Podcast: ${podcastName}\n`
      episodeContext += `Summary: ${summary}\n`

      // Add instructions for the function call
      promptText += episodeContext + '\n\nAfter I respond, use the assess_podcast_knowledge function to evaluate my answer. Focus on meaningful concepts rather than trivial details.'

      // Send a prompt to request a podcast knowledge quiz
      this.sendClientEvent({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: promptText
            }
          ]
        }
      })

      this.$toast.info('Podcast knowledge test started', { position: 'bottom-center', timeout: 2000 })
    },

    resetPodcastAssessment() {
      this.functionCallOutput = null
      this.podcastQuestionData = {
        question: '',
        correctAnswer: '',
        userAnswer: '',
        score: 0
      }
      // Note: We don't clear quizHistory here to maintain history
    },

    // Navigation methods for quiz history
    prevQuestion() {
      if (this.currentQuizIndex > 0) {
        this.currentQuizIndex--
      }
    },

    nextQuestion() {
      if (this.currentQuizIndex < this.quizHistory.length - 1) {
        this.currentQuizIndex++
      }
    },

    // Helper method to determine score color class
    scoreClass(score) {
      if (score >= 80) return 'bg-green-600'
      if (score >= 50) return 'bg-yellow-600'
      return 'bg-red-600'
    }
  },
  beforeDestroy() {
    if (this.isSessionActive) {
      this.stopSession()
    }
  }
}
</script>

<style scoped>
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