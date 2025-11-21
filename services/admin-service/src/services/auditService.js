const { getPool } = require('@careforall/shared/database/pool');
const { logger } = require('@careforall/shared');

class AuditService {
  /**
   * Log an admin action
   * @param {string} adminId - Admin user ID
   * @param {string} action - Action performed
   * @param {string} entityType - Type of entity (campaign, user, payment, etc.)
   * @param {string} entityId - ID of the entity
   * @param {Object} details - Additional details (previous/new values, reason, etc.)
   * @param {string} ipAddress - IP address of the request
   * @param {string} userAgent - User agent string
   */
  async logAction(adminId, action, entityType, entityId, details = {}, ipAddress = null, userAgent = null) {
    const pool = getPool();

    try {
      await pool.query(
        `INSERT INTO admin.audit_logs (
          admin_id, action, entity_type, entity_id, details, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [adminId, action, entityType, entityId, JSON.stringify(details), ipAddress, userAgent]
      );

      logger.info('Admin action logged', {
        adminId,
        action,
        entityType,
        entityId,
      });
    } catch (error) {
      logger.error('Failed to log admin action', {
        error: error.message,
        adminId,
        action,
        entityType,
        entityId,
      });
      // Don't throw - audit logging failure shouldn't block the action
    }
  }

  /**
   * Get audit logs with filtering and pagination
   * @param {Object} filters - Filter options
   * @param {string} filters.adminId - Filter by admin ID
   * @param {string} filters.action - Filter by action
   * @param {string} filters.entityType - Filter by entity type
   * @param {string} filters.entityId - Filter by entity ID
   * @param {Date} filters.startDate - Filter by start date
   * @param {Date} filters.endDate - Filter by end date
   * @param {number} filters.limit - Page size (default: 50)
   * @param {number} filters.offset - Offset for pagination (default: 0)
   */
  async getAuditLogs(filters = {}) {
    const pool = getPool();

    const {
      adminId,
      action,
      entityType,
      entityId,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
    } = filters;

    let query = `
      SELECT al.*, u.email as admin_email, up.first_name, up.last_name
      FROM admin.audit_logs al
      JOIN auth.users u ON al.admin_id = u.id
      LEFT JOIN auth.user_profiles up ON u.id = up.user_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (adminId) {
      query += ` AND al.admin_id = $${paramIndex++}`;
      params.push(adminId);
    }

    if (action) {
      query += ` AND al.action = $${paramIndex++}`;
      params.push(action);
    }

    if (entityType) {
      query += ` AND al.entity_type = $${paramIndex++}`;
      params.push(entityType);
    }

    if (entityId) {
      query += ` AND al.entity_id = $${paramIndex++}`;
      params.push(entityId);
    }

    if (startDate) {
      query += ` AND al.created_at >= $${paramIndex++}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND al.created_at <= $${paramIndex++}`;
      params.push(endDate);
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    try {
      const result = await pool.query(query, params);

      // Get total count
      let countQuery = `SELECT COUNT(*) FROM admin.audit_logs al WHERE 1=1`;
      const countParams = [];
      let countParamIndex = 1;

      if (adminId) {
        countQuery += ` AND al.admin_id = $${countParamIndex++}`;
        countParams.push(adminId);
      }

      if (action) {
        countQuery += ` AND al.action = $${countParamIndex++}`;
        countParams.push(action);
      }

      if (entityType) {
        countQuery += ` AND al.entity_type = $${countParamIndex++}`;
        countParams.push(entityType);
      }

      if (entityId) {
        countQuery += ` AND al.entity_id = $${countParamIndex++}`;
        countParams.push(entityId);
      }

      if (startDate) {
        countQuery += ` AND al.created_at >= $${countParamIndex++}`;
        countParams.push(startDate);
      }

      if (endDate) {
        countQuery += ` AND al.created_at <= $${countParamIndex++}`;
        countParams.push(endDate);
      }

      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      return {
        logs: result.rows,
        total,
        limit,
        offset,
      };
    } catch (error) {
      logger.error('Failed to get audit logs', { error: error.message, filters });
      throw error;
    }
  }
}

module.exports = new AuditService();
