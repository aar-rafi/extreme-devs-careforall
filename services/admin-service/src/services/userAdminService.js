const { getPool } = require('@careforall/shared/database/pool');
const { logger } = require('@careforall/shared');
const auditService = require('./auditService');

class UserAdminService {
  /**
   * List all users with filtering and pagination
   * @param {Object} filters - Filter options
   * @param {string} filters.role - Filter by role (USER, ADMIN)
   * @param {boolean} filters.isActive - Filter by active status
   * @param {string} filters.search - Search by email or name
   * @param {number} filters.limit - Page size
   * @param {number} filters.offset - Offset for pagination
   */
  async listUsers(filters = {}) {
    const pool = getPool();
    const { role, isActive, search, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT
        u.id,
        u.email,
        u.role,
        u.is_active,
        u.email_verified,
        u.created_at,
        u.updated_at,
        up.first_name,
        up.last_name,
        up.phone,
        up.avatar_url,
        us.total_donated,
        us.donation_count,
        us.campaigns_supported
      FROM auth.users u
      LEFT JOIN auth.user_profiles up ON u.id = up.user_id
      LEFT JOIN query.user_statistics us ON u.id = us.user_id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (role) {
      query += ` AND u.role = $${paramIndex++}`;
      params.push(role);
    }

    if (typeof isActive === 'boolean') {
      query += ` AND u.is_active = $${paramIndex++}`;
      params.push(isActive);
    }

    if (search) {
      query += ` AND (u.email ILIKE $${paramIndex} OR up.first_name ILIKE $${paramIndex} OR up.last_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    try {
      const result = await pool.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM auth.users u WHERE 1=1`;
      const countParams = [];
      let countParamIndex = 1;

      if (role) {
        countQuery += ` AND u.role = $${countParamIndex++}`;
        countParams.push(role);
      }

      if (typeof isActive === 'boolean') {
        countQuery += ` AND u.is_active = $${countParamIndex++}`;
        countParams.push(isActive);
      }

      if (search) {
        countQuery += ` AND (u.email ILIKE $${countParamIndex++})`;
        countParams.push(`%${search}%`);
      }

      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      return {
        users: result.rows,
        total,
        limit,
        offset,
      };
    } catch (error) {
      logger.error('Failed to list users', { error: error.message, filters });
      throw error;
    }
  }

  /**
   * Update user active status (enable/disable account)
   * @param {string} userId - User ID
   * @param {boolean} isActive - New active status
   * @param {string} adminId - Admin user ID
   * @param {string} reason - Reason for status change
   * @param {string} ipAddress - Admin IP address
   * @param {string} userAgent - Admin user agent
   */
  async updateUserStatus(userId, isActive, adminId, reason, ipAddress, userAgent) {
    const pool = getPool();

    try {
      // Get current user
      const user = await pool.query(
        'SELECT * FROM auth.users WHERE id = $1',
        [userId]
      );

      if (user.rows.length === 0) {
        throw new Error('User not found');
      }

      const currentStatus = user.rows[0].is_active;

      // Prevent admin from disabling themselves
      if (userId === adminId && !isActive) {
        throw new Error('Cannot disable your own account');
      }

      // Update user status
      await pool.query(
        `UPDATE auth.users
         SET is_active = $1, updated_at = NOW()
         WHERE id = $2`,
        [isActive, userId]
      );

      // Log the action
      await auditService.logAction(
        adminId,
        isActive ? 'enable_user' : 'disable_user',
        'user',
        userId,
        { previousStatus: currentStatus, newStatus: isActive, reason },
        ipAddress,
        userAgent
      );

      logger.info('User status updated', { userId, isActive, adminId });

      return { success: true, message: `User ${isActive ? 'enabled' : 'disabled'} successfully` };
    } catch (error) {
      logger.error('Failed to update user status', {
        error: error.message,
        userId,
        adminId,
      });
      throw error;
    }
  }

  /**
   * Get user details
   * @param {string} userId - User ID
   */
  async getUserDetails(userId) {
    const pool = getPool();

    try {
      const result = await pool.query(`
        SELECT
          u.id,
          u.email,
          u.role,
          u.is_active,
          u.email_verified,
          u.created_at,
          u.updated_at,
          up.first_name,
          up.last_name,
          up.phone,
          up.avatar_url,
          up.bio,
          us.total_donated,
          us.donation_count,
          us.campaigns_supported,
          us.first_donation_at,
          us.last_donation_at
        FROM auth.users u
        LEFT JOIN auth.user_profiles up ON u.id = up.user_id
        LEFT JOIN query.user_statistics us ON u.id = us.user_id
        WHERE u.id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      // Get user's campaigns
      const campaigns = await pool.query(`
        SELECT
          c.id,
          c.title,
          c.campaign_type,
          c.goal_amount,
          c.status,
          c.created_at,
          ct.raised_amount,
          ct.donor_count,
          ct.progress_percentage
        FROM campaigns.campaigns c
        LEFT JOIN query.campaign_totals ct ON c.id = ct.campaign_id
        WHERE c.organizer_id = $1
        ORDER BY c.created_at DESC
        LIMIT 10
      `, [userId]);

      // Get user's donations
      const donations = await pool.query(`
        SELECT * FROM query.donation_history
        WHERE donor_id = $1
        ORDER BY donated_at DESC
        LIMIT 20
      `, [userId]);

      return {
        user: result.rows[0],
        campaigns: campaigns.rows,
        recentDonations: donations.rows,
      };
    } catch (error) {
      logger.error('Failed to get user details', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }
}

module.exports = new UserAdminService();
