const Joi = require('joi');

const createPledgeSchema = Joi.object({
  campaign_id: Joi.string().uuid().required(),
  amount: Joi.number().positive().min(10).required(), // Minimum pledge amount
  message: Joi.string().max(500).optional(),
  is_anonymous: Joi.boolean().default(false),
});

module.exports = {
  createPledgeSchema,
};
