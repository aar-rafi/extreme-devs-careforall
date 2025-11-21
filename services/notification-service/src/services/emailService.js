const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('@careforall/shared');
const { getPool } = require('@careforall/shared/database/pool');

class EmailService {
  constructor() {
    this.transporter = null;
    this.templateCache = new Map();
  }

  /**
   * Initialize the email transporter
   */
  async initialize() {
    try {
      // Create SMTP transporter (Gmail SMTP for development/testing)
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      // Verify connection configuration
      await this.transporter.verify();
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.warn('Email service initialization failed. Email notifications will be disabled.', {
        error: error.message
      });
      this.transporter = null; // Disable email service
      // Don't throw - allow service to start without email functionality
    }
  }

  /**
   * Load and compile Handlebars template
   * @param {string} templateName - Name of the template file (without .hbs extension)
   * @returns {Promise<Function>} - Compiled Handlebars template
   */
  async loadTemplate(templateName) {
    // Check cache first
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    try {
      const templatePath = path.join(__dirname, '../templates/email', `${templateName}.hbs`);
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      const compiledTemplate = handlebars.compile(templateContent);

      // Cache the compiled template
      this.templateCache.set(templateName, compiledTemplate);
      return compiledTemplate;
    } catch (error) {
      logger.error('Failed to load email template', { templateName, error: error.message });
      throw error;
    }
  }

  /**
   * Send email using template
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email address
   * @param {string} options.subject - Email subject
   * @param {string} options.templateName - Name of the Handlebars template
   * @param {Object} options.templateData - Data to pass to the template
   * @param {string} options.eventType - Event type that triggered the email (for tracking)
   * @param {string} options.eventId - Event ID (for deduplication)
   * @param {string} options.userId - Optional user ID
   * @returns {Promise<Object>} - Email sending result
   */
  async sendEmail({ to, subject, templateName, templateData, eventType, eventId, userId }) {
    const pool = getPool();
    const notificationId = require('uuid').v4();

    // Check if email service is initialized
    if (!this.transporter) {
      logger.warn('Email service not initialized. Skipping email notification.', { to, subject });
      return { success: false, error: 'Email service not configured' };
    }

    try {
      // Check for duplicate event_id to prevent duplicate emails
      if (eventId) {
        const duplicateCheck = await pool.query(
          `SELECT id FROM notifications.notification_history
           WHERE event_type = $1 AND event_id = $2 AND status = 'sent'
           LIMIT 1`,
          [eventType, eventId]
        );

        if (duplicateCheck.rows.length > 0) {
          logger.info('Duplicate email prevented', { eventType, eventId });
          return { duplicate: true, notificationId: duplicateCheck.rows[0].id };
        }
      }

      // Insert notification record with pending status
      await pool.query(
        `INSERT INTO notifications.notification_history (
          id, notification_type, event_type, event_id, recipient_email, recipient_user_id,
          subject, template_name, template_data, status
        ) VALUES ($1, 'email', $2, $3, $4, $5, $6, $7, $8, 'pending')`,
        [notificationId, eventType, eventId, to, userId, subject, templateName, JSON.stringify(templateData)]
      );

      // Load and render template
      const template = await this.loadTemplate(templateName);
      const htmlContent = template(templateData);

      // Send email
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"CareForAll Platform" <noreply@careforall.com>',
        to,
        subject,
        html: htmlContent,
      });

      // Update notification record with success
      await pool.query(
        `UPDATE notifications.notification_history
         SET status = 'sent', sent_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [notificationId]
      );

      logger.info('Email sent successfully', {
        notificationId,
        to,
        subject,
        templateName,
        messageId: info.messageId,
      });

      return { success: true, notificationId, messageId: info.messageId };
    } catch (error) {
      // Update notification record with failure
      await pool.query(
        `UPDATE notifications.notification_history
         SET status = 'failed', error_message = $1, updated_at = NOW()
         WHERE id = $2`,
        [error.message, notificationId]
      );

      logger.error('Failed to send email', {
        notificationId,
        to,
        subject,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(user) {
    return this.sendEmail({
      to: user.email,
      subject: 'Welcome to CareForAll!',
      templateName: 'welcome',
      templateData: {
        firstName: user.first_name || 'Friend',
        email: user.email,
        platformName: 'CareForAll',
      },
      eventType: 'user.registered',
      eventId: user.id,
      userId: user.id,
    });
  }

  /**
   * Send pledge confirmation email
   */
  async sendPledgeConfirmation({ pledge, campaign, user }) {
    return this.sendEmail({
      to: pledge.donor_email,
      subject: 'Thank you for your pledge!',
      templateName: 'pledge-confirmation',
      templateData: {
        donorName: pledge.donor_name || 'Friend',
        amount: pledge.amount,
        currency: pledge.currency || 'BDT',
        campaignTitle: campaign.title,
        campaignId: campaign.id,
        pledgeId: pledge.id,
      },
      eventType: 'pledge.created',
      eventId: pledge.id,
      userId: user?.id,
    });
  }

  /**
   * Send donation success email
   */
  async sendDonationSuccess({ pledge, campaign, payment }) {
    return this.sendEmail({
      to: pledge.donor_email,
      subject: 'Your donation was successful!',
      templateName: 'donation-success',
      templateData: {
        donorName: pledge.donor_name || 'Friend',
        amount: pledge.amount,
        currency: pledge.currency || 'BDT',
        campaignTitle: campaign.title,
        campaignId: campaign.id,
        transactionId: payment.transaction_id,
        donatedAt: new Date().toLocaleDateString(),
      },
      eventType: 'payment.completed',
      eventId: payment.id,
      userId: pledge.user_id,
    });
  }

  /**
   * Send campaign goal reached notification to organizer
   */
  async sendCampaignGoalReached({ campaign, organizer }) {
    return this.sendEmail({
      to: organizer.email,
      subject: 'Congratulations! Your campaign reached its goal!',
      templateName: 'campaign-goal-reached',
      templateData: {
        organizerName: organizer.first_name || 'Organizer',
        campaignTitle: campaign.title,
        goalAmount: campaign.goal_amount,
        currency: 'BDT',
        totalDonors: campaign.donor_count || 0,
      },
      eventType: 'campaign.goal_reached',
      eventId: campaign.id,
      userId: organizer.id,
    });
  }

  /**
   * Send new donation notification to campaign organizer
   */
  async sendNewDonationNotification({ campaign, organizer, pledge }) {
    return this.sendEmail({
      to: organizer.email,
      subject: 'New donation received for your campaign!',
      templateName: 'new-donation',
      templateData: {
        organizerName: organizer.first_name || 'Organizer',
        campaignTitle: campaign.title,
        donorName: pledge.is_anonymous ? 'Anonymous' : pledge.donor_name,
        amount: pledge.amount,
        currency: pledge.currency || 'BDT',
        message: pledge.message,
      },
      eventType: 'pledge.completed',
      eventId: `${campaign.id}-${pledge.id}`,
      userId: organizer.id,
    });
  }
}

module.exports = new EmailService();
