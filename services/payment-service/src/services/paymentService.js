const { v4: uuidv4 } = require('uuid');
const { getPool } = require('@careforall/shared/database/pool');
const { logger, publishEvent, EVENTS } = require('@careforall/shared');
const { AppError } = require('@careforall/shared/middleware/errorHandler');
const sslCommerzService = require('./sslCommerzService');
const { storeIdempotencyResponse } = require('../middleware/idempotencyMiddleware');

/**
 * Payment State Machine
 * Valid transitions:
 * - pending → authorized | failed
 * - authorized → captured | failed
 * - captured → completed | failed
 * - completed → refunded
 */
const VALID_STATE_TRANSITIONS = {
  pending: ['authorized', 'failed'],
  authorized: ['captured', 'failed'],
  captured: ['completed', 'failed'],
  completed: ['refunded'],
  failed: [], // Terminal state
  refunded: [], // Terminal state
};

class PaymentService {
  /**
   * Validate state transition
   */
  isValidStateTransition(fromState, toState) {
    return VALID_STATE_TRANSITIONS[fromState]?.includes(toState) || false;
  }

  /**
   * Record state transition in history
   */
  async recordStateTransition(client, paymentId, fromStatus, toStatus, reason = null) {
    const query = `
      INSERT INTO payments.payment_state_history (payment_id, from_status, to_status, reason)
      VALUES ($1, $2, $3, $4)
    `;
    await client.query(query, [paymentId, fromStatus, toStatus, reason]);
    logger.info('Payment state transition recorded', {
      paymentId,
      fromStatus,
      toStatus,
      reason,
    });
  }

  /**
   * Update payment status with state machine validation
   */
  async updatePaymentStatus(paymentId, newStatus, additionalData = {}, reason = null) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current payment
      const currentPayment = await client.query(
        'SELECT * FROM payments.payments WHERE id = $1 FOR UPDATE',
        [paymentId]
      );

      if (currentPayment.rows.length === 0) {
        throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
      }

      const payment = currentPayment.rows[0];
      const currentStatus = payment.status;

      // Validate state transition
      if (!this.isValidStateTransition(currentStatus, newStatus)) {
        throw new AppError(
          `Invalid state transition from ${currentStatus} to ${newStatus}`,
          400,
          'INVALID_STATE_TRANSITION'
        );
      }

      // Update payment
      const updateFields = [];
      const updateValues = [];
      let valueIndex = 1;

      updateFields.push(`status = $${valueIndex++}`);
      updateValues.push(newStatus);

      if (additionalData.transaction_id) {
        updateFields.push(`transaction_id = $${valueIndex++}`);
        updateValues.push(additionalData.transaction_id);
      }

      if (additionalData.payment_method) {
        updateFields.push(`payment_method = $${valueIndex++}`);
        updateValues.push(additionalData.payment_method);
      }

      if (additionalData.gateway_response) {
        updateFields.push(`gateway_response = $${valueIndex++}`);
        updateValues.push(JSON.stringify(additionalData.gateway_response));
      }

      if (additionalData.error_message) {
        updateFields.push(`error_message = $${valueIndex++}`);
        updateValues.push(additionalData.error_message);
      }

      if (newStatus === 'refunded') {
        updateFields.push(`refunded_at = NOW()`);
        if (additionalData.refund_reason) {
          updateFields.push(`refund_reason = $${valueIndex++}`);
          updateValues.push(additionalData.refund_reason);
        }
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(paymentId);

      const updateQuery = `
        UPDATE payments.payments
        SET ${updateFields.join(', ')}
        WHERE id = $${valueIndex}
        RETURNING *
      `;

      const result = await client.query(updateQuery, updateValues);
      const updatedPayment = result.rows[0];

      // Record state transition
      await this.recordStateTransition(client, paymentId, currentStatus, newStatus, reason);

      // Publish event based on new status
      let eventType;
      switch (newStatus) {
        case 'authorized':
          eventType = EVENTS.PAYMENT_AUTHORIZED;
          break;
        case 'captured':
          eventType = EVENTS.PAYMENT_CAPTURED;
          break;
        case 'completed':
          eventType = EVENTS.PAYMENT_COMPLETED;
          break;
        case 'failed':
          eventType = EVENTS.PAYMENT_FAILED;
          break;
        case 'refunded':
          eventType = EVENTS.PAYMENT_REFUNDED;
          break;
        default:
          eventType = null;
      }

      if (eventType) {
        const eventPayload = {
          payment_id: updatedPayment.id,
          pledge_id: updatedPayment.pledge_id,
          transaction_id: updatedPayment.transaction_id,
          amount: updatedPayment.amount,
          currency: updatedPayment.currency,
          status: updatedPayment.status,
          payment_method: updatedPayment.payment_method,
        };

        await publishEvent(eventType, eventPayload);

        // Always emit payment.complete to signal end of payment attempt,
        // even when the result is not "completed" (e.g., failed/cancelled).
        if (['completed', 'failed', 'refunded'].includes(updatedPayment.status)) {
          await publishEvent(EVENTS.PAYMENT_COMPLETE, eventPayload);
        }
      }

      await client.query('COMMIT');

      logger.info('Payment status updated', {
        paymentId,
        oldStatus: currentStatus,
        newStatus,
      });

      return updatedPayment;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating payment status', {
        error: error.message,
        paymentId,
        newStatus,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Initiate payment
   */
  async initiatePayment(paymentData) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { pledge_id, user_id, success_url, fail_url, cancel_url } = paymentData;

      // Get pledge details
      const pledgeQuery = 'SELECT * FROM pledges.pledges WHERE id = $1 FOR UPDATE';
      const pledgeResult = await client.query(pledgeQuery, [pledge_id]);

      if (pledgeResult.rows.length === 0) {
        throw new AppError('Pledge not found', 404, 'PLEDGE_NOT_FOUND');
      }

      const pledge = pledgeResult.rows[0];

      // Check pledge status
      if (pledge.status !== 'pending') {
        throw new AppError(
          'Pledge is not in pending state',
          400,
          'PLEDGE_NOT_PENDING'
        );
      }

      // Check if payment already exists for this pledge
      const existingPayment = await client.query(
        'SELECT * FROM payments.payments WHERE pledge_id = $1',
        [pledge_id]
      );

      if (existingPayment.rows.length > 0) {
        throw new AppError(
          'Payment already initiated for this pledge',
          409,
          'PAYMENT_ALREADY_EXISTS'
        );
      }

      // Create payment record
      const paymentId = uuidv4();
      const transactionId = `CFA-${Date.now()}-${paymentId.substring(0, 8)}`;

      const createPaymentQuery = `
        INSERT INTO payments.payments (
          id, pledge_id, transaction_id, amount, currency, status
        )
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING *
      `;

      const paymentResult = await client.query(createPaymentQuery, [
        paymentId,
        pledge_id,
        transactionId,
        pledge.amount,
        pledge.currency,
      ]);

      const payment = paymentResult.rows[0];

      // Update pledge status to payment_initiated
      await client.query(
        `UPDATE pledges.pledges SET status = 'payment_initiated', updated_at = NOW() WHERE id = $1`,
        [pledge_id]
      );

      await client.query('COMMIT');

      // DEMO: Pre-advance state to authorized -> captured, then still initiate gateway
      if (process.env.DEMO_FORCE_PAYMENT_SUCCESS === 'true') {
        // Follow valid transitions: pending -> authorized -> captured
        await this.updatePaymentStatus(
          paymentId,
          'authorized',
          {
            payment_method: 'demo',
            gateway_response: { demo: true, reason: 'DEMO_FORCE_PAYMENT_SUCCESS', stage: 'authorized' },
          },
          'Demo forced success'
        );

        await this.updatePaymentStatus(
          paymentId,
          'captured',
          {
            gateway_response: { demo: true, reason: 'DEMO_FORCE_PAYMENT_SUCCESS', stage: 'captured' },
          },
          'Demo forced success'
        );

        logger.warn('Demo mode: forcing payment success', {
          paymentId,
          pledgeId: pledge_id,
          transactionId,
        });
      }

      // Initiate payment with SSL Commerz (normal flow)
      const baseUrl = process.env.API_GATEWAY_URL || 'http://localhost:3000';
      const sslCommerzData = {
        tran_id: transactionId,
        total_amount: pledge.amount,
        currency: pledge.currency,
        product_name: 'Campaign Donation',
        product_category: 'Charity',
        product_profile: 'general',
        cus_name: pledge.donor_name || 'Anonymous Donor',
        cus_email: pledge.donor_email,
        cus_phone: '01700000000',
        cus_add1: 'Dhaka',
        cus_city: 'Dhaka',
        cus_country: 'Bangladesh',
        // Use frontend URLs for browser redirects (GET requests)
        success_url: success_url,
        fail_url: fail_url,
        cancel_url: cancel_url,
        // IPN for backend webhook (POST request)
        ipn_url: `${baseUrl}/api/payments/webhook/ipn`,
        shipping_method: 'NO',
      };

      const gatewayResponse = await sslCommerzService.initiatePayment(sslCommerzData);

      // Update payment with gateway response
      await pool.query(
        `UPDATE payments.payments
         SET gateway_response = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(gatewayResponse), paymentId]
      );

      // Publish event
      await publishEvent(EVENTS.PLEDGE_PAYMENT_INITIATED, {
        pledge_id,
        payment_id: paymentId,
        transaction_id: transactionId,
        amount: pledge.amount,
      });

      logger.info('Payment initiated successfully', {
        paymentId,
        pledgeId: pledge_id,
        transactionId,
      });

      return {
        payment_id: paymentId,
        transaction_id: transactionId,
        gateway_url: gatewayResponse.gatewayPageURL,
        amount: pledge.amount,
        currency: pledge.currency,
        status: payment.status,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error initiating payment', {
        error: error.message,
        pledgeId: paymentData.pledge_id,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(id) {
    const pool = getPool();
    const query = 'SELECT * FROM payments.payments WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Get payment by pledge ID
   */
  async getPaymentByPledgeId(pledgeId) {
    const pool = getPool();
    const query = 'SELECT * FROM payments.payments WHERE pledge_id = $1';
    const result = await pool.query(query, [pledgeId]);
    return result.rows[0];
  }

  /**
   * Get payment by transaction ID
   */
  async getPaymentByTransactionId(transactionId) {
    const pool = getPool();
    const query = 'SELECT * FROM payments.payments WHERE transaction_id = $1';
    const result = await pool.query(query, [transactionId]);
    return result.rows[0];
  }

  /**
   * Get pledge by ID
   */
  async getPledgeById(pledgeId) {
    const pool = getPool();
    const query = 'SELECT * FROM pledges.pledges WHERE id = $1';
    const result = await pool.query(query, [pledgeId]);
    return result.rows[0];
  }

  /**
   * Validate payment with SSL Commerz gateway
   */
  async validatePaymentWithGateway(paymentId) {
    const payment = await this.getPaymentById(paymentId);

    if (!payment) {
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    if (!payment.transaction_id) {
      throw new AppError('Transaction ID not found', 400, 'NO_TRANSACTION_ID');
    }

    try {
      const validationResponse = await sslCommerzService.queryTransactionByTranId(
        payment.transaction_id
      );

      logger.info('Payment validation response', {
        paymentId,
        transactionId: payment.transaction_id,
        status: validationResponse.status,
      });

      return {
        payment_id: paymentId,
        transaction_id: payment.transaction_id,
        gateway_status: validationResponse.status,
        validation_response: validationResponse,
      };
    } catch (error) {
      logger.error('Error validating payment', {
        error: error.message,
        paymentId,
      });
      throw error;
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(paymentId, refundReason, adminId) {
    const pool = getPool();

    try {
      const payment = await this.getPaymentById(paymentId);

      if (!payment) {
        throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
      }

      if (payment.status !== 'completed') {
        throw new AppError(
          'Only completed payments can be refunded',
          400,
          'INVALID_PAYMENT_STATUS'
        );
      }

      // Get bank_tran_id from gateway_response
      const gatewayResponse = payment.gateway_response;
      const bank_tran_id = gatewayResponse?.bank_tran_id;

      if (!bank_tran_id) {
        throw new AppError(
          'Bank transaction ID not found in payment record',
          400,
          'NO_BANK_TRAN_ID'
        );
      }

      // Initiate refund with SSL Commerz
      const refundResponse = await sslCommerzService.initiateRefund({
        bank_tran_id,
        refund_amount: payment.amount,
        refund_remarks: refundReason,
      });

      // Update payment status to refunded
      const updatedPayment = await this.updatePaymentStatus(
        paymentId,
        'refunded',
        {
          refund_reason: refundReason,
          gateway_response: {
            ...gatewayResponse,
            refund_response: refundResponse,
          },
        },
        `Refund initiated by admin ${adminId}: ${refundReason}`
      );

      logger.info('Payment refunded successfully', {
        paymentId,
        adminId,
        refundReason,
      });

      return updatedPayment;
    } catch (error) {
      logger.error('Error refunding payment', {
        error: error.message,
        paymentId,
      });
      throw error;
    }
  }
}

module.exports = new PaymentService();
