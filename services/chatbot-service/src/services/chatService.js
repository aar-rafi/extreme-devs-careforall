/**
 * Main Chat Service
 * Orchestrates conversation flow, intent detection, and response generation
 */

const banglaProcessor = require('../utils/banglaProcessor');
const conversationManager = require('./conversationManager');
const knowledgeBase = require('./knowledgeBase');
const { logger } = require('@careforall/shared');

class ChatService {
  constructor() {
    this.defaultLanguage = 'en';
  }

  /**
   * Process user message and generate response
   * @param {object} params - Message parameters
   * @returns {Promise<object>} - Response object
   */
  async processMessage({ conversationId, message, userId = null, language = null }) {
    try {
      // Detect language if not provided
      const detectedLanguage = language || banglaProcessor.detectLanguage(message);

      // Get or create conversation
      let conversation;
      if (conversationId) {
        conversation = await conversationManager.getConversation(conversationId);

        if (!conversation) {
          logger.warn(`Conversation ${conversationId} not found, creating new one`);
          conversation = await conversationManager.createConversation(userId, detectedLanguage);
        }
      } else {
        conversation = await conversationManager.createConversation(userId, detectedLanguage);
      }

      // Update language preference if detected language is different
      if (detectedLanguage !== conversation.language) {
        await conversationManager.updateLanguage(conversation.id, detectedLanguage);
        conversation.language = detectedLanguage;
      }

      // Extract intent from message
      const intent = banglaProcessor.extractIntent(message);
      logger.info(`Detected intent: ${intent.type} (confidence: ${intent.confidence})`);

      // Generate response based on intent
      const responseData = await this.generateResponse(intent, message, conversation);

      // Save message to conversation
      await conversationManager.saveMessage(
        conversation.id,
        'user',
        message,
        responseData.response,
        {
          language: detectedLanguage,
          confidence: intent.confidence,
          intent: intent.type
        }
      );

      return {
        conversationId: conversation.id,
        response: responseData.response,
        language: detectedLanguage,
        intent: intent.type,
        confidence: intent.confidence,
        metadata: responseData.metadata || {}
      };
    } catch (error) {
      logger.error('Error processing message:', error);
      throw error;
    }
  }

  /**
   * Generate response based on intent
   * @param {object} intent - Intent object
   * @param {string} message - User message
   * @param {object} conversation - Conversation object
   * @returns {Promise<object>} - Response data
   */
  async generateResponse(intent, message, conversation) {
    const language = conversation.language || 'en';

    switch (intent.type) {
      case 'greeting':
        return this.handleGreeting(language);

      case 'help':
        return this.handleHelp(language);

      case 'campaign_list':
        return await this.handleCampaignList(language);

      case 'campaign_info':
        return await this.handleCampaignInfo(message, language);

      case 'donation_query':
      case 'donation_help':
        return this.handleDonationHelp(language);

      case 'payment_query':
        return this.handlePaymentQuery(language);

      case 'thanks':
        return this.handleThanks(language);

      case 'unknown':
      default:
        return await this.handleUnknown(message, language);
    }
  }

  /**
   * Handle greeting intent
   */
  handleGreeting(language) {
    const response = language === 'bn'
      ? banglaProcessor.generateBanglaResponse('greeting')
      : 'Hello! I\'m the CareForAll chatbot. How can I help you today?';

    return { response, metadata: { intent: 'greeting' } };
  }

  /**
   * Handle help intent
   */
  handleHelp(language) {
    const response = language === 'bn'
      ? banglaProcessor.generateBanglaResponse('help')
      : `I can help you with:\n- Finding campaigns\n- Donation information\n- Creating campaigns\n- Payment support\n\nWhat would you like to know?`;

    return { response, metadata: { intent: 'help' } };
  }

  /**
   * Handle campaign list request
   */
  async handleCampaignList(language) {
    try {
      const campaigns = await knowledgeBase.getActiveCampaigns();

      if (campaigns.length === 0) {
        const response = language === 'bn'
          ? 'দুঃখিত, বর্তমানে কোন সক্রিয় ক্যাম্পেইন নেই।'
          : 'Sorry, there are no active campaigns at the moment.';

        return { response, metadata: { intent: 'campaign_list', count: 0 } };
      }

      const response = language === 'bn'
        ? banglaProcessor.generateBanglaResponse('campaign_list', { campaigns })
        : this.formatCampaignListEnglish(campaigns);

      return {
        response,
        metadata: {
          intent: 'campaign_list',
          count: campaigns.length,
          campaigns: campaigns.slice(0, 5).map(c => ({ id: c.id, name: c.name || c.title }))
        }
      };
    } catch (error) {
      logger.error('Error fetching campaign list:', error);
      const response = language === 'bn'
        ? 'দুঃখিত, ক্যাম্পেইন তালিকা লোড করতে সমস্যা হচ্ছে। একটু পরে চেষ্টা করুন।'
        : 'Sorry, I\'m having trouble loading the campaign list. Please try again later.';

      return { response, metadata: { intent: 'campaign_list', error: true } };
    }
  }

  /**
   * Handle campaign info request
   */
  async handleCampaignInfo(message, language) {
    try {
      // Try to extract campaign identifier
      const identifier = banglaProcessor.extractCampaignIdentifier(message);

      if (identifier) {
        // Try to get specific campaign
        const campaign = await knowledgeBase.getCampaignById(identifier);

        if (campaign) {
          const response = language === 'bn'
            ? banglaProcessor.generateBanglaResponse('campaignInfo', { campaign })
            : this.formatCampaignInfoEnglish(campaign);

          return {
            response,
            metadata: {
              intent: 'campaign_info',
              campaignId: campaign.id,
              campaignName: campaign.name || campaign.title
            }
          };
        }
      }

      // If no specific campaign found, search by keyword
      const campaigns = await knowledgeBase.searchCampaigns(message, language);

      if (campaigns.length > 0) {
        const response = language === 'bn'
          ? `আমি ${banglaProcessor.toBanglaNumber(campaigns.length)}টি ক্যাম্পেইন খুঁজে পেয়েছি:\n\n` +
            campaigns.map((c, i) => `${i + 1}. ${c.name || c.title}`).join('\n') +
            '\n\nআপনি কোনটি সম্পর্কে জানতে চান?'
          : `I found ${campaigns.length} campaign(s):\n\n` +
            campaigns.map((c, i) => `${i + 1}. ${c.name || c.title}`).join('\n') +
            '\n\nWhich one would you like to know more about?';

        return {
          response,
          metadata: {
            intent: 'campaign_info',
            matches: campaigns.map(c => ({ id: c.id, name: c.name || c.title }))
          }
        };
      }

      // No campaigns found
      const response = language === 'bn'
        ? 'দুঃখিত, আমি সেই ক্যাম্পেইন খুঁজে পাইনি। আপনি কি সব ক্যাম্পেইন দেখতে চান?'
        : 'Sorry, I couldn\'t find that campaign. Would you like to see all active campaigns?';

      return { response, metadata: { intent: 'campaign_info', found: false } };
    } catch (error) {
      logger.error('Error fetching campaign info:', error);
      const response = language === 'bn'
        ? 'দুঃখিত, ক্যাম্পেইন তথ্য লোড করতে সমস্যা হচ্ছে।'
        : 'Sorry, I\'m having trouble loading campaign information.';

      return { response, metadata: { intent: 'campaign_info', error: true } };
    }
  }

  /**
   * Handle donation help request
   */
  handleDonationHelp(language) {
    const response = language === 'bn'
      ? banglaProcessor.generateBanglaResponse('donation_help')
      : `How to donate:\n\n1️⃣ Select a campaign\n2️⃣ Click "Donate" button\n3️⃣ Enter amount and your information\n4️⃣ Choose payment method (bKash, Nagad, Rocket, or Card)\n5️⃣ Complete the payment\n\nYou can donate any amount!`;

    return { response, metadata: { intent: 'donation_help' } };
  }

  /**
   * Handle payment query
   */
  handlePaymentQuery(language) {
    const response = language === 'bn'
      ? `পেমেন্ট সম্পর্কিত তথ্য:\n\n✅ সমর্থিত পদ্ধতি: bKash, Nagad, Rocket, কার্ড\n✅ নিরাপদ SSLCommerz পেমেন্ট\n✅ তাৎক্ষণিক নিশ্চিতকরণ\n✅ ৭ দিনের মধ্যে রিফান্ড সম্ভব\n\nআপনার কোন নির্দিষ্ট প্রশ্ন আছে?`
      : `Payment Information:\n\n✅ Supported methods: bKash, Nagad, Rocket, Cards\n✅ Secure SSLCommerz payment\n✅ Instant confirmation\n✅ Refund available within 7 days\n\nDo you have any specific questions?`;

    return { response, metadata: { intent: 'payment_query' } };
  }

  /**
   * Handle thanks
   */
  handleThanks(language) {
    const response = language === 'bn'
      ? banglaProcessor.generateBanglaResponse('thanks')
      : 'You\'re welcome! Happy to help. Is there anything else?';

    return { response, metadata: { intent: 'thanks' } };
  }

  /**
   * Handle unknown intent (try FAQ or general response)
   */
  async handleUnknown(message, language) {
    // Try FAQ matching
    const faq = knowledgeBase.getFAQAnswer(message, language);

    if (faq) {
      return {
        response: `${faq.question}\n\n${faq.answer}`,
        metadata: { intent: 'faq', matched: true }
      };
    }

    // If asking about campaigns in general, show list
    if (banglaProcessor.isAskingForCampaigns(message)) {
      return await this.handleCampaignList(language);
    }

    // Default unknown response
    const response = language === 'bn'
      ? banglaProcessor.generateBanglaResponse('notFound')
      : 'I\'m not sure I understand. Could you rephrase that? You can ask me about:\n- Active campaigns\n- How to donate\n- Payment methods\n- Creating a campaign';

    return { response, metadata: { intent: 'unknown' } };
  }

  /**
   * Format campaign list in English
   */
  formatCampaignListEnglish(campaigns) {
    let response = `We currently have ${campaigns.length} active campaign(s):\n\n`;

    campaigns.slice(0, 5).forEach((campaign, index) => {
      const name = campaign.name || campaign.title || 'Untitled';
      const goal = campaign.goal || 0;
      response += `${index + 1}. ${name}\n   Goal: ৳${this.formatNumber(goal)}\n\n`;
    });

    return response.trim();
  }

  /**
   * Format campaign info in English
   */
  formatCampaignInfoEnglish(campaign) {
    const name = campaign.name || campaign.title || 'Untitled';
    const goal = campaign.goal || 0;
    const raised = campaign.raised || campaign.current_amount || 0;
    const deadline = campaign.deadline || campaign.end_date;

    let response = `Campaign Information:\n\n`;
    response += `📋 Name: ${name}\n`;
    response += `💰 Goal: ৳${this.formatNumber(goal)}\n`;
    response += `✅ Raised: ৳${this.formatNumber(raised)}\n`;

    if (deadline) {
      response += `📅 Deadline: ${new Date(deadline).toLocaleDateString()}\n`;
    }

    if (campaign.description) {
      response += `\n${campaign.description.substring(0, 200)}${campaign.description.length > 200 ? '...' : ''}`;
    }

    return response;
  }

  /**
   * Format number with commas
   */
  formatNumber(num) {
    return new Intl.NumberFormat('en-IN').format(num);
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(conversationId, limit = 10) {
    return await conversationManager.getConversationHistory(conversationId, limit);
  }

  /**
   * Get user conversations
   */
  async getUserConversations(userId, limit = 10) {
    return await conversationManager.getUserConversations(userId, limit);
  }
}

module.exports = new ChatService();
