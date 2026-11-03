// Loads usage.json and renders the usage page. What to show (ranking, stale
// notes, the reset calendar, formatting) comes from rank.js; this file only
// fetches and builds DOM. Every piece of text is set with textContent.
import {
  COLORS, STALE_BANNER_MINUTES,
  effectiveWeekly, effectiveWindow, rankClaude, calendarLanes, dayColumns, freshness,
  fmtTime, fmtZone, fmtDaysLeft, fmtTokens,
} from './rank.js';

const ERROR_TEXT = 'Could not load usage data.';
const RENDER_EVERY_MS = 60 * 1000;
const FETCH_EVERY_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const CALENDAR_DAYS = 8;

// rank.js gives this note when a reading has no reset time; the reset cell
// says it instead of the name column.
const RESET_UNKNOWN = 'reset time known after next use';

// Column names, repeated in each cell for the stacked phone layout.
const CAPTION = {
  all: 'Week · all models',
  fable: 'Week · Fable',
  reset: 'Week resets',
  tokens: 'Tokens this week',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Labels for the keys of a Claude account's usage split (`breakdown`).
const BREAKDOWN_LABELS = Object.freeze({
  claude_code: 'Claude Code',
  chat: 'Chats',
  cowork: 'Cowork',
  other: 'Other',
});

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clampPct = (v) => Math.min(100, Math.max(0, v));
const pctText = (v) => `${v.toFixed(3)}%`;

// ---------------------------------------------------------------------------
// DOM helpers

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

// Only the four known ids get their fixed color; anything else is neutral.
function colorClass(id) {
  return typeof id === 'string' && Object.hasOwn(COLORS, id) ? `c-${id}` : 'c-other';
}

// ---------------------------------------------------------------------------
// Data

const view = {
  page: document.getElementById('page'),
  banner: document.getElementById('banner'),
  header: document.getElementById('header'),
  rows: document.getElementById('rows'),
  rowList: document.getElementById('row-list'),
  tokensHead: document.getElementById('tokens-head'),
  tokensNote: document.getElementById('tokens-note'),
  calGrid: document.getElementById('cal-grid'),
  footNote: document.getElementById('foot-note'),
};

const gist = {
  id: (document.body.dataset.gistId || '').trim(),
  file: (document.body.dataset.gistFile || '').trim() || 'usage.json',
};

// Dev override: `?src=/usage.json` reads a file from this same origin. Only a
// path on this origin is accepted, never another host.
function devSource() {
  let value;
  try {
    value = new URLSearchParams(location.search).get('src');
  } catch {
    return null;
  }
  if (!value || value[0] !== '/') return null;
  try {
    const url = new URL(value, location.origin);
    return url.origin === location.origin ? url.href : null;
  } catch {
    return null;
  }
}

function sources() {
  const dev = devSource();
  if (dev) return [{ url: dev }];
  if (!gist.id) return [];
  const id = encodeURIComponent(gist.id);
  return [
    // A fresh query string misses the CDN cache and has no rate limit.
    { url: `https://gist.githubusercontent.com/androidside/${id}/raw/${encodeURIComponent(gist.file)}?t=${Date.now()}` },
    // Fresh too, but 60 requests per hour per address.
    { url: `https://api.github.com/gists/${id}`, file: gist.file },
  ];
}

function isUsageDoc(doc) {
  return Boolean(doc) && typeof doc === 'object' && doc.schema === 1 && Array.isArray(doc.accounts);
}

function timeoutSignal() {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(FETCH_TIMEOUT_MS)
    : undefined;
}

// The first source that answers with a valid document, else null.
async function loadData() {
  for (const source of sources()) {
    try {
      const res = await fetch(source.url, { cache: 'no-store', signal: timeoutSignal() });
      if (!res.ok) continue;
      let doc = await res.json();
      if (source.file) {
        const files = doc && doc.files;
        const entry = files && Object.hasOwn(files, source.file) ? files[source.file] : null;
        doc = entry && typeof entry.content === 'string' ? JSON.parse(entry.content) : null;
      }
      if (isUsageDoc(doc)) return doc;
    } catch {
      // Try the next source.
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Header

function buildHeader(ranking, fresh, nowMs) {
  const verdict = el('div', 'v');
  const headline = el('h1', 'headline');
  const id = ranking.verdict ? ranking.verdict.id : null;
  if (id && ranking.headline.endsWith(id)) {
    headline.append(ranking.headline.slice(0, -id.length), el('span', `nm ${colorClass(id)}`, id));
  } else {
    headline.textContent = ranking.headline;
  }
  verdict.append(headline);
  if (ranking.sub) verdict.append(el('p', 'sub', ranking.sub));

  const upd = el('div', 'upd');
  const line = el('p', 'fresh');
  line.append(el('i', fresh.stale ? 'live stale' : 'live'), fresh.text);
  upd.append(line, el('p', 'clock', `local time · ${fmtTime(nowMs, nowMs)} ${fmtZone(nowMs)}`.trim()));
  return [verdict, upd];
}

// ---------------------------------------------------------------------------
// Rows

function nameCell(acc, lines) {
  const cell = el('div', 'name');
  cell.append(el('span', 'dot'), el('span', 'nm', acc.id));
  cell.append(...lines.filter(Boolean));
  return cell;
}

// One weekly measure: bar filled to the percent left, "<left>% left" bold,
// "<used>% used" small; dashes without a reading. `win` has usedPct and
// leftPct (from rank.js).
function measureCell(caption, win, extraClass = '', barClass = 'bar') {
  const cell = el('div', `cell ${extraClass}`.trim());
  cell.append(el('span', 'cap', caption));
  const pct = el('div', 'pct');
  if (!win) {
    pct.append(el('b', null, '-'));
    cell.append(pct);
    return cell;
  }
  const bar = el('div', barClass);
  const fill = el('i', 'fill');
  fill.style.width = `${clampPct(win.leftPct)}%`;
  bar.append(fill);
  pct.append(el('b', null, `${Math.round(win.leftPct)}% left`), el('small', null, `${Math.round(win.usedPct)}% used`));
  cell.append(bar, pct);
  return cell;
}

function resetCell(eff, nowMs) {
  const cell = el('div', 'reset');
  cell.append(el('span', 'cap', CAPTION.reset));
  if (!eff.hasReading) {
    cell.append(el('span', 'when', '-'));
  } else if (eff.resetKnown) {
    cell.append(el('span', 'when', fmtTime(eff.resetsAtMs, nowMs)), el('small', null, fmtDaysLeft(eff.resetsAtMs, nowMs)));
  } else {
    cell.append(el('span', 'when', 'not known yet'), el('small', null, 'shows after next use'));
  }
  return cell;
}

// When the account's weekly window began, or null.
function windowStartMs(acc) {
  const w = acc.weekly;
  if (!w || typeof w !== 'object') return null;
  const started = typeof w.window_started_at === 'string' ? Date.parse(w.window_started_at) : NaN;
  if (!Number.isNaN(started)) return started;
  const resets = typeof w.resets_at === 'string' ? Date.parse(w.resets_at) : NaN;
  if (isNum(w.window_minutes) && !Number.isNaN(resets)) return resets - w.window_minutes * 60 * 1000;
  return null;
}

// "since Nov 1" while token counting began after this week's window opened.
// Codex reports its own daily totals for the whole window, so its figure is
// never partial.
function sinceNote(acc, tokensSince, nowMs) {
  if (acc.kind === 'codex') return null;
  if (typeof tokensSince !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(tokensSince)) return null;
  const sinceMs = Date.parse(`${tokensSince}T00:00:00Z`);
  if (Number.isNaN(sinceMs)) return null;
  const start = windowStartMs(acc);
  const partial = start === null ? nowMs - sinceMs < 7 * DAY_MS : sinceMs > start;
  if (!partial) return null;
  const d = new Date(sinceMs);
  return `since ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

// "Claude Code 95% · Cowork 5%": where this week's Claude usage went, rows
// above 0% only. Nothing once the weekly reset has passed, since the split
// belongs to the window that ended.
function breakdownLine(acc, nowMs) {
  if (!Array.isArray(acc.breakdown) || effectiveWindow(acc.weekly, nowMs).resetPassedAtMs !== null) return null;
  const parts = acc.breakdown
    .filter((row) => row && typeof row.key === 'string' && isNum(row.pct) && row.pct > 0)
    .map((row) => {
      const label = Object.hasOwn(BREAKDOWN_LABELS, row.key) ? BREAKDOWN_LABELS[row.key] : row.key.replace(/_/g, ' ');
      return `${label} ${Math.round(row.pct)}%`;
    });
  return parts.length ? el('small', 'split', parts.join(' · ')) : null;
}

// One note for the whole table: the collector gives every Claude account the
// same unattributed total, so it is not a per-row figure.
function unattributedNote(accounts) {
  for (const acc of accounts) {
    const t = acc && acc.kind === 'claude' ? acc.tokens_week : null;
    if (t && typeof t === 'object' && isNum(t.unattributed_total) && t.unattributed_total > 0) {
      return `+${fmtTokens(t.unattributed_total)} unattributed`;
    }
  }
  return '';
}

function tokensCell(acc, tokensSince, nowMs, split = null) {
  const cell = el('div', 'tok');
  cell.append(el('span', 'cap', CAPTION.tokens));
  const t = acc.tokens_week;
  if (!t || typeof t !== 'object' || !isNum(t.total)) {
    cell.append(el('span', 'total', '-'));
    if (split) cell.append(split);
    return cell;
  }
  const parts = [['input', t.input], ['output', t.output], ['cache read', t.cache_read], ['cache write', t.cache_write]]
    .filter(([, n]) => isNum(n));
  if (parts.length) cell.title = parts.map(([k, n]) => `${k} ${fmtTokens(n)}`).join(' · ');

  cell.append(el('span', 'total', fmtTokens(t.total)));
  if (split) cell.append(split);
  if (isNum(t.input) && isNum(t.output)) cell.append(el('small', null, `in+out ${fmtTokens(t.input + t.output)}`));
  if (acc.kind === 'codex' && Number.isInteger(acc.streak_days) && acc.streak_days > 0) {
    cell.append(el('small', null, `${acc.streak_days}-day streak`));
  }
  const since = sinceNote(acc, tokensSince, nowMs);
  if (since) cell.append(el('small', null, since));
  return cell;
}

// "5 h window 40% · resets 2:59 AM"; nothing once that window has ended.
function sessionLine(acc, nowMs) {
  const win = effectiveWindow(acc.session, nowMs);
  if (!win.hasReading || win.resetPassedAtMs !== null) return null;
  const used = `5 h window ${Math.round(win.usedPct)}%`;
  return el('small', 's5', win.resetKnown ? `${used} · resets ${fmtTime(win.resetsAtMs, nowMs)}` : used);
}

function noteLine(eff) {
  return eff.note && eff.note !== RESET_UNKNOWN ? el('small', 'note', eff.note) : null;
}

function claudeRow(row, isVerdict, ctx) {
  const { acc, eff } = row;
  const { nowMs } = ctx;
  const r = el('div', ['r', colorClass(acc.id), isVerdict ? 'go' : '', row.excluded ? 'dim' : ''].filter(Boolean).join(' '));
  r.append(el('div', 'n', row.rank === null ? '·' : String(row.rank)));
  r.append(nameCell(acc, [
    isVerdict ? el('small', 'tag-go', 'start here') : (acc.plan ? el('small', 'plan', acc.plan) : null),
    acc.session ? sessionLine(acc, nowMs) : null,
    noteLine(eff),
    acc.extra_usage_enabled === true ? el('small', 'tag', 'extra usage on') : null,
  ]));

  // The usage split sits under the tokens total, or under this bar when the
  // page has no tokens column.
  const split = breakdownLine(acc, nowMs);
  const all = measureCell(CAPTION.all, eff.hasReading ? eff : null, 'all');
  if (split && !ctx.hasTokens) all.append(split);
  r.append(all);
  const fable = effectiveWindow(acc.weekly_fable, nowMs);
  const fableCell = measureCell(CAPTION.fable, fable.hasReading ? fable : null, 'fable');
  r.append(fableCell);
  r.append(resetCell(eff, nowMs));
  if (ctx.hasTokens) r.append(tokensCell(acc, ctx.tokensSince, nowMs, split));
  return r;
}

// "5 h window", "7 day window"; Codex reports the length in minutes.
function windowName(win) {
  const m = win && win.window_minutes;
  if (!isNum(m) || m <= 0) return 'second window';
  if (m % 1440 === 0) return `${m / 1440} day window`;
  if (m % 60 === 0) return `${m / 60} h window`;
  return `${m} min window`;
}

function codexRow(acc, ctx) {
  const { nowMs } = ctx;
  const eff = effectiveWeekly(acc, nowMs);
  const r = el('div', ['r', colorClass(acc.id), eff.blocked ? 'dim' : ''].filter(Boolean).join(' '));
  r.append(el('div', 'n', '·'));
  r.append(nameCell(acc, [
    acc.plan ? el('small', 'plan', acc.plan) : null,
    noteLine(eff),
    acc.credits === true ? el('small', 'tag', 'has credits') : null,
  ]));
  r.append(measureCell(CAPTION.all, eff.hasReading ? eff : null, 'all'));

  // Codex has no Fable limit; its second window, when it reports one, goes here.
  const sec = effectiveWindow(acc.secondary, nowMs);
  if (sec.hasReading) {
    const cell = measureCell(windowName(acc.secondary), sec, 'fable second', 'bar thin');
    const resets = sec.resetKnown ? `resets ${fmtTime(sec.resetsAtMs, nowMs)}` : RESET_UNKNOWN;
    cell.append(el('small', 'win', `${windowName(acc.secondary)} · ${resets}`));
    r.append(cell);
  } else {
    const cell = el('div', 'cell fable');
    cell.append(el('span', 'cap', CAPTION.fable), el('span', 'none', 'no model-scoped limit'));
    r.append(cell);
  }
  r.append(resetCell(eff, nowMs));
  if (ctx.hasTokens) r.append(tokensCell(acc, ctx.tokensSince, nowMs));
  return r;
}

function buildRows(ranking, accounts, ctx) {
  const nodes = ranking.rows.map((row) => claudeRow(row, Boolean(ranking.verdict) && row.rank === 1, ctx));
  const others = accounts.filter((acc) => acc && acc.kind === 'codex');
  if (others.length) {
    nodes.push(el('div', 'sep', 'Other tool'));
    for (const acc of others) nodes.push(codexRow(acc, ctx));
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Reset calendar

// "2.3 d", or "5 h" / "40 min" inside the last day.
function shortLeft(lane, nowMs) {
  if (lane.daysLeft >= 1) return `${lane.daysLeft.toFixed(1)} d`;
  return fmtDaysLeft(lane.resetsAtMs, nowMs).replace(/^in /, '');
}

function buildCalendar(accounts, nowMs) {
  const cols = dayColumns(nowMs, CALENDAR_DAYS);
  const startMs = cols[0].startMs;
  const spanMs = cols[cols.length - 1].endMs - startMs;
  // Position on the whole 8-day span, in percent.
  const at = (t) => ((t - startMs) / spanMs) * 100;
  const nowPct = clampPct(at(nowMs));
  const lanes = calendarLanes(accounts, nowMs);
  const nodes = [];

  // Under the lanes: today's column and the day boundaries.
  if (lanes.length) {
    const bg = el('div', 'cal-bg');
    bg.style.gridRow = `2 / span ${lanes.length}`;
    cols.forEach((col, i) => {
      if (col.today) {
        const band = el('div', 'today-band');
        band.style.left = pctText(at(col.startMs));
        band.style.width = pctText(at(col.endMs) - at(col.startMs));
        bg.append(band);
      }
      if (i > 0) {
        const line = el('div', 'dayline');
        line.style.left = pctText(at(col.startMs));
        bg.append(line);
      }
    });
    nodes.push(bg);
  }

  nodes.push(el('div', 'corner'));
  const days = el('div', 'days');
  // A DST day is 23 or 25 hours wide, so the columns follow the hours.
  days.style.gridTemplateColumns = cols.map((c) => `${(c.endMs - c.startMs) / HOUR_MS}fr`).join(' ');
  for (const col of cols) {
    const [weekday, date] = col.label.split(' ');
    const day = el('div', col.today ? 'day today' : 'day');
    day.append(el('span', 'wd', weekday), el('span', 'dn', date));
    days.append(day);
  }
  nodes.push(days);

  lanes.forEach((lane, i) => {
    const gridRow = String(i + 2);
    const color = colorClass(lane.id);

    const name = el('div', `lane-name ${color}`);
    name.style.gridRow = gridRow;
    name.append(el('span', 'dot'), el('span', 'nm', lane.id));
    const sub = el('small');
    if (lane.resetsAtMs === null) {
      sub.textContent = lane.note || RESET_UNKNOWN;
    } else {
      sub.append('frees up in ', el('b', null, shortLeft(lane, nowMs)));
    }
    name.append(sub);

    const track = el('div', `lane ${color}`);
    track.style.gridRow = gridRow;
    if (lane.resetsAtMs !== null) {
      const raw = at(lane.resetsAtMs);
      const pos = clampPct(raw);
      const from = Math.min(nowPct, pos);
      const wait = el('div', 'wait');
      wait.style.left = pctText(from);
      wait.style.width = pctText(pos - from);
      if (pos - from >= 14) wait.append(el('span', null, 'resets'));
      track.append(wait);
      // A reset past the last column gets no dot, only its time at the edge.
      if (raw <= 100) {
        const dot = el('div', 'end');
        dot.style.left = pctText(pos);
        track.append(dot);
      }
      const lbl = el('div', ['lbl', pos > 70 ? 'flip' : '', pos < 20 ? 'early' : ''].filter(Boolean).join(' '));
      lbl.style.left = pctText(pos);
      lbl.append(el('b', null, fmtTime(lane.resetsAtMs, nowMs)));
      track.append(lbl);
    }
    nodes.push(name, track);
  });

  // Over everything: the NOW line.
  const now = el('div', 'cal-now');
  now.style.gridRow = `1 / span ${lanes.length + 1}`;
  const line = el('div', 'nowline');
  line.style.left = pctText(nowPct);
  const label = el('div', 'nowlbl', 'NOW');
  label.style.left = pctText(nowPct);
  now.append(line, label);
  nodes.push(now);
  return nodes;
}

// ---------------------------------------------------------------------------
// Page

// Builds every section first, then swaps them in, so a failure leaves no
// half-rendered page behind.
function render(doc, nowMs) {
  const accounts = doc.accounts;
  const fresh = freshness(doc.generated_at, nowMs);
  const ranking = rankClaude(accounts, nowMs);
  const hasTokens = accounts.some((acc) => acc && acc.tokens_week && typeof acc.tokens_week === 'object');
  const ctx = { nowMs, hasTokens, tokensSince: doc.tokens_since };

  const header = buildHeader(ranking, fresh, nowMs);
  const rows = buildRows(ranking, accounts, ctx);
  const calendar = buildCalendar(accounts, nowMs);

  view.banner.textContent = fresh.stale ? fresh.text : '';
  view.banner.hidden = !fresh.stale;
  view.header.replaceChildren(...header);
  const unattributed = hasTokens ? unattributedNote(accounts) : '';
  view.rows.classList.toggle('has-tokens', hasTokens);
  view.tokensHead.hidden = !hasTokens;
  view.tokensNote.textContent = unattributed;
  view.tokensNote.hidden = !unattributed;
  view.rowList.replaceChildren(...rows);
  view.calGrid.replaceChildren(...calendar);
  view.footNote.textContent = `stale banner appears if the collector misses ${STALE_BANNER_MINUTES} min`;
  view.page.hidden = false;
  // Reattach only after the error line; a re-render keeps the page (and scroll) in place.
  if (view.page.parentNode !== document.body || document.body.children.length !== 1) {
    document.body.replaceChildren(view.page);
  }
  document.body.dataset.state = 'ready';
}

function showError() {
  document.body.replaceChildren(el('p', 'error', ERROR_TEXT));
  document.body.dataset.state = 'error';
}

let current = null;
let loading = false;

function show() {
  if (!current) return;
  try {
    render(current, Date.now());
  } catch (err) {
    current = null;
    showError();
    console.error(err);
  }
}

// A failed refetch keeps the last good document: the age line and the stale
// banner already say how old it is. The error line shows only while no good
// document has loaded.
async function refresh() {
  if (loading) return;
  loading = true;
  let next = null;
  try {
    next = await loadData();
  } finally {
    loading = false;
  }
  if (next) current = next;
  if (current) show();
  else showError();
}

refresh();
setInterval(show, RENDER_EVERY_MS);
setInterval(refresh, FETCH_EVERY_MS);
