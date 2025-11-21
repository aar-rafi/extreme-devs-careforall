const { getPool } = require('@careforall/shared/database/pool');
const { logger } = require('@careforall/shared');
const { AppError } = require('@careforall/shared/middleware/errorHandler');
const paymentService = require('./paymentService');
const sslCommerzService = require('./sslCommerzService');

class WebhookService {
  /**
   * Check if webhook has already been processed (deduplication)
   */
  async isWebhookProcessed(webhookId) {
    const pool = getPool();
    const query = `
      SELECT * FROM payments.webhook_logs
      WHERE webhook_id = $1
    `;
    const result = await pool.query(query, [webhookId]);
    return result.rows.length > 0;
  }

  /**
   * Store webhook log
   */
  async storeWebhookLog(webhookId, eventType, payload, processed = false, errorMessage = null) {
    const pool = getPool();

    try {
      const query = `
        INSERT INTO payments.webhook_logs (
          webhook_id, event_type, payload, processed, error_message, processed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (webhook_id) DO NOTHING
      `;

      await pool.query(query, [
        webhookId,
        eventType,
        JSON.stringify(payload),
        processed,
        errorMessage,
        processed ? new Date() : null,
      ]);

      logger.info('Webhook log stored', { webhookId, eventType, processed });
    } catch (error) {
      logger.error('Error storing webhook log', {
        error: error.message,
        webhookId,
      });
    }
  }

  /**
   * Mark webhook as processed
   */
  async markWebhookProcessed(webhookId) {
    const pool = getPool();
    const query = `
      UPDATE payments.webhook_logs
      SET processed = true, processed_at = NOW()
      WHERE webhook_id = $1
    `;
    await pool.query(query, [webhookId]);
  }

  /**
   * Validate webhook signature (if SSL Commerz provides one)
   * For now, we'll validate by checking if transaction exists in our system
   */
  async validateWebhook(webhookData) {
    const { tran_id, val_id } = webhookData;

    if (!tran_id) {
      logger.error('Webhook validation failed: missing tran_id', { webhookData });
      return false;
    }

    // Check if payment exists in our system
    const payment = await paymentService.getPaymentByTransactionId(tran_id);

    if (!payment) {
      logger.error('Webhook validation failed: payment not found', {
        tran_id,
      });
      return false;
    }

    // If val_id is provided, validate with SSL Commerz
    if (val_id) {
      try {
        const validationResponse = await sslCommerzService.validateTransaction(val_id);

        if (validationResponse.status !== 'VALID' && validationResponse.status !== 'VALIDATED') {
          logger.error('SSL Commerz validation failed', {
            val_id,
            status: validationResponse.status,
          });
          return false;
        }

        logger.info('Webhook validated successfully', { tran_id, val_id });
        return true;
      } catch (error) {
        logger.error('Error validating webhook with SSL Commerz', {
          error: error.message,
          val_id,
        });
        return false;
      }
    }

    // If no val_id, just check if payment exists
    return true;
  }

  /**
   * Process success webhook
   */
  async processSuccessWebhook(webhookData) {
    const { tran_id, val_id, amount, card_type, status } = webhookData;

    // Generate webhook ID for deduplication
    const webhookId = `success-${tran_id}-${val_id || Date.now()}`;

    // Check if already processed
    if (await this.isWebhookProcessed(webhookId)) {
      logger.info('Webhook already processed, skipping', { webhookId });
      return { skipped: true, reason: 'Already processed' };
    }

    // Store webhook log
    await this.storeWebhookLog(webhookId, 'success', webhookData, false);

    try {
      // Validate webhook
      const isValid = await this.validateWebhook(webhookData);

      if (!isValid) {
        throw new AppError('Webhook validation failed', 400, 'INVALID_WEBHOOK');
      }

      // Get payment
      const payment = await paymentService.getPaymentByTransactionId(tran_id);

      if (!payment) {
        throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
      }

      // Update payment status
      // Success webhook indicates payment is authorized/captured
      const newStatus = payment.status === 'pending' ? 'authorized' : 'captured';

      await paymentService.updatePaymentStatus(
        payment.id,
        newStatus,
        {
          payment_method: card_type || 'unknown',
          gateway_response: webhookData,
        },
        'Success webhook received'
      );

      // Mark webhook as processed
      await this.markWebhookProcessed(webhookId);

      logger.info('Success webhook processed', {
        webhookId,
        paymentId: payment.id,
        transactionId: tran_id,
      });

      return {
        success: true,
        payment_id: payment.id,
        transaction_id: tran_id,
      };
    } catch (error) {
      logger.error('Error processing success webhook', {
        error: error.message,
        webhookId,
        webhookData,
      });

      // Update webhook log with error
      await this.storeWebhookLog(webhookId, 'success', webhookData, false, error.message);

      throw error;
    }
  }

  /**
   * Process failure webhook
   */
  async processFailureWebhook(webhookData) {
    const { tran_id, error: errorMsg, status } = webhookData;

    const webhookId = `fail-${tran_id}-${Date.now()}`;

    // Check if already processed
    if (await this.isWebhookProcessed(webhookId)) {
      logger.info('Webhook already processed, skipping', { webhookId });
      return { skipped: true, reason: 'Already processed' };
    }

    // Store webhook log
    await this.storeWebhookLog(webhookId, 'failure', webhookData, false);

    try {
      // Get payment
      const payment = await paymentService.getPaymentByTransactionId(tran_id);

      if (!payment) {
        throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
      }

      // Update payment status to failed
      await paymentService.updatePaymentStatus(
        payment.id,
        'failed',
        {
          error_message: errorMsg || 'Payment failed',
          gateway_response: webhookData,
        },
        'Failure webhook received'
      );

      // Mark webhook as processed
      await this.markWebhookProcessed(webhookId);

      logger.info('Failure webhook processed', {
        webhookId,
        paymentId: payment.id,
        transactionId: tran_id,
      });

      return {
        success: true,
        payment_id: payment.id,
        transaction_id: tran_id,
        status: 'failed',
      };
    } catch (error) {
      logger.error('Error processing failure webhook', {
        error: error.message,
        webhookId,
        webhookData,
      });

      await this.storeWebhookLog(webhookId, 'failure', webhookData, false, error.message);

      throw error;
    }
  }

  /**
   * Process cancel webhook
   */
  async processCancelWebhook(webhookData) {
    const { tran_id } = webhookData;

    const webhookId = `cancel-${tran_id}-${Date.now()}`;

    // Check if already processed
    if (await this.isWebhookProcessed(webhookId)) {
      logger.info('Webhook already processed, skipping', { webhookId });
      return { skipped: true, reason: 'Already processed' };
    }

    // Store webhook log
    await this.storeWebhookLog(webhookId, 'cancel', webhookData, false);

    try {
      // Get payment
      const payment = await paymentService.getPaymentByTransactionId(tran_id);

      if (!payment) {
        throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
      }

      // Update payment status to failed (cancelled by user)
      await paymentService.updatePaymentStatus(
        payment.id,
        'failed',
        {
          error_message: 'Payment cancelled by user',
          gateway_response: webhookData,
        },
        'Cancel webhook received'
      );

      // Mark webhook as processed
      await this.markWebhookProcessed(webhookId);

      logger.info('Cancel webhook processed', {
        webhookId,
        paymentId: payment.id,
        transactionId: tran_id,
      });

      return {
        success: true,
        payment_id: payment.id,
        transaction_id: tran_id,
        status: 'cancelled',
      };
    } catch (error) {
      logger.error('Error processing cancel webhook', {
        error: error.message,
        webhookId,
        webhookData,
      });

      await this.storeWebhookLog(webhookId, 'cancel', webhookData, false, error.message);

      throw error;
    }
  }

  /**
   * Process IPN (Instant Payment Notification) webhook
   * This is the main webhook that confirms payment completion
   */
  async processIPNWebhook(webhookData) {
    const { tran_id, val_id, amount, card_type, status, bank_tran_id } = webhookData;

    // Generate webhook ID for deduplication
    const webhookId = `ipn-${tran_id}-${val_id || Date.now()}`;

    // Check if already processed
    if (await this.isWebhookProcessed(webhookId)) {
      logger.info('IPN webhook already processed, skipping', { webhookId });
      return { skipped: true, reason: 'Already processed' };
    }

    // Store webhook log
    await this.storeWebhookLog(webhookId, 'ipn', webhookData, false);

    try {
      // Validate webhook with SSL Commerz
      const isValid = await this.validateWebhook(webhookData);

      if (!isValid) {
        throw new AppError('IPN webhook validation failed', 400, 'INVALID_WEBHOOK');
      }

      // Get payment
      const payment = await paymentService.getPaymentByTransactionId(tran_id);

      if (!payment) {
        throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
      }

      // Check webhook status
      if (status === 'VALID' || status === 'VALIDATED') {
        // Payment is successful - mark as completed
        await paymentService.updatePaymentStatus(
          payment.id,
          'completed',
          {
            payment_method: card_type || 'unknown',
            gateway_response: {
              ...webhookData,
              bank_tran_id,
            },
          },
          'IPN webhook confirmed payment success'
        );

        logger.info('IPN webhook processed - payment completed', {
          webhookId,
          paymentId: payment.id,
          transactionId: tran_id,
        });
      } else if (status === 'FAILED') {
        // Payment failed
        await paymentService.updatePaymentStatus(
          payment.id,
          'failed',
          {
            error_message: webhookData.error || 'Payment failed',
            gateway_response: webhookData,
          },
          'IPN webhook confirmed payment failure'
        );

        logger.info('IPN webhook processed - payment failed', {
          webhookId,
          paymentId: payment.id,
          transactionId: tran_id,
        });
      } else if (status === 'CANCELLED') {
        // Payment cancelled
        await paymentService.updatePaymentStatus(
          payment.id,
          'failed',
          {
            error_message: 'Payment cancelled',
            gateway_response: webhookData,
          },
          'IPN webhook confirmed payment cancellation'
        );

        logger.info('IPN webhook processed - payment cancelled', {
          webhookId,
          paymentId: payment.id,
          transactionId: tran_id,
        });
      }

      // Mark webhook as processed
      await this.markWebhookProcessed(webhookId);

      return {
        success: true,
        payment_id: payment.id,
        transaction_id: tran_id,
        status: payment.status,
      };
    } catch (error) {
      logger.error('Error processing IPN webhook', {
        error: error.message,
        webhookId,
        webhookData,
      });

      await this.storeWebhookLog(webhookId, 'ipn', webhookData, false, error.message);

      throw error;
    }
  }
}

module.exports = new WebhookService();
