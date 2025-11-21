const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, getClient, AppError } = require('@careforall/shared');

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRES = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

class AuthService {
  /**
   * Register a new user
   */
  async register({ email, password, firstName, lastName, phone }) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // Check if user exists
      const existingUser = await client.query('SELECT id FROM auth.users WHERE email = $1', [
        email,
      ]);

      if (existingUser.rows.length > 0) {
        throw new AppError('User already exists', 409, 'USER_EXISTS');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user
      const userResult = await client.query(
        `INSERT INTO auth.users (email, password_hash, role, is_active, email_verified)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role, is_active, created_at`,
        [email, passwordHash, 'USER', true, false]
      );

      const user = userResult.rows[0];

      // Create user profile
      await client.query(
        `INSERT INTO auth.user_profiles (user_id, first_name, last_name, phone)
         VALUES ($1, $2, $3, $4)`,
        [user.id, firstName || null, lastName || null, phone || null]
      );

      await client.query('COMMIT');

      return {
        id: user.id,
        email: user.email,
        role: user.role,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Login user
   */
  async login({ email, password }) {
    // Get user
    const result = await query(
      'SELECT id, email, password_hash, role, is_active FROM auth.users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new AppError('Account is inactive', 403, 'ACCOUNT_INACTIVE');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

      // Check if refresh token exists in database
      const result = await query(
        'SELECT user_id FROM auth.refresh_tokens WHERE token = $1 AND expires_at > NOW()',
        [refreshToken]
      );

      if (result.rows.length === 0) {
        throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }

      // Get user
      const userResult = await query(
        'SELECT id, email, role FROM auth.users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const user = userResult.rows[0];

      // Generate new access token
      const accessToken = this.generateAccessToken(user);

      return { accessToken };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }
  }

  /**
   * Logout user (revoke refresh token)
   */
  async logout(refreshToken) {
    await query('DELETE FROM auth.refresh_tokens WHERE token = $1', [refreshToken]);
  }

  /**
   * Get user profile
   */
  async getProfile(userId) {
    const result = await query(
      `SELECT u.id, u.email, u.role, u.email_verified, u.created_at,
              p.first_name, p.last_name, p.phone, p.avatar_url, p.bio
       FROM auth.users u
       LEFT JOIN auth.user_profiles p ON u.id = p.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const user = result.rows[0];

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.email_verified,
      profile: {
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        bio: user.bio,
      },
      createdAt: user.created_at,
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, { firstName, lastName, phone, bio, avatarUrl }) {
    const result = await query(
      `UPDATE auth.user_profiles
       SET first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           phone = COALESCE($4, phone),
           bio = COALESCE($5, bio),
           avatar_url = COALESCE($6, avatar_url),
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING user_id, first_name, last_name, phone, bio, avatar_url`,
      [userId, firstName, lastName, phone, bio, avatarUrl]
    );

    if (result.rows.length === 0) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    return result.rows[0];
  }

  /**
   * Verify user (internal use by API Gateway)
   */
  async verifyUser(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user is active
      const result = await query(
        'SELECT id, email, role FROM auth.users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        throw new AppError('User not found or inactive', 404, 'USER_NOT_FOUND');
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    } catch (error) {
      throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }
  }

  /**
   * Generate access and refresh tokens
   */
  async generateTokens(user) {
    // Generate access token
    const accessToken = this.generateAccessToken(user);

    // Generate refresh token
    const refreshTokenValue = uuidv4();
    const refreshTokenExpires = new Date();
    refreshTokenExpires.setDate(refreshTokenExpires.getDate() + 7); // 7 days

    // Save refresh token to database
    await query(
      'INSERT INTO auth.refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshTokenValue, refreshTokenExpires]
    );

    // Sign refresh token as JWT
    const refreshToken = jwt.sign(
      { userId: user.id, tokenId: refreshTokenValue },
      process.env.JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Generate access token
   */
  generateAccessToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES }
    );
  }
}

module.exports = new AuthService();
