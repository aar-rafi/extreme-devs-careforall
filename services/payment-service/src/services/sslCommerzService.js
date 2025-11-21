const SSLCommerzPayment = require('sslcommerz-lts');
const { logger } = require('@careforall/shared');
const { AppError } = require('@careforall/shared/middleware/errorHandler');

class SSLCommerzService {
  constructor() {
    this.store_id = process.env.SSLCOMMERZ_STORE_ID;
    this.store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD;
    this.is_live = process.env.NODE_ENV === 'production'; // true for live, false for sandbox

    if (!this.store_id || !this.store_passwd) {
      logger.error('SSL Commerz credentials not configured');
      throw new Error('SSL Commerz credentials not configured');
    }

    this.sslcz = new SSLCommerzPayment(this.store_id, this.store_passwd, this.is_live);

    logger.info('SSL Commerz service initialized', {
      store_id: this.store_id,
      is_live: this.is_live,
    });
  }

  /**
   * Initialize payment session with SSL Commerz
   */
  async initiatePayment(paymentData) {
    try {
      const {
        tran_id,
        total_amount,
        currency,
        product_name,
        product_category,
        cus_name,
        cus_email,
        cus_phone,
        cus_add1,
        cus_city,
        cus_country,
        success_url,
        fail_url,
        cancel_url,
        ipn_url,
        shipping_method,
        product_profile,
      } = paymentData;

      const data = {
        total_amount: parseFloat(total_amount),
        currency: currency || 'BDT',
        tran_id: tran_id,
        success_url: success_url,
        fail_url: fail_url,
        cancel_url: cancel_url,
        ipn_url: ipn_url,
        product_name: product_name || 'Donation',
        product_category: product_category || 'Charity',
        product_profile: product_profile || 'general',
        shipping_method: shipping_method || 'NO',
        cus_name: cus_name,
        cus_email: cus_email,
        cus_add1: cus_add1 || 'Dhaka',
        cus_city: cus_city || 'Dhaka',
        cus_postcode: '1000',
        cus_country: cus_country || 'Bangladesh',
        cus_phone: cus_phone || '01700000000',
      };

      logger.info('Initiating SSL Commerz payment', { tran_id, total_amount });

      const apiResponse = await this.sslcz.init(data);

      if (!apiResponse || apiResponse.status !== 'SUCCESS') {
        logger.error('SSL Commerz payment initiation failed', {
          response: apiResponse,
        });
        throw new AppError(
          'Failed to initiate payment with gateway',
          500,
          'PAYMENT_GATEWAY_ERROR'
        );
      }

      logger.info('SSL Commerz payment initiated successfully', {
        tran_id,
        sessionkey: apiResponse.sessionkey,
      });

      return {
        gatewayPageURL: apiResponse.GatewayPageURL,
        sessionkey: apiResponse.sessionkey,
        status: apiResponse.status,
      };
    } catch (error) {
      logger.error('Error initiating SSL Commerz payment', {
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Payment gateway error: ' + error.message,
        500,
        'PAYMENT_GATEWAY_ERROR'
      );
    }
  }

  /**
   * Validate transaction with SSL Commerz
   * This should be called after receiving payment confirmation to verify
   */
  async validateTransaction(val_id) {
    try {
      logger.info('Validating transaction with SSL Commerz', { val_id });

      const validationResponse = await this.sslcz.validate({ val_id });

      logger.info('Transaction validation response', {
        val_id,
        status: validationResponse.status,
      });

      return validationResponse;
    } catch (error) {
      logger.error('Error validating transaction', {
        error: error.message,
        val_id,
      });
      throw new AppError(
        'Failed to validate transaction with gateway',
        500,
        'PAYMENT_VALIDATION_ERROR'
      );
    }
  }

  /**
   * Initiate refund with SSL Commerz
   */
  async initiateRefund(refundData) {
    try {
      const { bank_tran_id, refund_amount, refund_remarks } = refundData;

      logger.info('Initiating refund with SSL Commerz', {
        bank_tran_id,
        refund_amount,
      });

      const refundResponse = await this.sslcz.initiateRefund({
        bank_tran_id,
        refund_amount: parseFloat(refund_amount),
        refund_remarks: refund_remarks || 'Refund requested by admin',
      });

      logger.info('Refund initiated', {
        bank_tran_id,
        status: refundResponse.status,
      });

      return refundResponse;
    } catch (error) {
      logger.error('Error initiating refund', {
        error: error.message,
        refundData,
      });
      throw new AppError('Failed to initiate refund', 500, 'REFUND_ERROR');
    }
  }

  /**
   * Query refund status
   */
  async queryRefundStatus(refund_ref_id) {
    try {
      logger.info('Querying refund status', { refund_ref_id });

      const statusResponse = await this.sslcz.refundQuery({
        refund_ref_id,
      });

      return statusResponse;
    } catch (error) {
      logger.error('Error querying refund status', {
        error: error.message,
        refund_ref_id,
      });
      throw new AppError('Failed to query refund status', 500, 'REFUND_QUERY_ERROR');
    }
  }

  /**
   * Query transaction by session key
   */
  async queryTransactionBySessionKey(sessionkey) {
    try {
      logger.info('Querying transaction by session key', { sessionkey });

      const response = await this.sslcz.transactionQueryBySessionKey({
        sessionkey,
      });

      return response;
    } catch (error) {
      logger.error('Error querying transaction', {
        error: error.message,
        sessionkey,
      });
      throw new AppError('Failed to query transaction', 500, 'TRANSACTION_QUERY_ERROR');
    }
  }

  /**
   * Query transaction by transaction ID
   */
  async queryTransactionByTranId(tran_id) {
    try {
      logger.info('Querying transaction by tran_id', { tran_id });

      const response = await this.sslcz.transactionQueryByTransactionId({
        tran_id,
      });

      return response;
    } catch (error) {
      logger.error('Error querying transaction', {
        error: error.message,
        tran_id,
      });
      throw new AppError('Failed to query transaction', 500, 'TRANSACTION_QUERY_ERROR');
    }
  }
}

module.exports = new SSLCommerzService();
