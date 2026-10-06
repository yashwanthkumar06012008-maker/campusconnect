const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let events = [];
let activeCategory = 'All';
let visibleLimit = 6;
let adminToken = localStorage.getItem('campusconnect_admin_token') || '';

function escapeHtml(value = '') { const element = document.createElement('div'); element.textContent = value; return element.innerHTML; }
function prettyDate(date) { return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00`)); }
function relativeTime(value) { const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000)); if (minutes < 60) return `${minutes}m ago`; const hours = Math.round(minutes / 60); if (hours < 24) return `${hours}h ago`; return `${Math.round(hours / 24)}d ago`; }
function notify(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); clearTimeout(notify.timeout); notify.timeout = setTimeout(() => toast.classList.remove('show'), 3400); }
function feedback(form, message, isError = false) { const target = $('.form-feedback', form); if (!target) return; target.textContent = message; target.classList.toggle('error', isError); }
async function api(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  const response = await fetch(path, { ...options, headers });
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) { const error = new Error(payload.error || 'Something went wrong.'); error.status = response.status; throw error; }
  return payload;
}

function eventMarkup(event) {
  const [month, day] = prettyDate(event.date).split(' ');
  const remaining = Math.max(0, event.capacity - event.registered);
  return `<article class="event-card"><div class="event-card-top"><div class="event-date"><b class="day">${day}</b><span class="month">${month.toUpperCase()}<br>2026</span></div><span class="event-accent ${escapeHtml(event.accent || 'purple')}"></span></div><h3>${escapeHtml(event.title)}</h3><p class="meta"><span>◷</span>${escapeHtml(event.time)} <span>•</span> ${escapeHtml(event.location)}</p><p class="event-description">${escapeHtml(event.description)}</p><div class="event-card-footer"><span class="seats">${remaining ? `${remaining} seats left` : 'Waitlist only'}</span><button class="register-link" type="button" data-register="${escapeHtml(event.id)}">${remaining ? 'Register →' : 'Join waitlist →'}</button></div></article>`;
}
function renderEvents() {
  const query = $('#eventSearch').value.trim().toLowerCase();
  const filtered = events.filter((event) => (activeCategory === 'All' || event.category === activeCategory) && `${event.title} ${event.category} ${event.location} ${event.description}`.toLowerCase().includes(query));
  const display = filtered.slice(0, visibleLimit);
  $('#eventGrid').innerHTML = display.length ? display.map(eventMarkup).join('') : '<div class="empty-results">Nothing matches that search. Try a different word or category.</div>';
  const viewAll = $('#viewAll'); viewAll.hidden = filtered.length <= visibleLimit && activeCategory === 'All' && !query;
  viewAll.textContent = visibleLimit < filtered.length ? 'View all events →' : 'Show fewer events ↑';
}
async function loadEvents() {
  try { const data = await api('/api/events'); events = data.events; renderEvents(); }
  catch (error) { $('#eventGrid').innerHTML = '<div class="empty-results">We could not load events right now. Please refresh and try again.</div>'; }
}
function openModal(id) { const modal = document.getElementById(id); if (modal.open) return; modal.showModal(); }
function closeModal(id) { const modal = document.getElementById(id); if (modal.open) modal.close(); }
function beginRegistration(eventId) {
  const event = events.find((item) => item.id === eventId) || events[0];
  if (!event) return notify('Events are loading — please try again in a moment.');
  $('#selectedEventId').value = event.id; $('#selectedEventName').textContent = `${event.title} · ${prettyDate(event.date)} at ${event.time}`;
  $('#registrationSuccess').hidden = true; $('#registrationForm').hidden = false; feedback($('#registrationForm'), ''); openModal('registrationModal'); $('#registrationForm input[name="name"]').focus();
}
function setAdminMode(loggedIn) { $('#loginPanel').hidden = loggedIn; $('#dashboardPanel').hidden = !loggedIn; }
function stat(label, value) { return `<div class="dash-stat"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`; }
function renderDashboard(data) {
  $('#dashboardStats').innerHTML = [stat('events', data.stats.events), stat('registrations', data.stats.registrations), stat('messages', data.stats.messages), stat('subscribers', data.stats.subscribers)].join('');
  $('#adminEventList').innerHTML = data.events.length ? data.events.map((event) => `<div class="admin-event"><div><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(prettyDate(event.date))} · ${event.registered}/${event.capacity} registered</span></div><button class="delete-event" type="button" data-delete-event="${escapeHtml(event.id)}">Delete</button></div>`).join('') : '<p class="small-copy">No events have been created yet.</p>';
  $('#registrationRows').innerHTML = data.registrations.length ? data.registrations.slice(0, 12).map((registration) => `<tr><td>${escapeHtml(registration.name)}<br><small>${escapeHtml(registration.email)}</small></td><td>${escapeHtml(registration.eventTitle)}</td><td>${escapeHtml(registration.department)}</td><td>${relativeTime(registration.createdAt)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty-cell">No registrations yet — your new registrations will appear here.</td></tr>';
}
async function loadDashboard() {
  try { const data = await api('/api/dashboard'); setAdminMode(true); renderDashboard(data); }
  catch (error) { if (error.status === 401) { adminToken = ''; localStorage.removeItem('campusconnect_admin_token'); setAdminMode(false); } else notify(error.message); }
}

$('#menuButton').addEventListener('click', () => { const button = $('#menuButton'); const open = $('#mainNav').classList.toggle('open'); button.setAttribute('aria-expanded', String(open)); });
$$('.main-nav a').forEach((link) => link.addEventListener('click', () => { $('#mainNav').classList.remove('open'); $('#menuButton').setAttribute('aria-expanded', 'false'); }));
$('#heroRegister').addEventListener('click', () => beginRegistration(events[0]?.id));
$('#eventSearch').addEventListener('input', () => { visibleLimit = 6; renderEvents(); });
$('#categoryFilters').addEventListener('click', (event) => { const button = event.target.closest('[data-category]'); if (!button) return; activeCategory = button.dataset.category; visibleLimit = 6; $$('.filter').forEach((item) => item.classList.toggle('active', item === button)); renderEvents(); });
$('#eventGrid').addEventListener('click', (event) => { const button = event.target.closest('[data-register]'); if (button) beginRegistration(button.dataset.register); });
$('#viewAll').addEventListener('click', () => { const query = $('#eventSearch').value.trim(); const matches = events.filter((event) => (activeCategory === 'All' || event.category === activeCategory) && `${event.title} ${event.category} ${event.location} ${event.description}`.toLowerCase().includes(query.toLowerCase())); visibleLimit = visibleLimit < matches.length ? matches.length : 6; renderEvents(); if (visibleLimit === 6) $('#events').scrollIntoView({ behavior: 'smooth' }); });

$$('[data-close]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.close)));
$$('dialog').forEach((modal) => modal.addEventListener('click', (event) => { if (event.target === modal) modal.close(); }));
$('#registrationForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const submit = $('button[type="submit"]', form); submit.disabled = true; feedback(form, 'Saving your spot…'); try { const response = await api('/api/registrations', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); $('#successText').textContent = response.message; form.hidden = true; $('#registrationSuccess').hidden = false; form.reset(); await loadEvents(); } catch (error) { feedback(form, error.message, true); } finally { submit.disabled = false; } });
$('#contactForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const button = $('button', form); button.disabled = true; feedback(form, 'Sending…'); try { const response = await api('/api/contact', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); feedback(form, response.message); form.reset(); } catch (error) { feedback(form, error.message, true); } finally { button.disabled = false; } });
$('#newsletterForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const button = $('button', form); button.disabled = true; try { const response = await api('/api/newsletter', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); feedback(form.parentElement, response.message); form.reset(); } catch (error) { feedback(form.parentElement, error.message, true); } finally { button.disabled = false; } });

$('#adminButton').addEventListener('click', () => { openModal('adminModal'); if (adminToken) loadDashboard(); else setAdminMode(false); });
$('#adminLoginForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const button = $('button', form); button.disabled = true; feedback(form, 'Signing in…'); try { const response = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); adminToken = response.token; localStorage.setItem('campusconnect_admin_token', adminToken); form.reset(); await loadDashboard(); } catch (error) { feedback(form, error.message, true); } finally { button.disabled = false; } });
$('#logoutButton').addEventListener('click', () => { adminToken = ''; localStorage.removeItem('campusconnect_admin_token'); setAdminMode(false); notify('You have been signed out.'); });
$('#eventForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const button = $('button', form); button.disabled = true; feedback(form, 'Creating event…'); try { const response = await api('/api/events', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); feedback(form, `${response.event.title} is live.`); form.reset(); await Promise.all([loadEvents(), loadDashboard()]); } catch (error) { feedback(form, error.message, true); } finally { button.disabled = false; } });
$('#adminEventList').addEventListener('click', async (event) => { const button = event.target.closest('[data-delete-event]'); if (!button || !confirm('Delete this event? Existing registrations will remain in the data file.')) return; button.disabled = true; try { const response = await api(`/api/events/${button.dataset.deleteEvent}`, { method: 'DELETE' }); notify(response.message); await Promise.all([loadEvents(), loadDashboard()]); } catch (error) { notify(error.message); button.disabled = false; } });
$('#exportRegistrations').addEventListener('click', async () => { try { const response = await fetch('/api/export/registrations.csv', { headers: { Authorization: `Bearer ${adminToken}` } }); if (!response.ok) throw new Error('Could not prepare the export.'); const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = 'campus-registrations.csv'; link.click(); URL.revokeObjectURL(url); notify('Registration CSV downloaded.'); } catch (error) { notify(error.message); } });
loadEvents();
