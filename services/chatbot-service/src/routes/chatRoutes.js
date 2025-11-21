/**
 * Chat Routes
 * Defines API endpoints for chatbot service
 */

const express = require('express');
const router = express.Router();

const chatController = require('../controllers/chatController');
const optionalAuth = require('../middleware/optionalAuth');
const {
  validate,
  sendMessageSchema,
  getConversationSchema,
  getUserConversationsSchema,
  createConversationSchema
} = require('../validators/chatValidators');

// Health check (public)
router.get('/health', chatController.healthCheck.bind(chatController));

// Send message (optional auth - supports anonymous)
router.post(
  '/messages',
  optionalAuth,
  validate(sendMessageSchema, 'body'),
  chatController.sendMessage.bind(chatController)
);

// Create new conversation (optional auth)
router.post(
  '/conversations',
  optionalAuth,
  validate(createConversationSchema, 'body'),
  chatController.createConversation.bind(chatController)
);

// Get conversation history (optional auth)
router.get(
  '/conversations/:id',
  optionalAuth,
  validate(getConversationSchema, 'params'),
  validate(getUserConversationsSchema, 'query'),
  chatController.getConversation.bind(chatController)
);

// Get user's conversations (requires auth)
router.get(
  '/conversations',
  optionalAuth,
  validate(getUserConversationsSchema, 'query'),
  chatController.getUserConversations.bind(chatController)
);

module.exports = router;
