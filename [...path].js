const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL || 'postgresql://missing-database-url');
let schemaReady;
const ADMIN_EMAIL = () => (process.env.ADMIN_EMAIL || '').toLowerCase();
const ADMIN_PASSWORD = () => process.env.ADMIN_PASSWORD || '';
const ADMIN_SECRET = () => process.env.ADMIN_SECRET || '';
const seedEvents = [
  ['evt-techfest', 'TechFest 2026', 'Technology', '2026-11-14', '09:30', 'Innovation Hall', 240, 86, 'A student-led day of ideas, demos, coding challenges and conversations with industry mentors.', 'purple'],
  ['evt-cultural', 'Rangmanch Cultural Night', 'Culture', '2026-11-20', '18:00', 'Open Air Theatre', 500, 214, 'An evening celebrating music, dance, theatre and the many stories on our campus.', 'orange'],
  ['evt-sports', 'Inter-Department Sports Meet', 'Sports', '2026-11-27', '07:00', 'University Ground', 320, 176, 'Represent your department across athletics, football, cricket, badminton and more.', 'blue'],
  ['evt-design', 'Design Thinking Workshop', 'Workshop', '2026-12-03', '14:00', 'Studio 3', 60, 31, 'Learn practical tools to research, frame problems and prototype meaningful solutions.', 'green'],
  ['evt-career', 'Career Connect Summit', 'Career', '2026-12-09', '10:00', 'Seminar Block A', 180, 102, 'Meet recruiters, alumni and experts for an honest conversation about your next step.', 'rose'],
  ['evt-eco', 'Campus Green Day', 'Community', '2026-12-15', '08:00', 'Central Lawn', 150, 54, 'A hands-on morning of tree planting, upcycling and campus sustainability action.', 'teal']
];

function id(prefix) { return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`; }
function clean(value, max = 250) { return String(value || '').trim().replace(/[<>]/g, '').slice(0, max); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function send(res, status, data) { res.status(status).json(data); }
function error(res, status, message) { send(res, status, { error: message }); }
function dateText(value) { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value); }
function mapEvent(row) { return { ...row, date: dateText(row.date), capacity: Number(row.capacity), registered: Number(row.registered) }; }
function requestBody(req) { if (!req.body) return {}; if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } } return req.body; }

function sign(payload) { return crypto.createHmac('sha256', ADMIN_SECRET()).update(payload).digest('base64url'); }
function createToken(email) { const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url'); return `${payload}.${sign(payload)}`; }
function authorized(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''); const [payload, signature] = token.split('.');
  if (!payload || !signature || !ADMIN_SECRET()) return false;
  const expected = sign(payload); if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); return data.exp > Date.now() && data.email === ADMIN_EMAIL() ? data : false; } catch { return false; }
}
function requireAdmin(req, res) { if (!authorized(req)) { error(res, 401, 'Administrator access is required.'); return false; } return true; }

async function ensureSchema() {
  if (!process.env.DATABASE_URL) { const missing = new Error('DATABASE_URL is missing. Connect a Neon database in Vercel, then redeploy.'); missing.status = 503; throw missing; }
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, date DATE NOT NULL, event_time TEXT NOT NULL, location TEXT NOT NULL, capacity INTEGER NOT NULL, registered INTEGER NOT NULL DEFAULT 0, description TEXT NOT NULL, accent TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Open')`;
      await sql`CREATE TABLE IF NOT EXISTS registrations (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, event_title TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, department TEXT NOT NULL, phone TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(event_id, email))`;
      await sql`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
      await sql`CREATE TABLE IF NOT EXISTS subscribers (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
      const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM events`;
      if (Number(count) === 0) for (const event of seedEvents) await sql`INSERT INTO events (id,title,category,date,event_time,location,capacity,registered,description,accent) VALUES (${event[0]},${event[1]},${event[2]},${event[3]},${event[4]},${event[5]},${event[6]},${event[7]},${event[8]},${event[9]})`;
    })().catch((failure) => { schemaReady = undefined; throw failure; });
  }
  return schemaReady;
}

async function handler(req, res) {
  const route = new URL(req.url, 'https://campusconnect.local').pathname;
  await ensureSchema();
  if (req.method === 'GET' && route === '/api/events') {
    const events = await sql`SELECT id,title,category,date::text AS date,event_time AS time,location,capacity,registered,description,accent,status FROM events ORDER BY date,event_time`;
    return send(res, 200, { events: events.map(mapEvent) });
  }
  if (req.method === 'POST' && route === '/api/auth/login') {
    const input = requestBody(req); const email = clean(input.email, 120).toLowerCase();
    if (!ADMIN_EMAIL() || !ADMIN_PASSWORD() || !ADMIN_SECRET()) return error(res, 503, 'Administrator credentials are not configured yet.');
    if (email !== ADMIN_EMAIL() || input.password !== ADMIN_PASSWORD()) return error(res, 401, 'Incorrect administrator email or password.');
    return send(res, 200, { token: createToken(email), admin: { email } });
  }
  if (req.method === 'POST' && route === '/api/registrations') {
    const input = requestBody(req); const name = clean(input.name, 100); const email = clean(input.email, 120).toLowerCase(); const department = clean(input.department, 100); const phone = clean(input.phone, 30); const eventId = clean(input.eventId, 100);
    if (name.length < 2 || !validEmail(email) || department.length < 2 || phone.length < 7 || !eventId) return error(res, 400, 'Please complete every registration field with valid details.');
    const registrationId = id('reg');
    const result = await sql`WITH candidate AS (UPDATE events SET registered = registered + 1 WHERE id = ${eventId} AND status = 'Open' AND registered < capacity AND NOT EXISTS (SELECT 1 FROM registrations WHERE event_id = ${eventId} AND email = ${email}) RETURNING id,title) INSERT INTO registrations (id,event_id,event_title,name,email,department,phone) SELECT ${registrationId},id,title,${name},${email},${department},${phone} FROM candidate RETURNING id,event_id AS "eventId",event_title AS "eventTitle",name,email,department,phone,created_at AS "createdAt"`;
    if (!result.length) { const existing = await sql`SELECT 1 FROM registrations WHERE event_id = ${eventId} AND email = ${email}`; const event = await sql`SELECT capacity,registered,status FROM events WHERE id = ${eventId}`; if (existing.length) return error(res, 409, 'This email is already registered for this event.'); if (!event.length || event[0].status !== 'Open') return error(res, 404, 'This event is no longer accepting registrations.'); return error(res, 409, 'This event is full.'); }
    return send(res, 201, { message: `You are registered for ${result[0].eventTitle}.`, registration: result[0] });
  }
  if (req.method === 'POST' && route === '/api/contact') {
    const input = requestBody(req); const name = clean(input.name, 100); const email = clean(input.email, 120).toLowerCase(); const message = clean(input.message, 1000);
    if (name.length < 2 || !validEmail(email) || message.length < 10) return error(res, 400, 'Please add your name, a valid email, and a message of at least 10 characters.');
    await sql`INSERT INTO messages (id,name,email,message) VALUES (${id('msg')},${name},${email},${message})`; return send(res, 201, { message: 'Thanks — your message has been sent to the events team.' });
  }
  if (req.method === 'POST' && route === '/api/newsletter') {
    const input = requestBody(req); const email = clean(input.email, 120).toLowerCase(); if (!validEmail(email)) return error(res, 400, 'Enter a valid email address.');
    await sql`INSERT INTO subscribers (id,email) VALUES (${id('sub')},${email}) ON CONFLICT (email) DO NOTHING`; return send(res, 201, { message: 'You are on the CampusConnect update list.' });
  }
  if (req.method === 'GET' && route === '/api/dashboard') {
    if (!requireAdmin(req, res)) return;
    const [events, registrations, messages, subscribers] = await Promise.all([sql`SELECT id,title,category,date::text AS date,event_time AS time,location,capacity,registered,description,accent,status FROM events ORDER BY date,event_time`, sql`SELECT id,event_id AS "eventId",event_title AS "eventTitle",name,email,department,phone,created_at AS "createdAt" FROM registrations ORDER BY created_at DESC`, sql`SELECT id,name,email,message,created_at AS "createdAt" FROM messages ORDER BY created_at DESC`, sql`SELECT COUNT(*)::int AS count FROM subscribers`]);
    return send(res, 200, { stats: { events: events.length, registrations: registrations.length, messages: messages.length, subscribers: Number(subscribers[0].count) }, registrations, messages, events: events.map(mapEvent) });
  }
  if (req.method === 'POST' && route === '/api/events') {
    if (!requireAdmin(req, res)) return; const input = requestBody(req); const title = clean(input.title, 120); const category = clean(input.category, 50); const date = clean(input.date, 10); const time = clean(input.time, 5); const location = clean(input.location, 120); const description = clean(input.description, 500); const capacity = Number(input.capacity);
    if (title.length < 3 || !category || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !location || !description || !Number.isInteger(capacity) || capacity < 1 || capacity > 10000) return error(res, 400, 'Please complete the new event form with valid details.');
    const accent = ['purple','orange','blue','green','rose','teal'][Math.floor(Math.random() * 6)]; const event = { id: id('evt'), title, category, date, time, location, capacity, registered: 0, description, accent, status: 'Open' };
    await sql`INSERT INTO events (id,title,category,date,event_time,location,capacity,registered,description,accent,status) VALUES (${event.id},${title},${category},${date},${time},${location},${capacity},0,${description},${accent},'Open')`; return send(res, 201, { event });
  }
  const match = route.match(/^\/api\/events\/([\w-]+)$/);
  if (req.method === 'DELETE' && match) { if (!requireAdmin(req, res)) return; const removed = await sql`DELETE FROM events WHERE id = ${match[1]} RETURNING title`; if (!removed.length) return error(res, 404, 'Event not found.'); return send(res, 200, { message: `${removed[0].title} was deleted.` }); }
  if (req.method === 'GET' && route === '/api/export/registrations.csv') {
    if (!requireAdmin(req, res)) return; const registrations = await sql`SELECT id,event_title,name,email,department,phone,created_at FROM registrations ORDER BY created_at DESC`; const esc = (value) => `"${String(value || '').replace(/"/g, '""')}"`; const rows = [['Registration ID','Event','Name','Email','Department','Phone','Registered at'], ...registrations.map((r) => [r.id,r.event_title,r.name,r.email,r.department,r.phone,r.created_at])]; res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="campus-registrations.csv"'); return res.status(200).send(rows.map((row) => row.map(esc).join(',')).join('\n'));
  }
  return error(res, 404, 'API route not found.');
}

module.exports = async (req, res) => { try { await handler(req, res); } catch (failure) { console.error(failure); error(res, failure.status || 500, failure.message || 'Unexpected server error.'); } };
