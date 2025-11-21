const { getPool } = require('@careforall/shared/database/pool');
const { logger } = require('@careforall/shared');
const { AppError } = require('@careforall/shared/middleware/errorHandler');
const { publishEvent, EVENTS } = require('@careforall/shared');

class CampaignService {
  async getAllCampaigns({ page = 1, limit = 10, status, type, sortBy = 'created_at', sortOrder = 'DESC' }) {
    const pool = getPool();
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`status = $${paramIndex++}`);
      queryParams.push(status);
    }

    if (type) {
      whereConditions.push(`campaign_type = $${paramIndex++}`);
      queryParams.push(type);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM campaigns.campaigns ${whereClause}`;
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Get campaigns
    const query = `
      SELECT * FROM campaigns.campaigns
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    return {
      campaigns: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCampaignById(id) {
    const pool = getPool();
    const query = 'SELECT * FROM campaigns.campaigns WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  async createCampaign(campaignData) {
    const pool = getPool();
    const {
      title,
      description,
      campaign_type,
      goal_amount,
      start_date,
      end_date,
      organizer_id,
      beneficiary_name,
      beneficiary_details,
      image_url,
      documents,
    } = campaignData;

    const query = `
      INSERT INTO campaigns.campaigns (
        title, description, campaign_type, goal_amount, start_date, end_date,
        organizer_id, beneficiary_name, beneficiary_details, image_url, documents, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft')
      RETURNING *
    `;

    const values = [
      title,
      description,
      campaign_type,
      goal_amount,
      start_date || new Date(),
      end_date,
      organizer_id,
      beneficiary_name,
      beneficiary_details,
      image_url,
      documents ? JSON.stringify(documents) : null,
    ];

    const result = await pool.query(query, values);
    const campaign = result.rows[0];

    // Publish event
    await publishEvent(EVENTS.CAMPAIGN_CREATED, {
      campaign_id: campaign.id,
      organizer_id: campaign.organizer_id,
      title: campaign.title,
      campaign_type: campaign.campaign_type,
      goal_amount: campaign.goal_amount,
    });

    logger.info('Campaign created', { campaignId: campaign.id });
    return campaign;
  }

  async updateCampaign(id, campaignData) {
    const pool = getPool();
    const updates = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = [
      'title',
      'description',
      'campaign_type',
      'goal_amount',
      'end_date',
      'beneficiary_name',
      'beneficiary_details',
      'image_url',
      'documents',
    ];

    for (const field of allowedFields) {
      if (campaignData[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        values.push(field === 'documents' && typeof campaignData[field] === 'object'
          ? JSON.stringify(campaignData[field])
          : campaignData[field]);
      }
    }

    if (updates.length === 0) {
      throw new AppError('No valid fields to update', 400, 'VALIDATION_ERROR');
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE campaigns.campaigns
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }

    const campaign = result.rows[0];

    // Publish event
    await publishEvent(EVENTS.CAMPAIGN_UPDATED, {
      campaign_id: campaign.id,
      organizer_id: campaign.organizer_id,
    });

    logger.info('Campaign updated', { campaignId: id });
    return campaign;
  }

  async updateCampaignStatus(id, status) {
    const pool = getPool();

    const query = `
      UPDATE campaigns.campaigns
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [status, id]);

    if (result.rows.length === 0) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }

    const campaign = result.rows[0];

    // Publish event
    await publishEvent(EVENTS.CAMPAIGN_STATUS_CHANGED, {
      campaign_id: campaign.id,
      organizer_id: campaign.organizer_id,
      previous_status: status,
      new_status: campaign.status,
    });

    if (status === 'completed' && campaign.current_amount >= campaign.goal_amount) {
      await publishEvent(EVENTS.CAMPAIGN_GOAL_REACHED, {
        campaign_id: campaign.id,
        organizer_id: campaign.organizer_id,
        goal_amount: campaign.goal_amount,
        current_amount: campaign.current_amount,
      });
    }

    logger.info('Campaign status updated', { campaignId: id, status });
    return campaign;
  }

  async deleteCampaign(id) {
    const pool = getPool();
    const query = 'DELETE FROM campaigns.campaigns WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }

    logger.info('Campaign deleted', { campaignId: id });
    return result.rows[0];
  }

  async getCampaignsByOrganizer(organizerId) {
    const pool = getPool();
    const query = `
      SELECT * FROM campaigns.campaigns
      WHERE organizer_id = $1
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [organizerId]);
    return result.rows;
  }

  async searchCampaigns({ query, type, status, page = 1, limit = 10 }) {
    const pool = getPool();
    const offset = (page - 1) * limit;

    let whereConditions = [
      `search_vector @@ plainto_tsquery('english', $1)`,
    ];
    let queryParams = [query];
    let paramIndex = 2;

    if (status) {
      whereConditions.push(`status = $${paramIndex++}`);
      queryParams.push(status);
    }

    if (type) {
      whereConditions.push(`campaign_type = $${paramIndex++}`);
      queryParams.push(type);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM campaigns.campaigns ${whereClause}`;
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Get campaigns with relevance ranking
    const searchQuery = `
      SELECT *,
        ts_rank(search_vector, plainto_tsquery('english', $1)) as relevance
      FROM campaigns.campaigns
      ${whereClause}
      ORDER BY relevance DESC, created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    queryParams.push(limit, offset);

    const result = await pool.query(searchQuery, queryParams);

    return {
      campaigns: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateCampaignAmount(campaignId, amount) {
    const pool = getPool();
    const query = `
      UPDATE campaigns.campaigns
      SET current_amount = current_amount + $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [amount, campaignId]);

    if (result.rows.length === 0) {
      throw new AppError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }

    const campaign = result.rows[0];

    // Check if goal reached
    if (campaign.current_amount >= campaign.goal_amount) {
      await publishEvent(EVENTS.CAMPAIGN_GOAL_REACHED, {
        campaign_id: campaign.id,
        organizer_id: campaign.organizer_id,
        goal_amount: campaign.goal_amount,
        current_amount: campaign.current_amount,
      });
    }

    return campaign;
  }
}

module.exports = new CampaignService();
