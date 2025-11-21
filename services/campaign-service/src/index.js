require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'campaign-service',
    timestamp: new Date().toISOString() 
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'campaign-service is running',
    note: 'This is a placeholder - full implementation coming soon' 
  });
});

app.listen(PORT, () => {
  console.log(`campaign-service running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
