const { getPool } = require('@careforall/shared/database/pool');
const { logger } = require('@careforall/shared');
const auditService = require('./auditService');

class PaymentAdminService {
  /**
   * List all payments with filtering and pagination
   * @param {Object} filters - Filter options
   * @param {string} filters.status - Filter by status
   * @param {string} filters.paymentMethod - Filter by payment method
   * @param {Date} filters.startDate - Filter by start date
   * @param {Date} filters.endDate - Filter by end date
   * @param {number} filters.limit - Page size
   * @param {number} filters.offset - Offset for pagination
   */
  async listPayments(filters = {}) {
    const pool = getPool();
    const { status, paymentMethod, startDate, endDate, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT
        p.*,
        pl.donor_email,
        pl.donor_name,
        pl.campaign_id,
        c.title as campaign_title
      FROM payments.payments p
      JOIN pledges.pledges pl ON p.pledge_id = pl.id
      JOIN campaigns.campaigns c ON pl.campaign_id = c.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND p.status = $${paramIndex++}`;
      params.push(status);
    }

    if (paymentMethod) {
      query += ` AND p.payment_method = $${paramIndex++}`;
      params.push(paymentMethod);
    }

    if (startDate) {
      query += ` AND p.created_at >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND p.created_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    try {
      const result = await pool.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM payments.payments p WHERE 1=1`;
      const countParams = [];
      let countParamIndex = 1;

      if (status) {
        countQuery += ` AND p.status = $${countParamIndex++}`;
        countParams.push(status);
      }

      if (paymentMethod) {
        countQuery += ` AND p.payment_method = $${countParamIndex++}`;
        countParams.push(paymentMethod);
      }

      if (startDate) {
        countQuery += ` AND p.created_at >= $${countParamIndex++}`;
        countParams.push(startDate);
      }

      if (endDate) {
        countQuery += ` AND p.created_at <= $${countParamIndex++}`;
        countParams.push(endDate);
      }

      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      return {
        payments: result.rows,
        total,
        limit,
        offset,
      };
    } catch (error) {
      logger.error('Failed to list payments', { error: error.message, filters });
      throw error;
    }
  }

  /**
   * Refund a payment
   * @param {string} paymentId - Payment ID
   * @param {string} adminId - Admin user ID
   * @param {string} reason - Refund reason
   * @param {string} ipAddress - Admin IP address
   * @param {string} userAgent - Admin user agent
   */
  async refundPayment(paymentId, adminId, reason, ipAddress, userAgent) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get payment details
      const payment = await client.query(
        'SELECT * FROM payments.payments WHERE id = $1',
        [paymentId]
      );

      if (payment.rows.length === 0) {
        throw new Error('Payment not found');
      }

      const currentStatus = payment.rows[0].status;
      const amount = payment.rows[0].amount;
      const pledgeId = payment.rows[0].pledge_id;

      // Only completed payments can be refunded
      if (currentStatus !== 'completed') {
        throw new Error(`Payment is ${currentStatus}, only completed payments can be refunded`);
      }

      // Update payment status to refunded
      await client.query(
        `UPDATE payments.payments
         SET status = 'refunded',
             refund_reason = $1,
             refunded_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [reason, paymentId]
      );

      // Record state transition
      await client.query(
        `INSERT INTO payments.payment_state_history (
          payment_id, from_status, to_status, reason
        ) VALUES ($1, $2, $3, $4)`,
        [paymentId, currentStatus, 'refunded', reason]
      );

      // Update pledge status to refunded
      await client.query(
        `UPDATE pledges.pledges
         SET status = 'refunded', updated_at = NOW()
         WHERE id = $1`,
        [pledgeId]
      );

      // Get pledge and campaign details for updating stats
      const pledge = await client.query(
        'SELECT * FROM pledges.pledges WHERE id = $1',
        [pledgeId]
      );

      const campaignId = pledge.rows[0].campaign_id;
      const userId = pledge.rows[0].user_id;

      // Update campaign_totals (decrease raised amount and donor count)
      await client.query(
        `UPDATE query.campaign_totals
         SET raised_amount = raised_amount - $1,
             donor_count = donor_count - 1,
             updated_at = NOW()
         WHERE campaign_id = $2`,
        [amount, campaignId]
      );

      // Update user_statistics if user exists
      if (userId) {
        await client.query(
          `UPDATE query.user_statistics
           SET total_donated = total_donated - $1,
               donation_count = donation_count - 1,
               campaigns_supported = GREATEST(campaigns_supported - 1, 0),
               updated_at = NOW()
           WHERE user_id = $2`,
          [amount, userId]
        );
      }

      // Update platform_statistics
      await client.query(
        `UPDATE query.platform_statistics
         SET total_raised = total_raised - $1,
             total_donations = total_donations - 1,
             updated_at = NOW()
         WHERE id = 1`,
        [amount]
      );

      // Log the action
      await auditService.logAction(
        adminId,
        'refund_payment',
        'payment',
        paymentId,
        {
          amount,
          pledgeId,
          campaignId,
          previousStatus: currentStatus,
          newStatus: 'refunded',
          reason,
        },
        ipAddress,
        userAgent
      );

      await client.query('COMMIT');

      logger.info('Payment refunded', { paymentId, adminId, amount, reason });

      return {
        success: true,
        message: 'Payment refunded successfully',
        refundedAmount: amount,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to refund payment', {
        error: error.message,
        paymentId,
        adminId,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get payment details
   * @param {string} paymentId - Payment ID
   */
  async getPaymentDetails(paymentId) {
    const pool = getPool();

    try {
      const result = await pool.query(`
        SELECT
          p.*,
          pl.donor_email,
          pl.donor_name,
          pl.campaign_id,
          pl.user_id,
          c.title as campaign_title,
          c.organizer_id
        FROM payments.payments p
        JOIN pledges.pledges pl ON p.pledge_id = pl.id
        JOIN campaigns.campaigns c ON pl.campaign_id = c.id
        WHERE p.id = $1
      `, [paymentId]);

      if (result.rows.length === 0) {
        throw new Error('Payment not found');
      }

      // Get state history
      const history = await pool.query(`
        SELECT * FROM payments.payment_state_history
        WHERE payment_id = $1
        ORDER BY created_at DESC
      `, [paymentId]);

      return {
        payment: result.rows[0],
        stateHistory: history.rows,
      };
    } catch (error) {
      logger.error('Failed to get payment details', {
        error: error.message,
        paymentId,
      });
      throw error;
    }
  }
}

module.exports = new PaymentAdminService();
