const express = require('express');
const OpenAIController = require('../controllers/OpenAIController');

const router = express.Router();

/**
 * @api {get} /api/openai/token Generate OpenAI Realtime Voice API token
 * @apiDescription Generate a token for OpenAI Realtime Voice API
 * @apiName GenerateOpenAIToken
 * @apiGroup OpenAI
 * @apiPermission user
 * 
 * @apiSuccess {Object} token Token object for OpenAI Realtime Voice API
 */
router.get('/token', OpenAIController.generateToken);

module.exports = router; 