/**
 * CampusConnect - dependency-free local server
 * Start with: node server.js
 */
const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
// Set DATA_DIR on a host with persistent storage (for example, /var/data on Render).
// Local development continues to use the project's data folder by default.
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const DB_FILE = path.join(DATA_DIR, 'campus-data.json');
const sessions = new Map();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@campus.edu';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'campus2026';

const seed = {
  events: [
    { id: 'evt-techfest', title: 'TechFest 2026', category: 'Technology', date: '2026-11-14', time: '09:30', location: 'Innovation Hall', capacity: 240, registered: 86, description: 'A student-led day of ideas, demos, coding challenges and conversations with industry mentors.', accent: 'purple', status: 'Open' },
    { id: 'evt-cultural', title: 'Rangmanch Cultural Night', category: 'Culture', date: '2026-11-20', time: '18:00', location: 'Open Air Theatre', capacity: 500, registered: 214, description: 'An evening celebrating music, dance, theatre and the many stories on our campus.', accent: 'orange', status: 'Open' },
    { id: 'evt-sports', title: 'Inter-Department Sports Meet', category: 'Sports', date: '2026-11-27', time: '07:00', location: 'University Ground', capacity: 320, registered: 176, description: 'Represent your department across athletics, football, cricket, badminton and more.', accent: 'blue', status: 'Open' },
    { id: 'evt-design', title: 'Design Thinking Workshop', category: 'Workshop', date: '2026-12-03', time: '14:00', location: 'Studio 3', capacity: 60, registered: 31, description: 'Learn practical tools to research, frame problems and prototype meaningful solutions.', accent: 'green', status: 'Open' },
    { id: 'evt-career', title: 'Career Connect Summit', category: 'Career', date: '2026-12-09', time: '10:00', location: 'Seminar Block A', capacity: 180, registered: 102, description: 'Meet recruiters, alumni and experts for an honest conversation about your next step.', accent: 'rose', status: 'Open' },
    { id: 'evt-eco', title: 'Campus Green Day', category: 'Community', date: '2026-12-15', time: '08:00', location: 'Central Lawn', capacity: 150, registered: 54, description: 'A hands-on morning of tree planting, upcycling and campus sustainability action.', accent: 'teal', status: 'Open' }
  ],
  registrations: [],
  messages: [],
  subscribers: []
};

async function ensureDb() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try { await fsp.access(DB_FILE); }
  catch { await writeDb(seed); }
}
async function readDb() { return JSON.parse(await fsp.readFile(DB_FILE, 'utf8')); }
async function writeDb(data) {
  const temp = `${DB_FILE}.${process.pid}.tmp`;
  await fsp.writeFile(temp, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(temp, DB_FILE);
}
function id(prefix) { return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`; }
function send(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(data));
}
function text(res, status, content, type = 'text/plain; charset=utf-8', headers = {}) {
  res.writeHead(status, { 'Content-Type': type, ...headers }); res.end(content);
}
function getToken(req) { return (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); }
function admin(req) { const record = sessions.get(getToken(req)); return record && record.expires > Date.now() ? record : null; }
async function body(req) {
  let raw = ''; for await (const part of req) { raw += part; if (raw.length > 1_000_000) throw Error('Request too large'); }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw Error('Invalid JSON body'); }
}
function clean(value, max = 250) { return String(value || '').trim().replace(/[<>]/g, '').slice(0, max); }
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function apiError(res, status, message) { send(res, status, { error: message }); }
function protectedRoute(req, res) { if (!admin(req)) { apiError(res, 401, 'Administrator access is required.'); return false; } return true; }

async function handleApi(req, res, url) {
  const route = url.pathname;
  if (req.method === 'GET' && route === '/api/events') {
    const data = await readDb(); return send(res, 200, { events: data.events.sort((a, b) => a.date.localeCompare(b.date)) });
  }
  if (req.method === 'POST' && route === '/api/auth/login') {
    const input = await body(req); const email = clean(input.email, 120).toLowerCase();
    if (email !== ADMIN_EMAIL.toLowerCase() || input.password !== ADMIN_PASSWORD) return apiError(res, 401, 'Incorrect administrator email or password.');
    const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { email, expires: Date.now() + 8 * 60 * 60 * 1000 });
    return send(res, 200, { token, admin: { email } });
  }
  if (req.method === 'POST' && route === '/api/registrations') {
    const input = await body(req); const name = clean(input.name, 100); const email = clean(input.email, 120).toLowerCase();
    const department = clean(input.department, 100); const phone = clean(input.phone, 30); const eventId = clean(input.eventId, 100);
    if (name.length < 2 || !validEmail(email) || department.length < 2 || phone.length < 7 || !eventId) return apiError(res, 400, 'Please complete every registration field with valid details.');
    const data = await readDb(); const event = data.events.find((item) => item.id === eventId);
    if (!event || event.status !== 'Open') return apiError(res, 404, 'This event is no longer accepting registrations.');
    if (event.registered >= event.capacity) return apiError(res, 409, 'This event is full.');
    if (data.registrations.some((item) => item.eventId === eventId && item.email === email)) return apiError(res, 409, 'This email is already registered for this event.');
    const registration = { id: id('reg'), eventId, eventTitle: event.title, name, email, department, phone, createdAt: new Date().toISOString() };
    data.registrations.push(registration); event.registered += 1; await writeDb(data);
    return send(res, 201, { message: `You are registered for ${event.title}.`, registration });
  }
  if (req.method === 'POST' && route === '/api/contact') {
    const input = await body(req); const name = clean(input.name, 100); const email = clean(input.email, 120).toLowerCase(); const message = clean(input.message, 1000);
    if (name.length < 2 || !validEmail(email) || message.length < 10) return apiError(res, 400, 'Please add your name, a valid email, and a message of at least 10 characters.');
    const data = await readDb(); data.messages.push({ id: id('msg'), name, email, message, createdAt: new Date().toISOString() }); await writeDb(data);
    return send(res, 201, { message: 'Thanks — your message has been sent to the events team.' });
  }
  if (req.method === 'POST' && route === '/api/newsletter') {
    const input = await body(req); const email = clean(input.email, 120).toLowerCase(); if (!validEmail(email)) return apiError(res, 400, 'Enter a valid email address.');
    const data = await readDb(); if (!data.subscribers.some((item) => item.email === email)) { data.subscribers.push({ id: id('sub'), email, createdAt: new Date().toISOString() }); await writeDb(data); }
    return send(res, 201, { message: 'You are on the CampusConnect update list.' });
  }
  if (req.method === 'GET' && route === '/api/dashboard') {
    if (!protectedRoute(req, res)) return; const data = await readDb();
    return send(res, 200, { stats: { events: data.events.length, registrations: data.registrations.length, messages: data.messages.length, subscribers: data.subscribers.length }, registrations: data.registrations.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt)), messages: data.messages.slice().sort((a,b) => b.createdAt.localeCompare(a.createdAt)), events: data.events });
  }
  if (req.method === 'POST' && route === '/api/events') {
    if (!protectedRoute(req, res)) return; const input = await body(req); const title = clean(input.title, 120); const category = clean(input.category, 50); const date = clean(input.date, 10); const time = clean(input.time, 5); const location = clean(input.location, 120); const description = clean(input.description, 500); const capacity = Number(input.capacity);
    if (title.length < 3 || !category || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !location || !description || !Number.isInteger(capacity) || capacity < 1 || capacity > 10000) return apiError(res, 400, 'Please complete the new event form with valid details.');
    const data = await readDb(); const event = { id: id('evt'), title, category, date, time, location, capacity, registered: 0, description, accent: ['purple','orange','blue','green','rose','teal'][data.events.length % 6], status: 'Open' }; data.events.push(event); await writeDb(data); return send(res, 201, { event });
  }
  const eventMatch = route.match(/^\/api\/events\/([\w-]+)$/);
  if (eventMatch && req.method === 'DELETE') {
    if (!protectedRoute(req, res)) return; const data = await readDb(); const idx = data.events.findIndex((event) => event.id === eventMatch[1]); if (idx < 0) return apiError(res, 404, 'Event not found.');
    const [removed] = data.events.splice(idx, 1); await writeDb(data); return send(res, 200, { message: `${removed.title} was deleted.` });
  }
  if (req.method === 'GET' && route === '/api/export/registrations.csv') {
    if (!protectedRoute(req, res)) return; const data = await readDb();
    const esc = (value) => `"${String(value || '').replace(/"/g, '""')}"`;
    const rows = [['Registration ID','Event','Name','Email','Department','Phone','Registered at'], ...data.registrations.map((r) => [r.id,r.eventTitle,r.name,r.email,r.department,r.phone,r.createdAt])];
    return text(res, 200, rows.map((row) => row.map(esc).join(',')).join('\n'), 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="campus-registrations.csv"' });
  }
  return apiError(res, 404, 'API route not found.');
}

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
async function staticFile(req, res, url) {
  let relative = decodeURIComponent(url.pathname); if (relative === '/') relative = '/index.html';
  const file = path.resolve(PUBLIC_DIR, `.${relative}`); if (!file.startsWith(`${PUBLIC_DIR}${path.sep}`)) return text(res, 403, 'Forbidden');
  try { const info = await fsp.stat(file); if (!info.isFile()) return text(res, 404, 'Not found'); const content = await fsp.readFile(file); return text(res, 200, content, mime[path.extname(file)] || 'application/octet-stream'); }
  catch { return text(res, 404, 'Not found'); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try { if (url.pathname.startsWith('/api/')) await handleApi(req, res, url); else await staticFile(req, res, url); }
  catch (error) { console.error(error); apiError(res, 500, error.message || 'Unexpected server error.'); }
});
ensureDb().then(() => server.listen(PORT, () => console.log(`CampusConnect is running at http://localhost:${PORT}`)));
