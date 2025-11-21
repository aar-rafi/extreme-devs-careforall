require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3100;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'bull-board',
    timestamp: new Date().toISOString() 
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'bull-board is running',
    note: 'This is a placeholder - full implementation coming soon' 
  });
});

app.listen(PORT, () => {
  console.log(`bull-board running on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});
