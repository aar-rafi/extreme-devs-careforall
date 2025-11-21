const paymentService = require('../services/paymentService');
const { successResponse, errorResponse } = require('@careforall/shared/utils/response');
const { AppError } = require('@careforall/shared/middleware/errorHandler');
const { initiatePaymentSchema } = require('../validators/paymentValidators');
const { storeIdempotencyResponse } = require('../middleware/idempotencyMiddleware');
const { v4: uuidv4 } = require('uuid');

class PaymentController {
  /**
   * Initiate a payment for a pledge
   * POST /api/payments/initiate
   */
  async initiatePayment(req, res, next) {
    try {
      const { error, value } = initiatePaymentSchema.validate(req.body);
      if (error) {
        throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
      }

      const { pledge_id, success_url, fail_url, cancel_url } = value;

      // Get user info if authenticated, otherwise anonymous
      const userId = req.user ? req.user.userId : null;

      const result = await paymentService.initiatePayment({
        pledge_id,
        user_id: userId,
        success_url: success_url || `${process.env.FRONTEND_URL}/payment/success`,
        fail_url: fail_url || `${process.env.FRONTEND_URL}/payment/failed`,
        cancel_url: cancel_url || `${process.env.FRONTEND_URL}/payment/cancelled`,
      });

      // Demo/production idempotency storage: persist the exact response we will send
      try {
        if (req.idempotencyKey && req.requestHash) {
          const responseBody = {
            success: true,
            data: result,
            meta: {
              timestamp: new Date().toISOString(),
              requestId: res.locals.requestId || uuidv4(),
            },
          };
          await storeIdempotencyResponse(
            req.idempotencyKey,
            req.requestHash,
            responseBody,
            201
          );
        }
      } catch (e) {
        // Non-fatal: if storing idempotency fails, we still return success
      }

      return res.status(201).json({
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: res.locals.requestId || uuidv4(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payment by ID
   * GET /api/payments/:id
   */
  async getPaymentById(req, res, next) {
    try {
      const { id } = req.params;
      const payment = await paymentService.getPaymentById(id);

      if (!payment) {
        throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
      }

      // Authorization check
      if (req.user.role !== 'ADMIN') {
        // Fetch pledge to verify ownership
        const pledge = await paymentService.getPledgeById(payment.pledge_id);
        if (pledge.user_id !== req.user.userId) {
          throw new AppError('Not authorized to view this payment', 403, 'FORBIDDEN');
        }
      }

      return successResponse(res, payment);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payment by pledge ID
   * GET /api/payments/pledge/:pledgeId
   */
  async getPaymentByPledgeId(req, res, next) {
    try {
      const { pledgeId } = req.params;
      const payment = await paymentService.getPaymentByPledgeId(pledgeId);

      if (!payment) {
        throw new AppError('Payment not found for this pledge', 404, 'PAYMENT_NOT_FOUND');
      }

      // Authorization check - allow anonymous users to view their own payments
      // Only restrict if user is authenticated but trying to view someone else's payment
      if (req.user && req.user.role !== 'ADMIN') {
        const pledge = await paymentService.getPledgeById(payment.pledge_id);
        if (pledge.user_id && pledge.user_id !== req.user.userId) {
          throw new AppError('Not authorized to view this payment', 403, 'FORBIDDEN');
        }
      }

      return successResponse(res, payment);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payment by transaction ID
   * GET /api/payments/transaction/:transactionId
   */
  async getPaymentByTransactionId(req, res, next) {
    try {
      const { transactionId } = req.params;
      const payment = await paymentService.getPaymentByTransactionId(transactionId);

      if (!payment) {
        throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
      }

      // Authorization check
      if (req.user.role !== 'ADMIN') {
        const pledge = await paymentService.getPledgeById(payment.pledge_id);
        if (pledge.user_id !== req.user.userId) {
          throw new AppError('Not authorized to view this payment', 403, 'FORBIDDEN');
        }
      }

      return successResponse(res, payment);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate payment with SSL Commerz
   * POST /api/payments/:id/validate
   */
  async validatePayment(req, res, next) {
    try {
      const { id } = req.params;
      const result = await paymentService.validatePaymentWithGateway(id);

      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refund a payment (Admin only)
   * POST /api/payments/:id/refund
   */
  async refundPayment(req, res, next) {
    try {
      // Check admin role
      if (req.user.role !== 'ADMIN') {
        throw new AppError('Only admins can refund payments', 403, 'FORBIDDEN');
      }

      const { id } = req.params;
      const { refund_reason } = req.body;

      if (!refund_reason) {
        throw new AppError('Refund reason is required', 400, 'VALIDATION_ERROR');
      }

      const result = await paymentService.refundPayment(id, refund_reason, req.user.userId);

      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PaymentController();
