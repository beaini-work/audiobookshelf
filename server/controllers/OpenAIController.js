const axios = require('axios')
const Logger = require('../Logger')

class OpenAIController {
  /**
   * Generate a token for the OpenAI Realtime Voice API
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async generateToken(req, res) {
    try {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        return res.status(500).json({ error: 'OPENAI_API_KEY not configured' })
      }

      const response = await axios.post(
        "https://api.openai.com/v1/realtime/sessions",
        {
          model: "gpt-4o-realtime-preview-2024-12-17",
          voice: "verse",
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      )

      res.json(response.data)
    } catch (error) {
      Logger.error("[OpenAIController] Token generation error:", error.response?.data || error.message)
      res.status(500).json({ error: "Failed to generate token" })
    }
  }
}

module.exports = OpenAIController 