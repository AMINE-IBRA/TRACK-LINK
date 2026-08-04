const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const DATA_FILE = process.env.VERCEL
  ? path.join('/tmp', 'data.json')
  : path.join(__dirname, 'data.json');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB if MONGODB_URI is configured
let isConnected = false;
async function connectDB() {
  if (isConnected || !MONGODB_URI) return;
  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log('Connected to MongoDB Atlas');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
  }
}

// Define Mongoose Schema for Link
const linkSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  label: { type: String, default: 'Untitled link' },
  createdAt: { type: String, default: () => new Date().toISOString() },
  visits: { type: Array, default: [] }
});

const LinkModel = mongoose.models.Link || mongoose.model('Link', linkSchema);

// Middleware to ensure DB connection on serverless calls
app.use(async (req, res, next) => {
  if (MONGODB_URI && !isConnected) {
    await connectDB();
  }
  next();
});

// JSON fallback functions
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch {}
  return { links: {} };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Save data error:', err);
  }
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress ||
    'Unknown'
  );
}

app.post('/api/links', async (req, res) => {
  const id = uuidv4().slice(0, 8);
  const label = req.body.label || 'Untitled link';

  if (MONGODB_URI && isConnected) {
    try {
      const linkDoc = new LinkModel({
        id,
        label,
        createdAt: new Date().toISOString(),
        visits: []
      });
      await linkDoc.save();
      return res.json({ id, url: `/t/${id}` });
    } catch (err) {
      console.error('Failed to create link in MongoDB:', err);
      return res.status(500).json({ error: 'Failed to create link' });
    }
  }

  // Fallback to local JSON
  const data = loadData();
  data.links[id] = {
    id,
    label,
    createdAt: new Date().toISOString(),
    visits: [],
  };
  saveData(data);
  res.json({ id, url: `/t/${id}` });
});

app.get('/api/links/:id', async (req, res) => {
  const { id } = req.params;

  if (MONGODB_URI && isConnected) {
    try {
      const link = await LinkModel.findOne({ id }).lean();
      if (!link) {
        return res.status(404).json({ error: 'Link not found' });
      }
      return res.json(link);
    } catch (err) {
      return res.status(500).json({ error: 'Database query error' });
    }
  }

  // Fallback to local JSON
  const data = loadData();
  const link = data.links[id];
  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }
  res.json(link);
});

app.get('/api/links', async (req, res) => {
  if (MONGODB_URI && isConnected) {
    try {
      const links = await LinkModel.find().lean();
      const formatted = links
        .map(({ id, label, createdAt, visits }) => ({
          id,
          label,
          createdAt,
          visitCount: visits ? visits.length : 0,
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json(formatted);
    } catch (err) {
      return res.status(500).json({ error: 'Database query error' });
    }
  }

  // Fallback to local JSON
  const data = loadData();
  const links = Object.values(data.links)
    .map(({ id, label, createdAt, visits }) => ({
      id,
      label,
      createdAt,
      visitCount: visits ? visits.length : 0,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(links);
});

app.post('/api/track/:id', async (req, res) => {
  const { id } = req.params;

  const visit = {
    id: uuidv4().slice(0, 8),
    timestamp: new Date().toISOString(),
    ip: getClientIp(req),
    ...req.body,
  };

  if (MONGODB_URI && isConnected) {
    try {
      const link = await LinkModel.findOne({ id });
      if (!link) {
        return res.status(404).json({ error: 'Link not found' });
      }
      link.visits.unshift(visit);
      await link.save();
      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to record visit' });
    }
  }

  // Fallback to local JSON
  const data = loadData();
  const link = data.links[id];
  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  link.visits.unshift(visit);
  saveData(data);
  res.json({ success: true });
});

app.get('/t/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'track.html'));
});

app.get('/dashboard/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

if (require.main === module) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Phone Track Link running at http://localhost:${PORT}`);
    });
  });
}

module.exports = app;
