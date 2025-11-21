/**
 * Conversation Manager
 * Handles conversation history, context management, and message storage
 */

const { v4: uuidv4 } = require('uuid');
const { pool } = require('@careforall/shared');

class ConversationManager {
  constructor() {
    this.conversations = new Map(); // In-memory cache for active conversations
    this.maxConversationAge = 3600000; // 1 hour in milliseconds
  }

  /**
   * Create a new conversation
   * @param {string} userId - User ID (optional for anonymous users)
   * @param {string} language - Preferred language ('en' or 'bn')
   * @returns {Promise<object>} - Conversation object
   */
  async createConversation(userId = null, language = 'en') {
    const conversationId = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO chatbot.conversations (id, user_id, language, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [conversationId, userId, language, now, now]);
      const conversation = result.rows[0];

      // Cache in memory
      this.conversations.set(conversationId, {
        ...conversation,
        messages: []
      });

      return conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation by ID
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<object|null>} - Conversation object with messages
   */
  async getConversation(conversationId) {
    // Check cache first
    if (this.conversations.has(conversationId)) {
      const cached = this.conversations.get(conversationId);

      // Check if cache is still valid
      const age = Date.now() - new Date(cached.updated_at).getTime();
      if (age < this.maxConversationAge) {
        return cached;
      }

      // Cache expired, remove it
      this.conversations.delete(conversationId);
    }

    // Fetch from database
    try {
      const convQuery = `
        SELECT * FROM chatbot.conversations WHERE id = $1
      `;
      const convResult = await pool.query(convQuery, [conversationId]);

      if (convResult.rows.length === 0) {
        return null;
      }

      const conversation = convResult.rows[0];

      // Fetch messages
      const msgQuery = `
        SELECT * FROM chatbot.messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
      `;
      const msgResult = await pool.query(msgQuery, [conversationId]);

      conversation.messages = msgResult.rows;

      // Update cache
      this.conversations.set(conversationId, conversation);

      return conversation;
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw error;
    }
  }

  /**
   * Save a message to conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} sender - 'user' or 'bot'
   * @param {string} messageText - Message content
   * @param {string} responseText - Response content (for user messages)
   * @param {object} metadata - Additional metadata
   * @returns {Promise<object>} - Saved message
   */
  async saveMessage(conversationId, sender, messageText, responseText = null, metadata = {}) {
    const messageId = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO chatbot.messages
      (id, conversation_id, sender, message_text, response_text, language, confidence, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [
        messageId,
        conversationId,
        sender,
        messageText,
        responseText,
        metadata.language || 'en',
        metadata.confidence || null,
        JSON.stringify(metadata),
        now
      ]);

      const message = result.rows[0];

      // Update conversation updated_at
      await pool.query(
        'UPDATE chatbot.conversations SET updated_at = $1 WHERE id = $2',
        [now, conversationId]
      );

      // Update cache
      if (this.conversations.has(conversationId)) {
        const cached = this.conversations.get(conversationId);
        cached.messages.push(message);
        cached.updated_at = now;
      }

      return message;
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  }

  /**
   * Get conversation history (last N messages)
   * @param {string} conversationId - Conversation ID
   * @param {number} limit - Number of messages to retrieve
   * @returns {Promise<Array>} - Array of messages
   */
  async getConversationHistory(conversationId, limit = 10) {
    try {
      const query = `
        SELECT * FROM chatbot.messages
        WHERE conversation_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [conversationId, limit]);
      return result.rows.reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error fetching conversation history:', error);
      throw error;
    }
  }

  /**
   * Get conversation context (recent messages formatted for AI)
   * @param {string} conversationId - Conversation ID
   * @param {number} contextWindow - Number of previous exchanges to include
   * @returns {Promise<string>} - Formatted context string
   */
  async getConversationContext(conversationId, contextWindow = 3) {
    const messages = await this.getConversationHistory(conversationId, contextWindow * 2);

    if (messages.length === 0) {
      return '';
    }

    let context = 'Previous conversation:\n';
    messages.forEach(msg => {
      if (msg.sender === 'user') {
        context += `User: ${msg.message_text}\n`;
        if (msg.response_text) {
          context += `Bot: ${msg.response_text}\n`;
        }
      }
    });

    return context;
  }

  /**
   * Delete old conversations (cleanup)
   * @param {number} olderThanHours - Delete conversations older than this many hours
   * @returns {Promise<number>} - Number of deleted conversations
   */
  async cleanupOldConversations(olderThanHours = 24) {
    try {
      const cutoffTime = new Date(Date.now() - (olderThanHours * 3600000));

      // First delete associated messages
      await pool.query(
        'DELETE FROM chatbot.messages WHERE conversation_id IN (SELECT id FROM chatbot.conversations WHERE updated_at < $1)',
        [cutoffTime]
      );

      // Then delete conversations
      const result = await pool.query(
        'DELETE FROM chatbot.conversations WHERE updated_at < $1',
        [cutoffTime]
      );

      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up old conversations:', error);
      throw error;
    }
  }

  /**
   * Get user's recent conversations
   * @param {string} userId - User ID
   * @param {number} limit - Number of conversations to retrieve
   * @returns {Promise<Array>} - Array of conversations
   */
  async getUserConversations(userId, limit = 10) {
    try {
      const query = `
        SELECT c.*,
               COUNT(m.id) as message_count,
               MAX(m.created_at) as last_message_at
        FROM chatbot.conversations c
        LEFT JOIN chatbot.messages m ON c.id = m.conversation_id
        WHERE c.user_id = $1
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching user conversations:', error);
      throw error;
    }
  }

  /**
   * Update conversation language preference
   * @param {string} conversationId - Conversation ID
   * @param {string} language - Language code
   * @returns {Promise<boolean>} - Success status
   */
  async updateLanguage(conversationId, language) {
    try {
      await pool.query(
        'UPDATE chatbot.conversations SET language = $1, updated_at = $2 WHERE id = $3',
        [language, new Date(), conversationId]
      );

      // Update cache
      if (this.conversations.has(conversationId)) {
        const cached = this.conversations.get(conversationId);
        cached.language = language;
      }

      return true;
    } catch (error) {
      console.error('Error updating conversation language:', error);
      throw error;
    }
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache() {
    this.conversations.clear();
  }
}

module.exports = new ConversationManager();
