const pledgeService = require('../services/pledgeService');
const { successResponse, errorResponse } = require('@careforall/shared/utils/response');
const { AppError } = require('@careforall/shared/middleware/errorHandler');
const { createPledgeSchema } = require('../validators/pledgeValidators');

class PledgeController {
  async createPledge(req, res, next) {
    try {
      const { error, value } = createPledgeSchema.validate(req.body);
      if (error) {
        throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
      }

      // Set user_id only if authenticated
      if (req.user) {
        value.user_id = req.user.userId;
      }

      const pledge = await pledgeService.createPledge(value);

      return successResponse(res, pledge, 201);
    } catch (error) {
      next(error);
    }
  }

  async getPledgeById(req, res, next) {
    try {
      const { id } = req.params;
      const pledge = await pledgeService.getPledgeById(id);

      if (!pledge) {
        throw new AppError('Pledge not found', 404, 'PLEDGE_NOT_FOUND');
      }

      // Allow authenticated users to only view their own pledges (unless admin)
      // Allow anonymous users to view any pledge by ID (needed for payment verification)
      if (req.user && pledge.user_id && pledge.user_id !== req.user.userId && req.user.role !== 'ADMIN') {
        throw new AppError('Not authorized to view this pledge', 403, 'FORBIDDEN');
      }

      return successResponse(res, pledge);
    } catch (error) {
      next(error);
    }
  }

  async getUserPledges(req, res, next) {
    try {
      const pledges = await pledgeService.getPledgesByUser(req.user.userId);
      return successResponse(res, pledges);
    } catch (error) {
      next(error);
    }
  }

  async getPledgesByCampaign(req, res, next) {
    try {
      const { campaignId } = req.params;

      // Only campaign organizers and admins can view all pledges for a campaign
      if (req.user.role !== 'ADMIN') {
        // TODO: Verify user is campaign organizer by calling campaign service
        // For now, we'll allow all authenticated users
      }

      const pledges = await pledgeService.getPledgesByCampaign(campaignId);
      return successResponse(res, pledges);
    } catch (error) {
      next(error);
    }
  }

  async cancelPledge(req, res, next) {
    try {
      const { id } = req.params;
      const pledge = await pledgeService.getPledgeById(id);

      if (!pledge) {
        throw new AppError('Pledge not found', 404, 'PLEDGE_NOT_FOUND');
      }

      // Users can only cancel their own pledges
      if (pledge.user_id !== req.user.userId && req.user.role !== 'ADMIN') {
        throw new AppError('Not authorized to cancel this pledge', 403, 'FORBIDDEN');
      }

      if (pledge.status !== 'pending') {
        throw new AppError('Only pending pledges can be cancelled', 400, 'INVALID_STATUS');
      }

      const cancelledPledge = await pledgeService.cancelPledge(id);
      return successResponse(res, cancelledPledge);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PledgeController();
