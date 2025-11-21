const webhookService = require('../services/webhookService');
const { logger } = require('@careforall/shared');

class WebhookController {
  /**
   * Handle successful payment webhook from SSL Commerz
   * POST /api/payments/webhook/success
   */
  async handleSuccess(req, res) {
    try {
      logger.info('Received success webhook', { body: req.body });

      const result = await webhookService.processSuccessWebhook(req.body);

      // Always return 200 to acknowledge receipt
      return res.status(200).json({
        success: true,
        message: 'Webhook processed',
      });
    } catch (error) {
      logger.error('Error processing success webhook', { error: error.message });
      // Still return 200 to prevent retries
      return res.status(200).json({
        success: false,
        message: 'Webhook received but processing failed',
      });
    }
  }

  /**
   * Handle failed payment webhook from SSL Commerz
   * POST /api/payments/webhook/fail
   */
  async handleFailure(req, res) {
    try {
      logger.info('Received failure webhook', { body: req.body });

      const result = await webhookService.processFailureWebhook(req.body);

      return res.status(200).json({
        success: true,
        message: 'Webhook processed',
      });
    } catch (error) {
      logger.error('Error processing failure webhook', { error: error.message });
      return res.status(200).json({
        success: false,
        message: 'Webhook received but processing failed',
      });
    }
  }

  /**
   * Handle cancelled payment webhook from SSL Commerz
   * POST /api/payments/webhook/cancel
   */
  async handleCancel(req, res) {
    try {
      logger.info('Received cancel webhook', { body: req.body });

      const result = await webhookService.processCancelWebhook(req.body);

      return res.status(200).json({
        success: true,
        message: 'Webhook processed',
      });
    } catch (error) {
      logger.error('Error processing cancel webhook', { error: error.message });
      return res.status(200).json({
        success: false,
        message: 'Webhook received but processing failed',
      });
    }
  }

  /**
   * Handle IPN (Instant Payment Notification) webhook from SSL Commerz
   * This is the main webhook that confirms payment status
   * POST /api/payments/webhook/ipn
   */
  async handleIPN(req, res) {
    try {
      logger.info('Received IPN webhook', { body: req.body });

      const result = await webhookService.processIPNWebhook(req.body);

      return res.status(200).json({
        success: true,
        message: 'IPN processed',
      });
    } catch (error) {
      logger.error('Error processing IPN webhook', { error: error.message });
      // Still return 200 to prevent SSL Commerz from retrying
      return res.status(200).json({
        success: false,
        message: 'IPN received but processing failed',
      });
    }
  }
}

module.exports = new WebhookController();
