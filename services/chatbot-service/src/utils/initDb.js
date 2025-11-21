/**
 * Database Initialization Script
 * Creates chatbot schema and tables
 */

const { pool, logger } = require('@careforall/shared');

async function initializeDatabase() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    logger.info('Creating chatbot schema and tables...');

    // Create schema
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS chatbot;
    `);

    // Create conversations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chatbot.conversations (
        id UUID PRIMARY KEY,
        user_id UUID,
        language VARCHAR(5) DEFAULT 'en',
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        CONSTRAINT valid_language CHECK (language IN ('en', 'bn'))
      );
    `);

    // Create index on user_id for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_user_id
      ON chatbot.conversations(user_id);
    `);

    // Create index on updated_at for cleanup queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
      ON chatbot.conversations(updated_at);
    `);

    // Create messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chatbot.messages (
        id UUID PRIMARY KEY,
        conversation_id UUID NOT NULL REFERENCES chatbot.conversations(id) ON DELETE CASCADE,
        sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'bot')),
        message_text TEXT NOT NULL,
        response_text TEXT,
        language VARCHAR(5) DEFAULT 'en',
        confidence DECIMAL(3,2),
        metadata JSONB,
        created_at TIMESTAMP NOT NULL,
        CONSTRAINT valid_language CHECK (language IN ('en', 'bn'))
      );
    `);

    // Create index on conversation_id for faster message retrieval
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
      ON chatbot.messages(conversation_id);
    `);

    // Create index on created_at for ordering
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_created_at
      ON chatbot.messages(created_at);
    `);

    // Create knowledge base table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chatbot.knowledge_base (
        id UUID PRIMARY KEY,
        campaign_id UUID,
        key VARCHAR(255) NOT NULL,
        value TEXT,
        language VARCHAR(5) DEFAULT 'en',
        updated_at TIMESTAMP NOT NULL,
        CONSTRAINT valid_language CHECK (language IN ('en', 'bn')),
        CONSTRAINT unique_knowledge UNIQUE (campaign_id, key, language)
      );
    `);

    // Create index on campaign_id for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_campaign_id
      ON chatbot.knowledge_base(campaign_id);
    `);

    // Create index on key for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_key
      ON chatbot.knowledge_base(key);
    `);

    await client.query('COMMIT');

    logger.info('✅ Chatbot database schema created successfully');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Error creating chatbot schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      logger.info('Database initialization complete');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Database initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase };
