const Joi = require('joi');

const initiatePaymentSchema = Joi.object({
  pledge_id: Joi.string().uuid().required().messages({
    'string.guid': 'Pledge ID must be a valid UUID',
    'any.required': 'Pledge ID is required',
  }),
  success_url: Joi.string().uri().optional(),
  fail_url: Joi.string().uri().optional(),
  cancel_url: Joi.string().uri().optional(),
});

module.exports = {
  initiatePaymentSchema,
};
