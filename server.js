const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'products.json');
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'gotab2026';

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function auth(req, res) {
  if (req.headers['x-admin-pass'] !== ADMIN_PASS) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ── Public API ──
app.get('/api/products', (req, res) => res.json(readData()));

// ── Admin API — Products ──
app.post('/api/products', (req, res) => {
  if (!auth(req, res)) return;
  const data = readData();
  const p = { ...req.body, id: Date.now() };
  data.products.push(p);
  writeData(data);
  res.json(p);
});

app.put('/api/products/:id', (req, res) => {
  if (!auth(req, res)) return;
  const data = readData();
  const i = data.products.findIndex(p => p.id == req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Not found' });
  data.products[i] = { ...data.products[i], ...req.body };
  writeData(data);
  res.json(data.products[i]);
});

app.delete('/api/products/:id', (req, res) => {
  if (!auth(req, res)) return;
  const data = readData();
  data.products = data.products.filter(p => p.id != req.params.id);
  writeData(data);
  res.json({ ok: true });
});

// ── Admin API — Combos ──
app.post('/api/combos', (req, res) => {
  if (!auth(req, res)) return;
  const data = readData();
  const c = { ...req.body, id: Date.now() };
  data.combos.push(c);
  writeData(data);
  res.json(c);
});

app.put('/api/combos/:id', (req, res) => {
  if (!auth(req, res)) return;
  const data = readData();
  const i = data.combos.findIndex(c => c.id == req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Not found' });
  data.combos[i] = { ...data.combos[i], ...req.body };
  writeData(data);
  res.json(data.combos[i]);
});

app.delete('/api/combos/:id', (req, res) => {
  if (!auth(req, res)) return;
  const data = readData();
  data.combos = data.combos.filter(c => c.id != req.params.id);
  writeData(data);
  res.json({ ok: true });
});

// ── Lessons API ──
const LESSONS_FILE = path.join(__dirname, 'data', 'lessons.json');
function readLessons() {
  if (!fs.existsSync(LESSONS_FILE)) return { lessons: [] };
  return JSON.parse(fs.readFileSync(LESSONS_FILE, 'utf8'));
}
function writeLessons(data) {
  fs.writeFileSync(LESSONS_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/lessons', (_req, res) => res.json(readLessons()));

app.post('/api/lessons', (req, res) => {
  if (!auth(req, res)) return;
  const data = readLessons();
  const lesson = { ...req.body, id: `${req.body.grade}-${req.body.lesson_num}-${Date.now()}` };
  data.lessons.push(lesson);
  writeLessons(data);
  res.json(lesson);
});

app.put('/api/lessons/:id', (req, res) => {
  if (!auth(req, res)) return;
  const data = readLessons();
  const i = data.lessons.findIndex(l => l.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  data.lessons[i] = { ...data.lessons[i], ...req.body };
  writeLessons(data);
  res.json(data.lessons[i]);
});

app.delete('/api/lessons/:id', (req, res) => {
  if (!auth(req, res)) return;
  const data = readLessons();
  data.lessons = data.lessons.filter(l => l.id !== req.params.id);
  writeLessons(data);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GoTabAnim running on http://localhost:${PORT}`));
