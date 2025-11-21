/**
 * Chat Controller
 * Handles HTTP requests for chat operations
 */

const chatService = require('../services/chatService');
const { successResponse, errorResponse } = require('@careforall/shared');
const { logger } = require('@careforall/shared');

class ChatController {
  /**
   * Send a chat message
   * POST /api/chat/messages
   */
  async sendMessage(req, res) {
    try {
      const { conversationId, message, language } = req.body;
      const userId = req.user?.id || null; // Optional user ID from auth middleware

      if (!message || message.trim() === '') {
        return errorResponse(res, 'Message is required', 400);
      }

      logger.info(`Processing message from ${userId || 'anonymous'}`);

      const result = await chatService.processMessage({
        conversationId,
        message: message.trim(),
        userId,
        language
      });

      return successResponse(
        res,
        result,
        'Message processed successfully',
        200
      );
    } catch (error) {
      logger.error('Error in sendMessage:', error);
      return errorResponse(res, 'Failed to process message', 500);
    }
  }

  /**
   * Get conversation history
   * GET /api/chat/conversations/:id
   */
  async getConversation(req, res) {
    try {
      const { id } = req.params;
      const { limit = 50 } = req.query;

      const history = await chatService.getConversationHistory(id, parseInt(limit));

      if (!history || history.length === 0) {
        return errorResponse(res, 'Conversation not found', 404);
      }

      return successResponse(
        res,
        { conversationId: id, messages: history },
        'Conversation retrieved successfully',
        200
      );
    } catch (error) {
      logger.error('Error in getConversation:', error);
      return errorResponse(res, 'Failed to retrieve conversation', 500);
    }
  }

  /**
   * Get user's conversations
   * GET /api/chat/conversations
   */
  async getUserConversations(req, res) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return errorResponse(res, 'Authentication required', 401);
      }

      const { limit = 10 } = req.query;

      const conversations = await chatService.getUserConversations(userId, parseInt(limit));

      return successResponse(
        res,
        { conversations },
        'Conversations retrieved successfully',
        200
      );
    } catch (error) {
      logger.error('Error in getUserConversations:', error);
      return errorResponse(res, 'Failed to retrieve conversations', 500);
    }
  }

  /**
   * Create a new conversation
   * POST /api/chat/conversations
   */
  async createConversation(req, res) {
    try {
      const { language = 'en' } = req.body;
      const userId = req.user?.id || null;

      const conversationManager = require('../services/conversationManager');
      const conversation = await conversationManager.createConversation(userId, language);

      return successResponse(
        res,
        { conversation },
        'Conversation created successfully',
        201
      );
    } catch (error) {
      logger.error('Error in createConversation:', error);
      return errorResponse(res, 'Failed to create conversation', 500);
    }
  }

  /**
   * Health check
   * GET /api/chat/health
   */
  async healthCheck(req, res) {
    try {
      const knowledgeBase = require('../services/knowledgeBase');

      // Quick health checks
      const campaignsAvailable = await knowledgeBase.getActiveCampaigns();

      return successResponse(
        res,
        {
          status: 'healthy',
          service: 'chatbot-service',
          timestamp: new Date().toISOString(),
          features: {
            banglaSupport: true,
            knowledgeBase: campaignsAvailable.length > 0,
            conversationManagement: true
          }
        },
        'Service is healthy',
        200
      );
    } catch (error) {
      logger.error('Error in healthCheck:', error);
      return errorResponse(res, 'Service unhealthy', 503);
    }
  }
}

module.exports = new ChatController();
