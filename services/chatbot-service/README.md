# Chatbot Service

AI-powered chatbot service with **Bangla (Bengali) language support** for the CareForAll fundraising platform.

## Features

✨ **Dual Language Support**
- English and Bangla (বাংলা) language detection and processing
- Automatic language switching based on user input
- Native Bangla number formatting and date formatting

💬 **Intelligent Conversation**
- Intent detection and classification
- Context-aware responses
- Conversation history management
- Multi-turn conversations with context

🎯 **Campaign Knowledge Base**
- Real-time campaign information retrieval
- Campaign search and recommendations
- Donation guidance and help
- FAQ matching

🔄 **Event-Driven Updates**
- Subscribes to campaign events via BullMQ
- Automatic knowledge base updates
- Real-time data synchronization

🌐 **RESTful API**
- Simple HTTP endpoints
- Optional authentication support
- Anonymous user support

## Architecture

The chatbot service follows a modular architecture:

```
chatbot-service/
├── src/
│   ├── index.js                 # Main entry point
│   ├── routes/
│   │   └── chatRoutes.js        # API routes
│   ├── controllers/
│   │   └── chatController.js    # Request handlers
│   ├── services/
│   │   ├── chatService.js           # Main chat logic
│   │   ├── banglaProcessor.js       # Bangla language processing
│   │   ├── conversationManager.js   # Conversation storage
│   │   └── knowledgeBase.js         # Campaign data integration
│   ├── consumers/
│   │   └── campaignConsumer.js  # Event consumers
│   ├── middleware/
│   │   └── optionalAuth.js      # Authentication middleware
│   ├── validators/
│   │   └── chatValidators.js    # Input validation
│   └── utils/
│       ├── banglaProcessor.js   # Bangla text utilities
│       └── initDb.js            # Database initialization
```

## API Endpoints

### Send Message
```http
POST /api/chat/messages
Content-Type: application/json

{
  "conversationId": "uuid",  // Optional, creates new if omitted
  "message": "আপনার কোন ক্যাম্পেইন চলছে?",
  "language": "bn"           // Optional: 'en' or 'bn'
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conversationId": "uuid",
    "response": "আমরা বর্তমানে ৫টি সক্রিয় ক্যাম্পেইন চালাচ্ছি...",
    "language": "bn",
    "intent": "campaign_list",
    "confidence": 0.9,
    "metadata": {}
  }
}
```

### Get Conversation History
```http
GET /api/chat/conversations/:id?limit=50
```

### Create New Conversation
```http
POST /api/chat/conversations
Content-Type: application/json

{
  "language": "bn"  // Optional: 'en' or 'bn'
}
```

### Health Check
```http
GET /api/chat/health
```

## Bangla Language Processing

The chatbot includes a comprehensive Bangla language processor with the following capabilities:

### Language Detection
Automatically detects Bangla Unicode characters (U+0980 to U+09FF) and switches language mode.

### Intent Recognition
Recognizes intents in both English and Bangla:
- **Greetings**: হ্যালো, নমস্কার, আসসালামু আলাইকুম
- **Campaign queries**: ক্যাম্পেইন, প্রচারাভিযান
- **Donation help**: দান, অনুদান, চাঁদা
- **Payment info**: পেমেন্ট, লেনদেন
- **Help requests**: সাহায্য, হেল্প

### Bangla Number Formatting
```javascript
formatBanglaNumber(50000)
// Output: ৫০,০০০
```

### Bangla Date Formatting
```javascript
formatBanglaDate(new Date('2025-11-21'))
// Output: ২১ নভেম্বর, ২০২৫
```

### Response Templates
Pre-built response templates in Bangla for:
- Greetings
- Campaign information
- Donation guidance
- Payment help
- Error messages

## Database Schema

The service uses PostgreSQL with the following schema:

```sql
-- Conversations table
CREATE TABLE chatbot.conversations (
  id UUID PRIMARY KEY,
  user_id UUID,
  language VARCHAR(5) DEFAULT 'en',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Messages table
CREATE TABLE chatbot.messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES chatbot.conversations(id),
  sender VARCHAR(10) CHECK (sender IN ('user', 'bot')),
  message_text TEXT,
  response_text TEXT,
  language VARCHAR(5),
  confidence DECIMAL(3,2),
  metadata JSONB,
  created_at TIMESTAMP
);

-- Knowledge base table
CREATE TABLE chatbot.knowledge_base (
  id UUID PRIMARY KEY,
  campaign_id UUID,
  key VARCHAR(255),
  value TEXT,
  language VARCHAR(5),
  updated_at TIMESTAMP,
  UNIQUE(campaign_id, key, language)
);
```

## Environment Variables

```env
# Service Configuration
PORT=3008
NODE_ENV=development
SERVICE_NAME=chatbot-service

# Database
DATABASE_URL=postgresql://user:pass@postgres:5432/careforall

# Redis (for BullMQ)
REDIS_URL=redis://redis:6379

# Service URLs
QUERY_SERVICE_URL=http://query-service:3005
CAMPAIGN_SERVICE_URL=http://campaign-service:3002
AUTH_SERVICE_URL=http://auth-service:3001
```

## Example Conversations

### English Example
```
User: What campaigns are active?
Bot: We currently have 5 active campaigns:

1. Help Build Schools in Rural Areas
   Goal: ৳500,000

2. Emergency Relief Fund
   Goal: ৳200,000

...
```

### Bangla Example
```
User: কোন ক্যাম্পেইন চলছে?
Bot: আমরা বর্তমানে ৫টি সক্রিয় ক্যাম্পেইন চালাচ্ছি:

১. গ্রামীণ এলাকায় স্কুল নির্মাণে সাহায্য করুন
   লক্ষ্য: ৳৫,০০,০০০

২. জরুরি ত্রাণ তহবিল
   লক্ষ্য: ৳২,০০,০০০

...
```

## Event Consumers

The chatbot subscribes to campaign events to keep its knowledge base updated:

- `CAMPAIGN_CREATED` - New campaign added
- `CAMPAIGN_UPDATED` - Campaign details changed
- `CAMPAIGN_ACTIVATED` - Campaign goes live
- `CAMPAIGN_GOAL_REACHED` - Fundraising goal achieved
- `CAMPAIGN_EXPIRED` - Campaign ended

## Development

### Running Locally
```bash
cd services/chatbot-service
npm install
npm run dev
```

### Running with Docker
```bash
docker-compose up chatbot-service
```

### Initialize Database
```bash
node src/utils/initDb.js
```

## Frontend Integration

Add the chat widget to your Next.js application:

```tsx
import ChatWidget from '@/components/ChatWidget';

export default function Layout({ children }) {
  return (
    <>
      {children}
      <ChatWidget />
    </>
  );
}
```

The widget provides:
- Floating chat button
- Expandable chat interface
- Language toggle (EN ⇄ বাং)
- Conversation reset
- Real-time messaging
- Loading indicators
- Error handling

## Testing Examples

### Test Bangla Greetings
```bash
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Content-Type: application/json" \
  -d '{
    "message": "হ্যালো",
    "language": "bn"
  }'
```

### Test Campaign Query
```bash
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me active campaigns"
  }'
```

### Test with Conversation Context
```bash
# First message
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Content-Type: application/json" \
  -d '{
    "message": "কোন ক্যাম্পেইন আছে?"
  }'

# Follow-up message (use conversationId from previous response)
curl -X POST http://localhost:3000/api/chat/messages \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "uuid-from-previous-response",
    "message": "প্রথমটি সম্পর্কে বলুন"
  }'
```

## Future Enhancements

Potential improvements for the chatbot:

- [ ] WebSocket support for real-time chat
- [ ] Voice input/output in Bangla
- [ ] Integration with external AI services (OpenAI, Anthropic)
- [ ] Multi-modal support (images, files)
- [ ] Admin dashboard for chat analytics
- [ ] Sentiment analysis
- [ ] Automated responses to common queries
- [ ] Integration with messaging platforms (WhatsApp, Messenger)
- [ ] Spell checking and auto-correction for Bangla
- [ ] More sophisticated NLP for Bangla text

## Contributing

When adding new features:

1. Add intent recognition in `banglaProcessor.js`
2. Create response templates in both languages
3. Update knowledge base integration as needed
4. Add tests for new intents
5. Update this README

## License

Part of the CareForAll Platform
