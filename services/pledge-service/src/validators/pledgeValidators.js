const Joi = require('joi');

const createPledgeSchema = Joi.object({
  campaign_id: Joi.string().uuid().required(),
  amount: Joi.number().positive().min(10).required(), // Minimum pledge amount
  message: Joi.string().max(500).allow('').optional(),
  is_anonymous: Joi.boolean().default(false),
  // For anonymous users
  donor_email: Joi.string().email().optional(),
  donor_name: Joi.string().max(255).optional(),
});

module.exports = {
  createPledgeSchema,
};
