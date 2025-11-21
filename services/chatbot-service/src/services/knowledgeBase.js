/**
 * Knowledge Base Service
 * Manages campaign data, donation information, and FAQ knowledge for the chatbot
 */

const axios = require('axios');
const { pool, logger } = require('@careforall/shared');

class KnowledgeBase {
  constructor() {
    // Service URLs from environment
    this.queryServiceUrl = process.env.QUERY_SERVICE_URL || 'http://query-service:3005';
    this.campaignServiceUrl = process.env.CAMPAIGN_SERVICE_URL || 'http://campaign-service:3002';
    this.authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

    // Cache for frequently accessed data
    this.cache = {
      campaigns: null,
      campaignsUpdatedAt: null,
      cacheDuration: 300000 // 5 minutes
    };

    // FAQ data
    this.faqs = {
      en: [
        {
          question: 'How do I create a campaign?',
          answer: 'To create a campaign, you need to be logged in. Then go to the Campaigns page and click "Create Campaign". Fill in the details like title, description, goal amount, and deadline.'
        },
        {
          question: 'What payment methods are supported?',
          answer: 'We support bKash, Nagad, Rocket, and all major credit/debit cards through SSLCommerz payment gateway.'
        },
        {
          question: 'How long does it take to process a donation?',
          answer: 'Donations are processed instantly. You will receive a confirmation email once the payment is successful.'
        },
        {
          question: 'Can I get a refund?',
          answer: 'Refunds can be requested within 7 days of the donation. Please contact our support team with your transaction ID.'
        },
        {
          question: 'Is my donation secure?',
          answer: 'Yes! All donations are processed through SSLCommerz, a certified payment gateway. Your payment information is encrypted and secure.'
        }
      ],
      bn: [
        {
          question: 'আমি কীভাবে একটি ক্যাম্পেইন তৈরি করব?',
          answer: 'ক্যাম্পেইন তৈরি করতে আপনাকে প্রথমে লগইন করতে হবে। তারপর ক্যাম্পেইন পেজে যান এবং "ক্যাম্পেইন তৈরি করুন" এ ক্লিক করুন। শিরোনাম, বিবরণ, লক্ষ্যমাত্রা এবং শেষ তারিখের মতো বিবরণ পূরণ করুন।'
        },
        {
          question: 'কোন পেমেন্ট পদ্ধতি সমর্থিত?',
          answer: 'আমরা bKash, Nagad, Rocket এবং SSLCommerz পেমেন্ট গেটওয়ের মাধ্যমে সকল প্রধান ক্রেডিট/ডেবিট কার্ড সমর্থন করি।'
        },
        {
          question: 'দান প্রক্রিয়া করতে কতক্ষণ লাগে?',
          answer: 'দান তাৎক্ষণিকভাবে প্রক্রিয়া করা হয়। পেমেন্ট সফল হলে আপনি একটি নিশ্চিতকরণ ইমেল পাবেন।'
        },
        {
          question: 'আমি কি রিফান্ড পেতে পারি?',
          answer: 'দানের ৭ দিনের মধ্যে রিফান্ডের অনুরোধ করা যেতে পারে। আপনার লেনদেন আইডি সহ আমাদের সহায়তা দলের সাথে যোগাযোগ করুন।'
        },
        {
          question: 'আমার দান কি নিরাপদ?',
          answer: 'হ্যাঁ! সমস্ত দান SSLCommerz-এর মাধ্যমে প্রক্রিয়া করা হয়, যা একটি সার্টিফাইড পেমেন্ট গেটওয়ে। আপনার পেমেন্ট তথ্য এনক্রিপ্ট করা এবং সুরক্ষিত।'
        }
      ]
    };
  }

  /**
   * Get all active campaigns
   * @param {boolean} forceRefresh - Force refresh cache
   * @returns {Promise<Array>} - Array of campaigns
   */
  async getActiveCampaigns(forceRefresh = false) {
    try {
      // Check cache
      if (!forceRefresh && this.cache.campaigns && this.cache.campaignsUpdatedAt) {
        const cacheAge = Date.now() - this.cache.campaignsUpdatedAt;
        if (cacheAge < this.cache.cacheDuration) {
          logger.info('Returning campaigns from cache');
          return this.cache.campaigns;
        }
      }

      // Fetch from Query Service (optimized for reads)
      logger.info('Fetching campaigns from Query Service');
      const response = await axios.get(`${this.queryServiceUrl}/api/query/campaigns`, {
        params: { status: 'active' },
        timeout: 5000
      });

      const campaigns = response.data.data || [];

      // Update cache
      this.cache.campaigns = campaigns;
      this.cache.campaignsUpdatedAt = Date.now();

      return campaigns;
    } catch (error) {
      logger.error('Error fetching active campaigns:', error);

      // Return cached data if available
      if (this.cache.campaigns) {
        logger.warn('Returning stale cache due to error');
        return this.cache.campaigns;
      }

      return [];
    }
  }

  /**
   * Get campaign by ID
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<object|null>} - Campaign object
   */
  async getCampaignById(campaignId) {
    try {
      logger.info(`Fetching campaign ${campaignId}`);
      const response = await axios.get(
        `${this.queryServiceUrl}/api/query/campaigns/${campaignId}`,
        { timeout: 5000 }
      );

      return response.data.data || null;
    } catch (error) {
      logger.error(`Error fetching campaign ${campaignId}:`, error);
      return null;
    }
  }

  /**
   * Search campaigns by keyword
   * @param {string} keyword - Search keyword
   * @param {string} language - Language code
   * @returns {Promise<Array>} - Array of matching campaigns
   */
  async searchCampaigns(keyword, language = 'en') {
    try {
      const campaigns = await this.getActiveCampaigns();

      if (!keyword) {
        return campaigns.slice(0, 5); // Return top 5
      }

      const searchTerm = keyword.toLowerCase();

      // Filter campaigns by keyword
      const matches = campaigns.filter(campaign => {
        const title = (campaign.name || campaign.title || '').toLowerCase();
        const description = (campaign.description || '').toLowerCase();

        return title.includes(searchTerm) || description.includes(searchTerm);
      });

      return matches.slice(0, 5); // Return top 5 matches
    } catch (error) {
      logger.error('Error searching campaigns:', error);
      return [];
    }
  }

  /**
   * Get campaign statistics
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<object|null>} - Campaign stats
   */
  async getCampaignStats(campaignId) {
    try {
      const response = await axios.get(
        `${this.queryServiceUrl}/api/query/campaigns/${campaignId}/totals`,
        { timeout: 5000 }
      );

      return response.data.data || null;
    } catch (error) {
      logger.error(`Error fetching campaign stats for ${campaignId}:`, error);
      return null;
    }
  }

  /**
   * Get recent donations for a campaign
   * @param {string} campaignId - Campaign ID
   * @param {number} limit - Number of donations to retrieve
   * @returns {Promise<Array>} - Array of donations
   */
  async getRecentDonations(campaignId, limit = 5) {
    try {
      const response = await axios.get(
        `${this.queryServiceUrl}/api/query/campaigns/${campaignId}/donations`,
        {
          params: { limit },
          timeout: 5000
        }
      );

      return response.data.data || [];
    } catch (error) {
      logger.error(`Error fetching donations for ${campaignId}:`, error);
      return [];
    }
  }

  /**
   * Get FAQ answer
   * @param {string} question - User question
   * @param {string} language - Language code
   * @returns {object|null} - FAQ object or null
   */
  getFAQAnswer(question, language = 'en') {
    const questionLower = question.toLowerCase();
    const faqList = this.faqs[language] || this.faqs.en;

    // Simple keyword matching
    for (const faq of faqList) {
      const faqQuestion = faq.question.toLowerCase();

      // Check if questions are similar (contains key words)
      const questionWords = questionLower.split(/\s+/).filter(w => w.length > 3);
      const faqWords = faqQuestion.split(/\s+/).filter(w => w.length > 3);

      const matchCount = questionWords.filter(word =>
        faqWords.some(faqWord => faqWord.includes(word) || word.includes(faqWord))
      ).length;

      // If at least 2 words match, consider it a match
      if (matchCount >= 2) {
        return faq;
      }
    }

    return null;
  }

  /**
   * Update knowledge base from campaign event
   * @param {object} campaignData - Campaign data from event
   * @returns {Promise<void>}
   */
  async updateCampaignKnowledge(campaignData) {
    try {
      const { id, name, description, goal, raised, language } = campaignData;

      const query = `
        INSERT INTO chatbot.knowledge_base (id, campaign_id, key, value, language, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (campaign_id, key, language)
        DO UPDATE SET value = $4, updated_at = $6
      `;

      // Store campaign summary
      const summary = `Campaign: ${name}\nGoal: ${goal}\nRaised: ${raised || 0}\nDescription: ${description}`;

      await pool.query(query, [
        require('uuid').v4(),
        id,
        'campaign_summary',
        summary,
        language || 'en',
        new Date()
      ]);

      // Invalidate cache to force refresh
      this.cache.campaigns = null;
      this.cache.campaignsUpdatedAt = null;

      logger.info(`Updated knowledge base for campaign ${id}`);
    } catch (error) {
      logger.error('Error updating campaign knowledge:', error);
    }
  }

  /**
   * Get knowledge base entry
   * @param {string} campaignId - Campaign ID
   * @param {string} key - Knowledge key
   * @param {string} language - Language code
   * @returns {Promise<string|null>} - Knowledge value
   */
  async getKnowledge(campaignId, key, language = 'en') {
    try {
      const query = `
        SELECT value FROM chatbot.knowledge_base
        WHERE campaign_id = $1 AND key = $2 AND language = $3
        ORDER BY updated_at DESC
        LIMIT 1
      `;

      const result = await pool.query(query, [campaignId, key, language]);

      if (result.rows.length > 0) {
        return result.rows[0].value;
      }

      return null;
    } catch (error) {
      logger.error('Error fetching knowledge:', error);
      return null;
    }
  }

  /**
   * Get general platform statistics
   * @returns {Promise<object>} - Platform stats
   */
  async getPlatformStats() {
    try {
      const campaigns = await this.getActiveCampaigns();

      const totalCampaigns = campaigns.length;
      const totalGoal = campaigns.reduce((sum, c) => sum + (parseFloat(c.goal) || 0), 0);
      const totalRaised = campaigns.reduce((sum, c) => sum + (parseFloat(c.raised || c.current_amount) || 0), 0);

      return {
        totalCampaigns,
        totalGoal,
        totalRaised,
        successRate: totalGoal > 0 ? ((totalRaised / totalGoal) * 100).toFixed(2) : 0
      };
    } catch (error) {
      logger.error('Error fetching platform stats:', error);
      return {
        totalCampaigns: 0,
        totalGoal: 0,
        totalRaised: 0,
        successRate: 0
      };
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache = {
      campaigns: null,
      campaignsUpdatedAt: null,
      cacheDuration: 300000
    };
  }
}

module.exports = new KnowledgeBase();
