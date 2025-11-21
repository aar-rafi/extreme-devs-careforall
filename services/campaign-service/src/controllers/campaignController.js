const campaignService = require('../services/campaignService');
const { successResponse, errorResponse, paginatedResponse } = require('@careforall/shared/utils/response');
const { AppError } = require('@careforall/shared/middleware/errorHandler');
const {
  createCampaignSchema,
  updateCampaignSchema,
  updateStatusSchema,
  campaignQuerySchema,
} = require('../validators/campaignValidators');

class CampaignController {
  async getAllCampaigns(req, res, next) {
    try {
      const { error, value } = campaignQuerySchema.validate(req.query);
      if (error) {
        throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
      }

      const { campaigns, pagination } = await campaignService.getAllCampaigns(value);
      return paginatedResponse(res, campaigns, pagination);
    } catch (error) {
      next(error);
    }
  }

  async getCampaignById(req, res, next) {
    try {
      const { id } = req.params;
      const campaign = await campaignService.getCampaignById(id);

      if (!campaign) {
        throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
      }

      return successResponse(res, campaign);
    } catch (error) {
      next(error);
    }
  }

  async createCampaign(req, res, next) {
    try {
      const { error, value } = createCampaignSchema.validate(req.body);
      if (error) {
        throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
      }

      // Set organizer from authenticated user
      value.organizer_id = req.user.userId;

      const campaign = await campaignService.createCampaign(value);
      return successResponse(res, campaign, 201);
    } catch (error) {
      next(error);
    }
  }

  async updateCampaign(req, res, next) {
    try {
      const { id } = req.params;
      const { error, value } = updateCampaignSchema.validate(req.body);
      if (error) {
        throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
      }

      // Check authorization - only organizer or admin can update
      const campaign = await campaignService.getCampaignById(id);
      if (!campaign) {
        throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
      }

      if (campaign.organizer_id !== req.user.userId && req.user.role !== 'ADMIN') {
        throw new AppError('Not authorized to update this campaign', 403, 'FORBIDDEN');
      }

      const updatedCampaign = await campaignService.updateCampaign(id, value);
      return successResponse(res, updatedCampaign);
    } catch (error) {
      next(error);
    }
  }

  async updateCampaignStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { error, value } = updateStatusSchema.validate(req.body);
      if (error) {
        throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
      }

      // Check authorization
      const campaign = await campaignService.getCampaignById(id);
      if (!campaign) {
        throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
      }

      if (campaign.organizer_id !== req.user.userId && req.user.role !== 'ADMIN') {
        throw new AppError('Not authorized to update this campaign', 403, 'FORBIDDEN');
      }

      const updatedCampaign = await campaignService.updateCampaignStatus(id, value.status);
      return successResponse(res, updatedCampaign);
    } catch (error) {
      next(error);
    }
  }

  async deleteCampaign(req, res, next) {
    try {
      const { id } = req.params;

      // Check authorization
      const campaign = await campaignService.getCampaignById(id);
      if (!campaign) {
        throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
      }

      if (campaign.organizer_id !== req.user.userId && req.user.role !== 'ADMIN') {
        throw new AppError('Not authorized to delete this campaign', 403, 'FORBIDDEN');
      }

      await campaignService.deleteCampaign(id);
      return successResponse(res, { message: 'Campaign deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getCampaignsByOrganizer(req, res, next) {
    try {
      const { organizerId } = req.params;

      // Users can only see their own campaigns unless they're admin
      if (organizerId !== req.user.userId && req.user.role !== 'ADMIN') {
        throw new AppError('Not authorized to view these campaigns', 403, 'FORBIDDEN');
      }

      const campaigns = await campaignService.getCampaignsByOrganizer(organizerId);
      return successResponse(res, campaigns);
    } catch (error) {
      next(error);
    }
  }

  async searchCampaigns(req, res, next) {
    try {
      const { q, type, status, page = 1, limit = 10 } = req.query;

      if (!q || q.trim().length < 3) {
        throw new AppError('Search query must be at least 3 characters', 400, 'VALIDATION_ERROR');
      }

      const { campaigns, pagination } = await campaignService.searchCampaigns({
        query: q,
        type,
        status,
        page: parseInt(page),
        limit: parseInt(limit),
      });

      return paginatedResponse(res, campaigns, pagination);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CampaignController();
