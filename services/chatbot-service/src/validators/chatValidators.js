/**
 * Chat Request Validators
 * Joi validation schemas for chat endpoints
 */

const Joi = require('joi');

const sendMessageSchema = Joi.object({
  conversationId: Joi.string().uuid().optional(),
  message: Joi.string().min(1).max(2000).required(),
  language: Joi.string().valid('en', 'bn').optional()
});

const getConversationSchema = Joi.object({
  id: Joi.string().uuid().required()
});

const getUserConversationsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).optional()
});

const createConversationSchema = Joi.object({
  language: Joi.string().valid('en', 'bn').optional().default('en')
});

/**
 * Validate middleware factory
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'body' ? req.body :
                  source === 'params' ? req.params :
                  req.query;

    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    // Replace the request data with validated data
    if (source === 'body') req.body = value;
    if (source === 'params') req.params = value;
    if (source === 'query') req.query = value;

    next();
  };
};

module.exports = {
  sendMessageSchema,
  getConversationSchema,
  getUserConversationsSchema,
  createConversationSchema,
  validate
};
