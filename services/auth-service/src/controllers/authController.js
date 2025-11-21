const authService = require('../services/authService');
const { successResponse, AppError } = require('@careforall/shared');
const {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  updateProfileSchema,
} = require('../validators/authValidators');

class AuthController {
  /**
   * Register new user
   */
  async register(req, res, next) {
    try {
      // Validate request
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
      }

      const user = await authService.register(value);
      return successResponse(res, user, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   */
  async login(req, res, next) {
    try {
      // Validate request
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
      }

      const result = await authService.login(value);
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   */
  async refresh(req, res, next) {
    try {
      // Validate request
      const { error, value } = refreshTokenSchema.validate(req.body);
      if (error) {
        throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
      }

      const result = await authService.refreshAccessToken(value.refreshToken);
      return successResponse(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   */
  async logout(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new AppError('Refresh token required', 400, 'VALIDATION_ERROR');
      }

      await authService.logout(refreshToken);
      return successResponse(res, { message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user profile
   */
  async getProfile(req, res, next) {
    try {
      const profile = await authService.getProfile(req.user.userId);
      return successResponse(res, profile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req, res, next) {
    try {
      // Validate request
      const { error, value } = updateProfileSchema.validate(req.body);
      if (error) {
        throw new AppError(error.details[0].message, 400, 'VALIDATION_ERROR');
      }

      const profile = await authService.updateProfile(req.user.userId, value);
      return successResponse(res, profile);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify token (internal - for API Gateway)
   */
  async verify(req, res, next) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('No token provided', 401, 'NO_TOKEN');
      }

      const token = authHeader.split(' ')[1];
      const user = await authService.verifyUser(token);

      return successResponse(res, user);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
