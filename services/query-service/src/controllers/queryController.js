const queryService = require('../services/queryService');
const { successResponse, errorResponse } = require('@careforall/shared/utils/response');
const { AppError } = require('@careforall/shared/middleware/errorHandler');

class QueryController {
  async getCampaignStats(req, res, next) {
    try {
      const { id } = req.params;
      const stats = await queryService.getCampaignStats(id);

      if (!stats) {
        throw new AppError('Campaign stats not found', 404, 'NOT_FOUND');
      }

      return successResponse(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async getTrendingCampaigns(req, res, next) {
    try {
      const { limit = 10 } = req.query;
      const campaigns = await queryService.getTrendingCampaigns(parseInt(limit));
      return successResponse(res, campaigns);
    } catch (error) {
      next(error);
    }
  }

  async getUserStats(req, res, next) {
    try {
      const { id } = req.params;

      // Users can only view their own stats unless they're admin
      if (id !== req.user?.userId && req.user?.role !== 'ADMIN') {
        throw new AppError('Not authorized to view these stats', 403, 'FORBIDDEN');
      }

      const stats = await queryService.getUserStats(id);
      return successResponse(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async getPlatformStats(req, res, next) {
    try {
      const stats = await queryService.getPlatformStats();
      return successResponse(res, stats);
    } catch (error) {
      next(error);
    }
  }

  async getRecentDonations(req, res, next) {
    try {
      const { limit = 20 } = req.query;
      const donations = await queryService.getRecentDonations(parseInt(limit));
      return successResponse(res, donations);
    } catch (error) {
      next(error);
    }
  }

  async getUserDonationHistory(req, res, next) {
    try {
      const { userId } = req.params;

      // Users can only view their own donation history unless they're admin
      if (userId !== req.user?.userId && req.user?.role !== 'ADMIN') {
        throw new AppError('Not authorized to view this donation history', 403, 'FORBIDDEN');
      }

      const history = await queryService.getUserDonationHistory(userId);
      return successResponse(res, history);
    } catch (error) {
      next(error);
    }
  }

  async getCampaignDonations(req, res, next) {
    try {
      const { campaignId } = req.params;
      const donations = await queryService.getCampaignDonations(campaignId);
      return successResponse(res, donations);
    } catch (error) {
      next(error);
    }
  }

  async getTopDonors(req, res, next) {
    try {
      const { limit = 10 } = req.query;
      const donors = await queryService.getTopDonors(parseInt(limit));
      return successResponse(res, donors);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new QueryController();
