'use strict';
/* ---------- Config ---------- */
// Stripe Payment Links (free). Dashboard > Payment links > + New. Paste each https://buy.stripe.com/... URL below.
const STRIPE_LINKS = {
  oneOff5: 'https://buy.stripe.com/REPLACE_ONE_OFF_5',   // Product "Donation", price GBP 5, One time
  monthly5: 'https://buy.stripe.com/REPLACE_MONTHLY_5',  // Same product, GBP 5, Recurring monthly
  custom: 'https://buy.stripe.com/REPLACE_CUSTOM',       // Price option "Customers choose what to pay"; set suggested amount 10 (also offer 25/50/100 in the description)
};
const KEYWORDS = ['transgender eligibility','non-binary','nonbinary','cisgender','trans women','transwomen','trans men','transman','trans','testosterone','puberty blocker','Tanner','female category','biological sex','Gender Recognition Certificate','assigned sex at birth'];
const NS = 'Not stated', KEY = 'sis:v1';
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

/* ---------- Pure helpers ---------- */
const esc = s => String(s ?? NS).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val = v => (v === null || v === undefined || v === '') ? NS : v;
function kwMatch(text) { // whole words only, case-insensitive: "trans" must not match "transport"
  return KEYWORDS.filter(k => new RegExp('(?<![A-Za-z0-9])' + k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?![A-Za-z0-9])', 'i').test(text));
}
const mins = t => { const m = /^(\d\d):(\d\d)$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
function range(s) { const a = mins(s.start_time); if (a === null || !DAYS.includes(s.day)) return null; const b = mins(s.end_time); return [a, b !== null && b > a ? b : a + 60]; }
function overlaps(sessions) { // sessions: chosen list. returns pairs that clash on same day
  const out = [];
  for (let i = 0; i < sessions.length; i++) for (let j = i + 1; j < sessions.length; j++) {
    const a = sessions[i], b = sessions[j], ra = range(a), rb = range(b);
    if (ra && rb && a.day === b.day && ra[0] < rb[1] && rb[0] < ra[1]) out.push([a, b]);
  } return out;
}
function parseTimeQuery(q) {
  const m = /^(\d{1,2})(?::(\d\d))?\s*(am|pm)?$/i.exec(q.trim()); if (!m || (!m[2] && !m[3])) return null;
  let h = +m[1]; const ap = (m[3] || '').toLowerCase(); if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
  return { h, m: m[2] !== undefined ? +m[2] : null };
}
const lev = (a, b) => { const d = Array.from({length: a.length + 1}, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1)); return d[a.length][b.length]; };
function fallbackSearch(items, keys, q) { // used only if fuse.min.js is missing
  const ql = q.toLowerCase(); return items.filter(it => keys.some(k => String(it[k] || '').toLowerCase().split(/\W+/).some(w => w.includes(ql) || (ql.length > 3 && lev(w, ql) <= 2)))).map(item => ({item, matches: []}));
}
const fmtDate = d => /^\d{4}-\d\d-\d\d$/.test(d || '') && !d.endsWith('-00') ? d.split('-').reverse().join('/') : val(d);
if (typeof module !== 'undefined') { module.exports = {kwMatch, overlaps, parseTimeQuery, lev}; }
if (typeof document === 'undefined') { /* node test mode */ } else {

/* ---------- State ---------- */
let D = {tt: [], bills: [], reports: [], articles: [], repMeta: {}, billMeta: {}, artMeta: {}};
let chosen = new Set(); try { chosen = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) {}
let tab = 'campaign', seg = 'parliament', chip = 'all', fuses = {};
const $ = s => document.querySelector(s), main = $('#main');
const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...chosen])); } catch (e) {} };
const byId = id => D.tt.find(s => s.id === id);
const chosenList = () => [...chosen].map(byId).filter(Boolean);

/* ---------- [+]/[-] buttons: one source of truth ---------- */
const pm = id => { const on = chosen.has(id); return `<button class="pm" data-pm="${id}" aria-pressed="${on}" aria-label="${on ? 'Remove from' : 'Add to'} my calendar">${on ? '−' : '+'}</button>`; };
function syncPm() { document.querySelectorAll('[data-pm]').forEach(b => { const on = chosen.has(b.dataset.pm); b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', (on ? 'Remove from' : 'Add to') + ' my calendar'); b.textContent = on ? '−' : '+'; }); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pm]'); if (!b) return; e.stopPropagation();
  const id = b.dataset.pm; chosen.has(id) ? chosen.delete(id) : chosen.add(id); save(); syncPm();
  if (tab === 'calendar') renderCalendar();
});

/* ---------- Sheet ---------- */
let lastFocus;
function openSheet(html) { lastFocus = document.activeElement; $('#sheetbody').innerHTML = html; $('#sheet').hidden = false; $('#sheetx').focus(); }
function closeSheet() { $('#sheet').hidden = true; lastFocus && lastFocus.focus(); }
$('#sheetx').onclick = closeSheet; $('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
const link = (u, label) => /^https?:/.test(u || '') ? `<p><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${label}</a></p>` : `<p>Link: ${NS}</p>`;
const field = (k, v) => `<p><b>${esc(k)}:</b> ${esc(val(Array.isArray(v) ? v.join(', ') : v))}</p>`;

/* ---------- Shared list ---------- */
function listView(items, o) { // o: {sort(item), title, date, summary, source, lastUpdated, detail(item)}
  const sorted = [...items].sort((a, b) => String(o.sort(b)).localeCompare(String(o.sort(a))));
  main.insertAdjacentHTML('beforeend', `<p class="meta">Last updated: ${esc(fmtDate(o.lastUpdated))}</p>` + (sorted.length ? '' : '<p>Nothing matches this filter.</p>'));
  sorted.forEach(it => { const b = document.createElement('button'); b.className = 'card';
    b.innerHTML = `<b>${esc(o.title(it))}</b><span class="meta">${esc(fmtDate(o.date(it)))} · ${esc(val(o.source(it)))}</span><br>${esc(val(it.summary)).slice(0, 110)}${(it.summary || '').length > 110 ? '…' : ''}`;
    b.onclick = () => openSheet(o.detail(it)); main.appendChild(b); });
}
const metaOf = (d, items) => ({last: (!Array.isArray(d) && d.last_updated) || items.map(i => i.date_checked).filter(Boolean).sort().pop() || NS});
const sample = it => it.sample ? ' [SAMPLE]' : '';

function renderCampaign() {
  main.innerHTML = `<div class="seg" role="group" aria-label="Campaign sections">${['parliament','reports','articles'].map(s => `<button data-seg="${s}" aria-pressed="${seg === s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>`;
  main.querySelectorAll('[data-seg]').forEach(b => b.onclick = () => { seg = b.dataset.seg; renderCampaign(); });
  if (seg === 'parliament') {
    const chips = [['all','All'],['bill','Bills'],['consultation','Consultations'],['lords_debate','Lords debates'],['upcoming','Upcoming'],['previous','Previous']];
    main.insertAdjacentHTML('beforeend', `<div class="chips">${chips.map(c => `<button class="chip" data-chip="${c[0]}" aria-pressed="${chip === c[0]}">${c[1]}</button>`).join('')}</div>`);
    main.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { chip = b.dataset.chip; renderCampaign(); });
    const items = D.bills.filter(i => chip === 'all' || i.type === chip || i.status === chip);
    listView(items, {sort: i => /^\d{4}/.test(i.date) ? i.date : '0', title: i => i.title, date: i => i.date, source: i => i.source_site, lastUpdated: D.billMeta.last,
      detail: i => `<h2 id="sheett">${esc(i.title)}</h2>${field('Type', i.original_type || i.type)}${field('Date', fmtDate(i.date))}${field('Status', i.status)}${field('Summary', i.summary)}${field('Matched keywords', i.matched_keywords)}${field('Source', i.source_site)}${link(i.source_url, 'Open source')}`});
  } else if (seg === 'reports') {
    listView(D.reports, {sort: i => i.date, title: i => i.title, date: i => i.date, source: () => 'SEEN in Sport', lastUpdated: D.repMeta.last,
      detail: i => `<h2 id="sheett">${esc(i.title)}</h2>${field('Date', fmtDate(i.date))}${field('Summary', i.summary)}${link(i.report_url, 'Open report')}`});
  } else {
    listView(D.articles, {sort: i => i.date_published_sort || i.date_published, title: i => i.published_title, date: i => i.date_published, source: i => i.publication, lastUpdated: D.artMeta.last,
      detail: i => `<h2 id="sheett">${esc(i.published_title)}</h2>${field('Publication', i.publication)}${field('Label', i.keyword_sport_label)}${field('Published', fmtDate(i.date_published))}${field('Summary', i.summary)}${field('Date checked', fmtDate(i.date_checked))}${field('Confidence', i.confidence)}${link(i.source_url, 'Open source')}`});
  }
}

/* ---------- Sessions ---------- */
const sessLine = s => `${val(s.session_name)} · ${val(s.day)} ${val(s.start_time)}${s.end_time !== NS ? '–' + s.end_time : ''}`;
function sessionDetail(s) { return `<h2 id="sheett">${esc(s.session_name)}</h2><p>${pm(s.id)}</p>` + ['sport','provider','venue','area','borough','region','postcode','date_or_recurrence','day','start_time','end_time','confidence','notes'].map(k => field(k.replace(/_/g, ' '), s[k])).join('') + link(s.source_url, 'Open source'); }
function sessRow(s, extra) { return `<div class="row"><button class="btn" data-open="${s.id}">${extra || esc(sessLine(s))}</button>${pm(s.id)}</div>`; }
document.addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) openSheet(sessionDetail(byId(b.dataset.open))); });

function renderClubs() {
  main.innerHTML = `<h2>Clubs near you</h2><div id="map" role="region" aria-label="Map of venues"></div><div id="mapmsg" class="note" hidden></div><h3>All venues</h3><div id="venues"></div>`;
  const venues = {}; D.tt.forEach(s => (venues[s.venue] = venues[s.venue] || []).push(s));
  const sheetFor = v => { const l = venues[v]; return `<h2 id="sheett">${esc(v)}</h2><p class="meta">${esc(l[0].borough)} · ${esc(l[0].postcode)}</p>` + l.map(s => sessRow(s)).join(''); };
  $('#venues').innerHTML = Object.keys(venues).map(v => `<button class="card" data-v="${esc(v)}"><b>${esc(v)}</b><span class="meta">${venues[v].length} session(s)</span></button>`).join('');
  $('#venues').querySelectorAll('[data-v]').forEach(b => b.onclick = () => openSheet(sheetFor(b.dataset.v)));
  const msg = t => { $('#mapmsg').hidden = false; $('#mapmsg').textContent = t; };
  if (typeof L === 'undefined') { $('#map').hidden = true; return msg('Map library (leaflet.js) is not in the project yet. See README step 1.'); }
  const map = L.map('map').setView([51.55, -0.05], 10);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: '© OpenStreetMap contributors', maxZoom: 18}).addTo(map);
  tiles.on('tileerror', () => msg("You're offline, so map tiles can't load. Pins and the venue list below still work."));
  if (!navigator.onLine) msg("You're offline, so map tiles can't load. Pins and the venue list below still work.");
  const pts = [];
  Object.keys(venues).forEach(v => { const s = venues[v].find(x => x.lat != null && x.lng != null); if (!s) return; pts.push([s.lat, s.lng]);
    L.marker([s.lat, s.lng], {keyboard: true, title: v, icon: L.divIcon({className: '', html: '<div style="width:22px;height:22px;background:#D10D0D;border:3px solid #252525;border-radius:50%"></div>', iconSize: [22, 22]})}).addTo(map).on('click', () => openSheet(sheetFor(v))); });
  if (pts.length) map.fitBounds(pts, {padding: [30, 30]}); else msg('No venues have coordinates yet, so no pins. Run geocode_postcodes.py (README step 3). Use the venue list below meanwhile.');
  setTimeout(() => map.invalidateSize(), 100);
}

/* ---------- Calendar ---------- */
function weekStart() { const w = D.tt.map(s => s.week_commencing).filter(x => /^\d{4}-/.test(x)).sort()[0] || '2026-11-09'; return new Date(w + 'T00:00:00Z'); }
function renderCalendar() {
  const list = chosenList(), ws = weekStart(), clashes = overlaps(list);
  const dates = DAYS.map((d, i) => { const x = new Date(ws); x.setUTCDate(x.getUTCDate() + i); return x.toISOString().slice(8, 10) + '/' + x.toISOString().slice(5, 7); });
  let h = `<h2>My Calendar</h2>`;
  if (clashes.length) h += `<div class="warn" role="alert">⚠ Clash: ` + clashes.map(([a, b]) => `${esc(a.session_name)} and ${esc(b.session_name)} (${esc(a.day)}) overlap`).join('; ') + `</div>`;
  h += `<p><button class="btn" id="ics">Export to phone calendar</button></p><div class="scroll"><table class="grid"><thead><tr><th scope="col">Time</th>${DAYS.map((d, i) => `<th scope="col">${d.slice(0, 3)} ${dates[i]}</th>`).join('')}</tr></thead><tbody>`;
  const bad = new Set(clashes.flat().map(s => s.id));
  for (let hr = 7; hr <= 22; hr++) { h += `<tr><th scope="row">${String(hr).padStart(2, '0')}:00</th>`;
    DAYS.forEach(d => { h += '<td>' + list.filter(s => s.day === d && range(s) && Math.floor(range(s)[0] / 60) === hr).map(s => `<div class="ev ${bad.has(s.id) ? 'clash' : ''}">${esc(s.session_name)} ${esc(s.start_time)} ${pm(s.id)}</div>`).join('') + '</td>'; }); h += '</tr>'; }
  h += '</tbody></table></div><h3>Chosen sessions by day</h3>';
  [...DAYS, NS].forEach(d => { const l = list.filter(s => (DAYS.includes(s.day) ? s.day : NS) === d).sort((a, b) => (mins(a.start_time) ?? 9999) - (mins(b.start_time) ?? 9999)); if (l.length) h += `<h4>${d === NS ? 'No fixed day/time (not in grid or export)' : d}</h4>` + l.map(s => sessRow(s, esc(`${val(s.start_time)} ${s.session_name} @ ${s.venue}`))).join(''); });
  if (!list.length) h += '<p>Nothing chosen yet. Add sessions below, from Clubs or from Search.</p>';
  h += '<h3>Browse all sessions</h3>' + D.tt.map(s => sessRow(s, esc(`${s.venue}: ${sessLine(s)}`))).join('');
  main.innerHTML = h; $('#ics').onclick = exportIcs;
}
function exportIcs() {
  const ws = weekStart(), z = n => String(n).padStart(2, '0'), out = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Seen in Sport//EN','CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE','TZID:Europe/London','BEGIN:DAYLIGHT','TZOFFSETFROM:+0000','TZOFFSETTO:+0100','TZNAME:BST','DTSTART:19700329T010000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU','END:DAYLIGHT','BEGIN:STANDARD','TZOFFSETFROM:+0100','TZOFFSETTO:+0000','TZNAME:GMT','DTSTART:19701025T020000','RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU','END:STANDARD','END:VTIMEZONE'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'; let n = 0;
  chosenList().forEach(s => { const r = range(s); if (!r) return; n++;
    const d = new Date(ws); d.setUTCDate(d.getUTCDate() + DAYS.indexOf(s.day)); const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
    const t = m => z(Math.floor(m / 60)) + z(m % 60) + '00';
    const ev = ['BEGIN:VEVENT', `UID:${s.id}@seen-in-sport`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Europe/London:${ymd}T${t(r[0])}`, `DTEND;TZID=Europe/London:${ymd}T${t(r[1])}`, `SUMMARY:${s.session_name.replace(/[,;]/g, ' ')}`, `LOCATION:${s.venue.replace(/[,;]/g, ' ')}`];
    if (/^(Weekly|Mondays)/.test(s.date_or_recurrence)) { const u = /until (\d\d)\/(\d\d)\/(\d{4})/i.exec(s.date_or_recurrence); ev.push('RRULE:FREQ=WEEKLY' + (u ? `;UNTIL=${u[3]}${u[2]}${u[1]}T235959Z` : '')); }
    ev.push(`DESCRIPTION:Source ${s.source_url}`, 'END:VEVENT'); out.push(...ev); });
  out.push('END:VCALENDAR'); if (!n) return alert('Choose at least one session with a stated day and start time first.');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out.join('\r\n')], {type: 'text/calendar'})); a.download = 'seen-in-sport.ics'; a.click();
}

/* ---------- Search ---------- */
function mkFuse(items, keys) { return typeof Fuse !== 'undefined' ? new Fuse(items, {keys, threshold: 0.4, includeMatches: true, ignoreLocation: true, minMatchCharLength: 2}) : null; }
function hl(text, matches, key, q) {
  text = String(val(text)); const m = (matches || []).find(x => x.key === key);
  const idx = m ? m.indices : (q ? [...text.toLowerCase().matchAll(new RegExp(q.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))].map(x => [x.index, x.index + q.length - 1]) : []);
  let o = '', p = 0; idx.filter(i => i[1] - i[0] >= 1 || q.length < 3).sort((a, b) => a[0] - b[0]).forEach(([s, e]) => { if (s < p) return; o += esc(text.slice(p, s)) + '<mark>' + esc(text.slice(s, e + 1)) + '</mark>'; p = e + 1; });
  return o + esc(text.slice(p));
}
function renderSearch() {
  const q = $('#q').value.trim(); main.innerHTML = '<h2>Search</h2>'; if (!q) { main.insertAdjacentHTML('beforeend', '<p>Try a sport, venue, borough, a time like 2pm or 14:00, or a topic. Typos are OK.</p>'); return; }
  const run = (name, items, keys) => { fuses[name] = fuses[name] || mkFuse(items, keys); return fuses[name] ? fuses[name].search(q).map(r => ({item: r.item, matches: r.matches})) : fallbackSearch(items, keys, q); };
  let sess = run('s', D.tt, ['sport','session_name','venue','borough']); const tq = parseTimeQuery(q);
  if (tq) sess = D.tt.filter(s => { const m = mins(s.start_time); return m !== null && Math.floor(m / 60) === tq.h && (tq.m === null || m % 60 === tq.m); }).map(item => ({item, matches: []}));
  const bills = run('b', D.bills, ['title','type']), reps = run('r', D.reports, ['title']), arts = run('a', D.articles, ['published_title','keyword_sport_label','publication']);
  const grp = (t, a, f) => a.length ? `<h3>${t} (${a.length})</h3>` + a.map(f).join('') : '';
  main.insertAdjacentHTML('beforeend',
    grp('Sessions', sess, r => { const s = r.item; return `<div class="row"><button class="btn" data-open="${s.id}">${hl(s.session_name, r.matches, 'session_name', q)} · ${hl(s.venue, r.matches, 'venue', q)} · ${esc(s.day)} ${esc(s.start_time)}</button>${pm(s.id)}</div>`; }) +
    grp('Parliament', bills, r => `<button class="card" data-b="${r.item.id}"><b>${hl(r.item.title, r.matches, 'title', q)}</b><span class="meta">${esc(r.item.original_type || r.item.type)}</span></button>`) +
    grp('Reports', reps, r => `<button class="card" data-r="${r.item.id}"><b>${hl(r.item.title, r.matches, 'title', q)}</b></button>`) +
    grp('Articles', arts, r => `<button class="card" data-a="${r.item.id}"><b>${hl(r.item.published_title, r.matches, 'published_title', q)}</b><span class="meta">${hl(r.item.publication, r.matches, 'publication', q)}</span></button>`));
  if (!sess.length && !bills.length && !reps.length && !arts.length) main.insertAdjacentHTML('beforeend', '<p>No matches. Try fewer letters.</p>');
  const go = (sel, key, arr, seg2) => main.querySelectorAll(sel).forEach(b => b.onclick = () => { seg = seg2; tab = 'campaign'; const it = arr.find(x => x.id === b.getAttribute(key)); openDetailFor(seg2, it); });
  go('[data-b]', 'data-b', D.bills, 'parliament'); go('[data-r]', 'data-r', D.reports, 'reports'); go('[data-a]', 'data-a', D.articles, 'articles');
}
function openDetailFor(kind, it) { // reuse the same detail templates as the lists
  const tmp = document.createElement('div'), keep = main.innerHTML; const save2 = main; tab = 'search';
  const f = {parliament: i => `<h2 id="sheett">${esc(i.title)}</h2>${field('Type', i.original_type || i.type)}${field('Date', fmtDate(i.date))}${field('Status', i.status)}${field('Summary', i.summary)}${field('Matched keywords', i.matched_keywords)}${link(i.source_url, 'Open source')}`,
    reports: i => `<h2 id="sheett">${esc(i.title)}</h2>${field('Date', fmtDate(i.date))}${field('Summary', i.summary)}${link(i.report_url, 'Open report')}`,
    articles: i => `<h2 id="sheett">${esc(i.published_title)}</h2>${field('Publication', i.publication)}${field('Published', fmtDate(i.date_published))}${field('Summary', i.summary)}${link(i.source_url, 'Open source')}`}[kind];
  openSheet(f(it));
}

/* ---------- Donate ---------- */
function renderDonate() {
  main.innerHTML = `<h2>Donate</h2><p>Free to use. If it helps, please support the campaign.</p>
  <p><a class="btn" href="${STRIPE_LINKS.oneOff5}" target="_blank" rel="noopener">£5 one-off</a> <a class="btn" href="${STRIPE_LINKS.monthly5}" target="_blank" rel="noopener">£5 monthly</a></p>
  <p>Choose your amount (suggested £10, £25, £50, £100):</p><p><a class="btn" href="${STRIPE_LINKS.custom}" target="_blank" rel="noopener">Choose amount</a></p>;
}

/* ---------- Router ---------- */
function render() {
  document.querySelectorAll('.tabs button').forEach(b => b.dataset.tab === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  $('#searchwrap').classList.toggle('hide', !(tab === 'campaign' || tab === 'search'));
  ({campaign: renderCampaign, clubs: renderClubs, calendar: renderCalendar, search: renderSearch, donate: renderDonate})[tab]();
}
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.tab; render(); main.focus(); });
$('#q').addEventListener('input', () => { if (tab !== 'search') { tab = 'search'; document.querySelectorAll('.tabs button').forEach(b => b.dataset.tab === 'search' ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')); } renderSearch(); });

/* ---------- Boot ---------- */
const get = f => fetch(f).then(r => r.json());
Promise.all([get('timetable.json'), get('parliament_bills.json'), get('reports.json'), get('articles.json')]).then(([t, b, r, a]) => {
  const arr = x => Array.isArray(x) ? x : x.items;
  D.tt = t; D.bills = arr(b); D.reports = arr(r); D.articles = arr(a);
  D.billMeta = {last: (!Array.isArray(b) && b.last_updated) || NS}; D.repMeta = {last: (!Array.isArray(r) && r.last_updated) || NS}; D.artMeta = {last: (!Array.isArray(a) && a.last_updated) || D.articles.map(i => i.date_checked).filter(Boolean).sort().pop() || NS};
  render();
}).catch(() => { main.innerHTML = '<p class="warn">Could not load data files. If opening index.html directly from disk, serve it with a local web server or GitHub Pages.</p>'; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
