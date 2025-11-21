/**
 * Bangla Language Processing Utilities
 * Provides text processing, normalization, and translation support for Bangla language
 */

class BanglaProcessor {
  constructor() {
    // Common Bangla greetings and their English equivalents
    this.greetings = {
      'হ্যালো': 'hello',
      'হ্যাল': 'hello',
      'হাই': 'hi',
      'আসসালামু আলাইকুম': 'hello',
      'সুপ্রভাত': 'good morning',
      'শুভ সকাল': 'good morning',
      'শুভ সন্ধ্যা': 'good evening',
      'শুভ রাত্রি': 'good night',
      'নমস্কার': 'hello',
      'প্রণাম': 'hello'
    };

    // Common question words in Bangla
    this.questionWords = {
      'কি': 'what',
      'কী': 'what',
      'কিভাবে': 'how',
      'কেমন': 'how',
      'কোথায়': 'where',
      'কখন': 'when',
      'কেন': 'why',
      'কে': 'who',
      'কাকে': 'whom',
      'কোনটি': 'which',
      'কত': 'how much',
      'কতটা': 'how much'
    };

    // Common action words
    this.actionWords = {
      'দেখাও': 'show',
      'দেখান': 'show',
      'বলো': 'tell',
      'বলুন': 'tell',
      'দাও': 'give',
      'দিন': 'give',
      'খুঁজে দাও': 'find',
      'খুঁজুন': 'search',
      'সাহায্য করো': 'help',
      'সাহায্য': 'help',
      'তথ্য দাও': 'information',
      'তথ্য': 'information',
      'জানাও': 'inform',
      'বুঝাও': 'explain'
    };

    // Campaign-related terms
    this.campaignTerms = {
      'ক্যাম্পেইন': 'campaign',
      'প্রচারাভিযান': 'campaign',
      'অভিযান': 'campaign',
      'দান': 'donation',
      'অনুদান': 'donation',
      'চাঁদা': 'donation',
      'সাহায্য': 'help',
      'সহায়তা': 'support',
      'অর্থ': 'money',
      'টাকা': 'money',
      'তহবিল': 'fund',
      'লক্ষ্য': 'goal',
      'সংগ্রহ': 'raised',
      'সংগ্রহীত': 'collected',
      'দাতা': 'donor',
      'দানকারী': 'donor'
    };

    // Response templates in Bangla
    this.responseTemplates = {
      greeting: [
        'হ্যালো! আমি CareForAll চ্যাটবট। আমি আপনাকে কীভাবে সাহায্য করতে পারি?',
        'নমস্কার! আমি আপনাকে সাহায্য করতে এখানে আছি। আপনার কী প্রয়োজন?',
        'আসসালামু আলাইকুম! আমি CareForAll-এর সহায়ক। আপনার জন্য কী করতে পারি?'
      ],
      campaignInfo: [
        'এই ক্যাম্পেইন সম্পর্কে তথ্য:',
        'ক্যাম্পেইনের বিস্তারিত:',
        'এখানে ক্যাম্পেইনের তথ্য রয়েছে:'
      ],
      help: [
        'আমি আপনাকে নিম্নলিখিত বিষয়ে সাহায্য করতে পারি:\n- ক্যাম্পেইন খুঁজুন\n- দানের তথ্য\n- ক্যাম্পেইন তৈরি করুন\n- পেমেন্ট সহায়তা',
        'আপনি আমাকে জিজ্ঞাসা করতে পারেন:\n• কোন ক্যাম্পেইন চলছে?\n• কীভাবে দান করবেন?\n• ক্যাম্পেইন সম্পর্কে তথ্য\n• পেমেন্ট স্ট্যাটাস'
      ],
      notFound: [
        'দুঃখিত, আমি এটি বুঝতে পারিনি। আপনি কি অন্যভাবে জিজ্ঞাসা করতে পারেন?',
        'ক্ষমা করবেন, আমি আপনার প্রশ্ন বুঝতে পারিনি। আরও বিস্তারিত বলুন?',
        'আমি নিশ্চিত নই আপনি কী জানতে চান। আপনি কি আরও স্পষ্ট করে বলতে পারেন?'
      ],
      thanks: [
        'আপনাকে ধন্যবাদ! আর কিছু জানার আছে?',
        'স্বাগতম! আমি সবসময় সাহায্য করতে প্রস্তুত।',
        'খুশি হলাম সাহায্য করতে পেরে! অন্য কিছু?'
      ]
    };
  }

  /**
   * Detect language of input text
   * @param {string} text - Input text
   * @returns {string} - Language code ('bn' for Bangla, 'en' for English)
   */
  detectLanguage(text) {
    if (!text || typeof text !== 'string') {
      return 'en';
    }

    // Check for Bangla Unicode range (U+0980 to U+09FF)
    const banglaPattern = /[\u0980-\u09FF]/;
    return banglaPattern.test(text) ? 'bn' : 'en';
  }

  /**
   * Normalize Bangla text (remove extra spaces, normalize characters)
   * @param {string} text - Input text
   * @returns {string} - Normalized text
   */
  normalize(text) {
    if (!text) return '';

    return text
      .trim()
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[।]+/g, '।') // Normalize Bangla full stop
      .replace(/[,]+/g, ',') // Normalize commas
      .toLowerCase();
  }

  /**
   * Extract intent from Bangla text
   * @param {string} text - Input text
   * @returns {object} - Intent object with type and confidence
   */
  extractIntent(text) {
    const normalized = this.normalize(text);
    const language = this.detectLanguage(text);

    // Check for greetings
    for (const [bangla, english] of Object.entries(this.greetings)) {
      if (normalized.includes(bangla.toLowerCase())) {
        return { type: 'greeting', confidence: 0.95, language };
      }
    }

    // Check for help requests
    if (normalized.includes('সাহায্য') || normalized.includes('হেল্প')) {
      return { type: 'help', confidence: 0.9, language };
    }

    // Check for campaign queries
    const campaignKeywords = ['ক্যাম্পেইন', 'প্রচারাভিযান', 'অভিযান'];
    if (campaignKeywords.some(keyword => normalized.includes(keyword))) {

      // Check for list requests
      if (normalized.includes('সব') || normalized.includes('লিস্ট') ||
          normalized.includes('কি কি') || normalized.includes('দেখাও')) {
        return { type: 'campaign_list', confidence: 0.85, language };
      }

      // Check for specific campaign info
      return { type: 'campaign_info', confidence: 0.8, language };
    }

    // Check for donation queries
    const donationKeywords = ['দান', 'অনুদান', 'চাঁদা', 'ডোনেশন'];
    if (donationKeywords.some(keyword => normalized.includes(keyword))) {

      // Check for how to donate
      if (normalized.includes('কিভাবে') || normalized.includes('কেমন')) {
        return { type: 'donation_help', confidence: 0.85, language };
      }

      return { type: 'donation_query', confidence: 0.8, language };
    }

    // Check for payment queries
    const paymentKeywords = ['পেমেন্ট', 'পেইমেন্ট', 'লেনদেন', 'টাকা'];
    if (paymentKeywords.some(keyword => normalized.includes(keyword))) {
      return { type: 'payment_query', confidence: 0.8, language };
    }

    // Check for thanks
    if (normalized.includes('ধন্যবাদ') || normalized.includes('থ্যাংক')) {
      return { type: 'thanks', confidence: 0.9, language };
    }

    // Default: unknown intent
    return { type: 'unknown', confidence: 0.5, language };
  }

  /**
   * Generate response in Bangla based on intent and data
   * @param {string} intentType - Type of intent
   * @param {object} data - Response data
   * @returns {string} - Formatted response in Bangla
   */
  generateBanglaResponse(intentType, data = {}) {
    const templates = this.responseTemplates[intentType];

    if (!templates || templates.length === 0) {
      return this.getRandomTemplate(this.responseTemplates.notFound);
    }

    const baseResponse = this.getRandomTemplate(templates);

    switch (intentType) {
      case 'greeting':
        return baseResponse;

      case 'help':
        return baseResponse;

      case 'campaignInfo':
        if (data.campaign) {
          return `${baseResponse}\n\n📋 নাম: ${data.campaign.name}\n💰 লক্ষ্য: ৳${this.formatBanglaNumber(data.campaign.goal)}\n✅ সংগৃহীত: ৳${this.formatBanglaNumber(data.campaign.raised || 0)}\n📅 শেষ তারিখ: ${this.formatBanglaDate(data.campaign.deadline)}`;
        }
        return baseResponse;

      case 'campaign_list':
        if (data.campaigns && data.campaigns.length > 0) {
          let response = `আমরা বর্তমানে ${this.toBanglaNumber(data.campaigns.length)}টি সক্রিয় ক্যাম্পেইন চালাচ্ছি:\n\n`;
          data.campaigns.slice(0, 5).forEach((campaign, index) => {
            response += `${index + 1}. ${campaign.name}\n   লক্ষ্য: ৳${this.formatBanglaNumber(campaign.goal)}\n\n`;
          });
          return response.trim();
        }
        return 'দুঃখিত, বর্তমানে কোন সক্রিয় ক্যাম্পেইন নেই।';

      case 'donation_help':
        return `দান করার পদ্ধতি:\n\n1️⃣ একটি ক্যাম্পেইন নির্বাচন করুন\n2️⃣ "দান করুন" বাটনে ক্লিক করুন\n3️⃣ পরিমাণ এবং তথ্য প্রদান করুন\n4️⃣ পেমেন্ট পদ্ধতি বেছে নিন (bKash, Nagad, Rocket, কার্ড)\n5️⃣ পেমেন্ট সম্পূর্ণ করুন\n\nআপনি যেকোনো পরিমাণ দান করতে পারেন!`;

      case 'thanks':
        return this.getRandomTemplate(this.responseTemplates.thanks);

      default:
        return this.getRandomTemplate(this.responseTemplates.notFound);
    }
  }

  /**
   * Get random template from array
   * @param {Array} templates - Array of template strings
   * @returns {string} - Random template
   */
  getRandomTemplate(templates) {
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Convert English number to Bangla number
   * @param {number} num - English number
   * @returns {string} - Bangla number string
   */
  toBanglaNumber(num) {
    const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).replace(/\d/g, digit => banglaDigits[parseInt(digit)]);
  }

  /**
   * Format number with commas and convert to Bangla
   * @param {number} num - Number to format
   * @returns {string} - Formatted Bangla number
   */
  formatBanglaNumber(num) {
    // Format with commas first (Indian numbering system)
    const formatted = new Intl.NumberFormat('en-IN').format(num);
    // Convert to Bangla digits
    return this.toBanglaNumber(formatted);
  }

  /**
   * Format date in Bangla
   * @param {string|Date} date - Date to format
   * @returns {string} - Formatted Bangla date
   */
  formatBanglaDate(date) {
    if (!date) return 'তারিখ নেই';

    const dateObj = new Date(date);
    const day = this.toBanglaNumber(dateObj.getDate());
    const year = this.toBanglaNumber(dateObj.getFullYear());

    const banglaMonths = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];

    const month = banglaMonths[dateObj.getMonth()];

    return `${day} ${month}, ${year}`;
  }

  /**
   * Translate common phrases from Bangla to English (for internal processing)
   * @param {string} text - Bangla text
   * @returns {string} - English equivalent
   */
  translateToEnglish(text) {
    const normalized = this.normalize(text);
    let translated = normalized;

    // Replace Bangla terms with English equivalents
    const allTerms = {
      ...this.greetings,
      ...this.questionWords,
      ...this.actionWords,
      ...this.campaignTerms
    };

    for (const [bangla, english] of Object.entries(allTerms)) {
      const regex = new RegExp(bangla, 'gi');
      translated = translated.replace(regex, english);
    }

    return translated;
  }

  /**
   * Check if text is asking about active campaigns
   * @param {string} text - Input text
   * @returns {boolean}
   */
  isAskingForCampaigns(text) {
    const normalized = this.normalize(text);
    const keywords = [
      'ক্যাম্পেইন', 'প্রচারাভিযান', 'সব', 'লিস্ট', 'কি কি',
      'চলছে', 'সক্রিয়', 'campaign', 'list', 'show', 'active'
    ];
    return keywords.some(keyword => normalized.includes(keyword));
  }

  /**
   * Extract campaign ID or name from text
   * @param {string} text - Input text
   * @returns {string|null} - Campaign identifier
   */
  extractCampaignIdentifier(text) {
    // Try to extract UUID pattern
    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const uuidMatch = text.match(uuidPattern);
    if (uuidMatch) {
      return uuidMatch[0];
    }

    // Try to extract campaign name (quoted or after certain keywords)
    const namePattern = /"([^"]+)"|'([^']+)'|ক্যাম্পেইন\s+([^\s]+)/i;
    const nameMatch = text.match(namePattern);
    if (nameMatch) {
      return nameMatch[1] || nameMatch[2] || nameMatch[3];
    }

    return null;
  }
}

module.exports = new BanglaProcessor();
