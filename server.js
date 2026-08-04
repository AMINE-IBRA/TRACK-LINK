const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch {
    /* ignore corrupt file */
  }
  return { links: {} };
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress ||
    'Unknown'
  );
}

app.post('/api/links', (req, res) => {
  const data = loadData();
  const id = uuidv4().slice(0, 8);
  const label = req.body.label || 'Untitled link';

  data.links[id] = {
    id,
    label,
    createdAt: new Date().toISOString(),
    visits: [],
  };

  saveData(data);
  res.json({ id, url: `/t/${id}` });
});

app.get('/api/links/:id', (req, res) => {
  const data = loadData();
  const link = data.links[req.params.id];

  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  res.json(link);
});

app.get('/api/links', (req, res) => {
  const data = loadData();
  const links = Object.values(data.links)
    .map(({ id, label, createdAt, visits }) => ({
      id,
      label,
      createdAt,
      visitCount: visits.length,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(links);
});

app.post('/api/track/:id', (req, res) => {
  const data = loadData();
  const link = data.links[req.params.id];

  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }

  const visit = {
    id: uuidv4().slice(0, 8),
    timestamp: new Date().toISOString(),
    ip: getClientIp(req),
    ...req.body,
  };

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

app.listen(PORT, () => {
  console.log(`Phone Track Link running at http://localhost:${PORT}`);
});
