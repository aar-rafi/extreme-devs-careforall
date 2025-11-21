const Joi = require('joi');

const createCampaignSchema = Joi.object({
  title: Joi.string().min(5).max(255).required(),
  description: Joi.string().min(20).required(),
  campaign_type: Joi.string().valid('medical', 'education', 'emergency', 'long_term').required(),
  goal_amount: Joi.number().positive().required(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.when('start_date', {
    is: Joi.exist(),
    then: Joi.date().iso().greater(Joi.ref('start_date')).optional(),
    otherwise: Joi.date().iso().optional(),
  }),
  beneficiary_name: Joi.string().max(255).optional(),
  beneficiary_details: Joi.string().optional(),
  image_url: Joi.string().uri().optional(),
  documents: Joi.object().optional(),
}).unknown(true); // Allow extra fields for demo mode

const updateCampaignSchema = Joi.object({
  title: Joi.string().min(5).max(255).optional(),
  description: Joi.string().min(20).optional(),
  campaign_type: Joi.string().valid('medical', 'education', 'emergency', 'long_term').optional(),
  goal_amount: Joi.number().positive().optional(),
  end_date: Joi.date().iso().optional(),
  beneficiary_name: Joi.string().max(255).optional(),
  beneficiary_details: Joi.string().optional(),
  image_url: Joi.string().uri().optional(),
  documents: Joi.object().optional(),
}).min(1).unknown(true); // Allow extra fields for demo mode

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('draft', 'active', 'completed', 'cancelled', 'expired').required(),
});

const campaignQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('draft', 'active', 'completed', 'cancelled', 'expired').optional(),
  type: Joi.string().valid('medical', 'education', 'emergency', 'long_term').optional(),
  sortBy: Joi.string().valid('created_at', 'goal_amount', 'current_amount', 'title').default('created_at'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
});

module.exports = {
  createCampaignSchema,
  updateCampaignSchema,
  updateStatusSchema,
  campaignQuerySchema,
};
