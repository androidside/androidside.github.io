// Pure page logic for the usage dashboard: ranking, stale states, the reset
// calendar and formatting. No imports and no DOM access, so the same file runs
// in the browser and under `node --test`.
//
// Every function that formats a time takes an optional trailing `tz` (an IANA
// zone name). The page leaves it out and gets the browser's own zone; tests
// pass one so results do not depend on the machine.

export const COLORS = Object.freeze({
  claude: '#7c8cf0',
  claude2: '#5fe3b0',
  claude3: '#f0cf5f',
  codex: '#f08a7a',
});

export const STALE_BANNER_MINUTES = 30;

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const NOTE_NO_READING = 'no reading yet · open this account once';
const NOTE_RESET_UNKNOWN = 'reset time known after next use';

// The cause a stale Claude note names when the user did nothing to cause it.
// token_expired is the normal state between sessions and needs_login has its
// own note; any other reason shows the time alone.
const STALE_CAUSE = Object.freeze({
  auth_failed: 'usage call refused',
  http_error: 'could not reach Anthropic',
  backoff: 'could not reach Anthropic',
});

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function toMs(value) {
  if (isNum(value)) return value;
  if (typeof value !== 'string' || value === '') return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

// ---------------------------------------------------------------------------
// Time zone helpers (Intl only)

const formatters = new Map();

function formatter(kind, tz) {
  const key = `${kind}|${tz || ''}`;
  let f = formatters.get(key);
  if (!f) {
    const opts = kind === 'parts'
      ? { hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }
      : kind === 'time'
        ? { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }
        : { timeZoneName: 'short' };
    f = new Intl.DateTimeFormat('en-US', { ...opts, timeZone: tz });
    formatters.set(key, f);
  }
  return f;
}

function partsOf(f, ms) {
  const out = {};
  for (const p of f.formatToParts(ms)) out[p.type] = p.value;
  return out;
}

// Local wall-clock fields of an instant in `tz`.
function localFields(ms, tz) {
  const p = partsOf(formatter('parts', tz), ms);
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}

// Local wall time minus UTC, in ms, at instant `ms`.
function offsetMs(ms, tz) {
  const f = localFields(ms, tz);
  return Date.UTC(f.y, f.m - 1, f.d, f.h, f.mi, f.s) - Math.floor(ms / 1000) * 1000;
}

// A day number that increases by one per local calendar date.
function localDayNumber(ms, tz) {
  const f = localFields(ms, tz);
  return Math.round(Date.UTC(f.y, f.m - 1, f.d) / DAY);
}

// The earliest instant whose local date in `tz` is y-m-d. Usually local
// midnight; in zones whose clocks skip midnight, the moment the day begins.
function startOfLocalDay(y, m, d, tz) {
  const wall = Date.UTC(y, m - 1, d);
  // Offsets a day either side of the date straddle any transition near it.
  const candidates = [wall - offsetMs(wall - DAY, tz), wall - offsetMs(wall + DAY, tz)];
  let best = null;
  for (const c of candidates) {
    const f = localFields(c, tz);
    if (f.y === y && f.m === m && f.d === d && (best === null || c < best)) best = c;
  }
  return best === null ? wall - offsetMs(wall, tz) : best;
}

// ---------------------------------------------------------------------------
// Formatting

// `Wed 4:59 AM` when the local date is within 6 days of today (either way),
// so the weekday cannot be confused with today's; else `Sat Nov 7, 5:13 PM`.
export function fmtTime(ms, nowMs = Date.now(), tz = undefined) {
  if (!isNum(ms)) return '';
  const p = partsOf(formatter('time', tz), ms);
  const clock = `${p.hour}:${p.minute} ${p.dayPeriod}`;
  const days = Math.abs(localDayNumber(ms, tz) - localDayNumber(nowMs, tz));
  return days <= 6 ? `${p.weekday} ${clock}` : `${p.weekday} ${p.month} ${p.day}, ${clock}`;
}

// Zone abbreviation at an instant, for example `CST` or `CDT`.
export function fmtZone(ms = Date.now(), tz = undefined) {
  return partsOf(formatter('zone', tz), ms).timeZoneName || '';
}

// From epoch values only, so DST changes do not bite.
export function fmtDaysLeft(ms, nowMs = Date.now()) {
  if (!isNum(ms)) return '';
  const diff = ms - nowMs;
  if (diff <= 0) return 'now';
  if (diff >= DAY) return `in ${(diff / DAY).toFixed(1)} days`;
  if (diff >= HOUR) return `in ${Math.floor(diff / HOUR)} h`;
  return `in ${Math.max(1, Math.floor(diff / MINUTE))} min`;
}

// `950K`, `38.4M`, `148M`, `2.1B`: one decimal below 100 of a unit, none above.
export function fmtTokens(n) {
  if (!isNum(n)) return '';
  if (Math.round(n) < 1000) return String(Math.round(n));
  const units = [['K', 1e3], ['M', 1e6], ['B', 1e9], ['T', 1e12]];
  for (let i = 0; i < units.length; i++) {
    const [suffix, size] = units[i];
    const v = n / size;
    const r = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
    if (r < 1000 || i === units.length - 1) return `${r}${suffix}`;
  }
  return '';
}

function fmtAge(minutes) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 48 * 60) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / (24 * 60))} d`;
}

// ---------------------------------------------------------------------------
// Stale states

// The numbers to show now for one usage window: `weekly`, `weekly_fable`,
// `session` or codex `secondary`, all shaped `{used_pct, resets_at}`. Once
// the reset has passed the window is empty, and since windows are anchored
// at first use after a reset, the next reset is unknown until a fresh
// reading. `resetPassedAtMs` keeps the passed reset for the note.
export function effectiveWindow(win, nowMs) {
  if (!win || !isNum(win.used_pct)) {
    return { hasReading: false, usedPct: null, leftPct: null, resetsAtMs: null, resetKnown: false, resetPassedAtMs: null };
  }
  const resetsAtMs = toMs(win.resets_at);
  if (resetsAtMs !== null && resetsAtMs <= nowMs) {
    return { hasReading: true, usedPct: 0, leftPct: 100, resetsAtMs: null, resetKnown: false, resetPassedAtMs: resetsAtMs };
  }
  const used = win.used_pct;
  return {
    hasReading: true,
    usedPct: used,
    leftPct: Math.min(100, Math.max(0, 100 - used)),
    resetsAtMs,
    resetKnown: resetsAtMs !== null,
    resetPassedAtMs: null,
  };
}

// The note on a stale reading that still counts (its reset has not passed).
function staleNote(acc, nowMs, tz) {
  const fetchedMs = toMs(acc.fetched_at);
  const when = fetchedMs === null ? null : fmtTime(fetchedMs, nowMs, tz);
  const reason = acc.stale_reason;
  if (acc.kind !== 'codex' && reason === 'token_expired') {
    return when ? `unchanged since your last session · ${when}` : 'unchanged since your last session';
  }
  const unchanged = when ? `unchanged since ${when}` : 'unchanged since the last reading';
  const cause = typeof reason === 'string' && Object.hasOwn(STALE_CAUSE, reason) ? STALE_CAUSE[reason] : null;
  return cause ? `${cause} · ${unchanged}` : unchanged;
}

// The note for an account without a reading.
function noReadingNote(acc, reason) {
  if (reason === 'needs_login') return 'needs login';
  if (acc && acc.kind === 'codex') {
    // The collector spawns codex on its own unless the token has expired.
    return reason === 'token_expired' ? 'no reading yet · run codex once' : 'no reading yet';
  }
  return NOTE_NO_READING;
}

// The weekly all-models numbers the page should show and rank on now.
export function effectiveWeekly(acc, nowMs, tz = undefined) {
  const out = {
    usedPct: null, leftPct: null, resetsAtMs: null, resetKnown: false,
    note: null, blocked: false, hasReading: false, overLimit: false,
  };
  const win = effectiveWindow(acc && acc.weekly, nowMs);
  // Stale reasons that only the user can clear replace the note on a
  // reading: the collector does not spawn codex while its token is expired,
  // so the reading will not refresh on its own.
  const reason = acc ? acc.stale_reason : null;
  const actionNote = reason === 'needs_login' ? 'needs login'
    : acc && acc.kind === 'codex' && reason === 'token_expired' ? 'run codex once'
      : null;

  if (!win.hasReading) {
    out.note = noReadingNote(acc, reason);
    return out;
  }
  out.hasReading = true;

  const used = win.usedPct;
  const resetsAtMs = win.resetsAtMs;
  let note = null;

  if (win.resetPassedAtMs !== null) {
    note = `fresh window since ${fmtTime(win.resetPassedAtMs, nowMs, tz)} · exact reset time known after next use`;
  } else if (acc.stale) {
    note = staleNote(acc, nowMs, tz);
  } else if (resetsAtMs === null) {
    note = NOTE_RESET_UNKNOWN;
  }

  out.usedPct = used;
  out.leftPct = win.leftPct;
  out.resetsAtMs = resetsAtMs;
  out.resetKnown = win.resetKnown;

  if (used >= 100) {
    if (acc.extra_usage_enabled) {
      out.overLimit = true;
      note = 'over limit, paying per use';
    } else {
      out.blocked = true;
      note = out.resetKnown ? `blocked until ${fmtTime(resetsAtMs, nowMs, tz)}` : `blocked, ${NOTE_RESET_UNKNOWN}`;
    }
  }
  // A full account keeps its blocked or paying note after the action note.
  if (actionNote) note = out.blocked || out.overLimit ? `${actionNote} · ${note}` : actionNote;
  if (acc.locked) {
    out.blocked = true;
    out.overLimit = false;
    note = String(acc.locked);
  }
  out.note = note;
  return out;
}

// ---------------------------------------------------------------------------
// Ranking (Claude accounts only)

// Known resets first, earlier first; unknown resets after.
function compareReset(a, b) {
  if (a.resetKnown && b.resetKnown) return a.resetsAtMs - b.resetsAtMs;
  if (a.resetKnown) return -1;
  if (b.resetKnown) return 1;
  return 0;
}

export function rankClaude(accounts, nowMs, tz = undefined) {
  const all = (accounts || [])
    .filter((acc) => acc && acc.kind === 'claude')
    .map((acc, index) => ({ acc, eff: effectiveWeekly(acc, nowMs, tz), index }));

  const eligible = all
    .filter((r) => r.eff.hasReading && !r.eff.blocked)
    .sort((a, b) => (Number(a.eff.overLimit) - Number(b.eff.overLimit))
      || (b.eff.leftPct - a.eff.leftPct)
      || compareReset(a.eff, b.eff)
      || (a.index - b.index));
  const blocked = all.filter((r) => r.eff.hasReading && r.eff.blocked);
  const unread = all.filter((r) => !r.eff.hasReading);

  // Display order: ranked, then blocked (dimmed), then no reading (dashes).
  const rows = [
    ...eligible.map((r, i) => ({ acc: r.acc, eff: r.eff, rank: i + 1, excluded: false })),
    ...blocked.map((r) => ({ acc: r.acc, eff: r.eff, rank: null, excluded: true })),
    ...unread.map((r) => ({ acc: r.acc, eff: r.eff, rank: null, excluded: false })),
  ];

  if (eligible.length > 0) {
    const { acc, eff } = eligible[0];
    const when = eff.resetKnown ? `resets ${fmtTime(eff.resetsAtMs, nowMs, tz)}` : NOTE_RESET_UNKNOWN;
    return {
      verdict: { id: acc.id, leftPct: eff.leftPct, resetsAtMs: eff.resetsAtMs },
      headline: `Start with ${acc.id}`,
      sub: `${Math.round(eff.leftPct)}% left this week · ${when}`,
      rows,
    };
  }

  // Nothing to rank on yet, for example the first run after install.
  if (blocked.length === 0) {
    return { verdict: null, headline: 'No reading yet', sub: 'open each account once', rows };
  }

  // A weekly reset frees a full account, not a locked one.
  const next = blocked
    .filter((r) => !r.acc.locked && r.eff.resetKnown)
    .sort((a, b) => a.eff.resetsAtMs - b.eff.resetsAtMs)[0];
  return {
    verdict: null,
    headline: 'No Claude account has room right now',
    sub: next ? `next frees up: ${next.acc.id} ${fmtTime(next.eff.resetsAtMs, nowMs, tz)}` : '',
    rows,
  };
}

// ---------------------------------------------------------------------------
// Reset calendar

// One lane per account with a reading (Codex included), soonest reset first,
// unknown resets last.
export function calendarLanes(accounts, nowMs) {
  return (accounts || [])
    .filter(Boolean)
    .map((acc, index) => ({ acc, eff: effectiveWeekly(acc, nowMs), index }))
    .filter((r) => r.eff.hasReading)
    .sort((a, b) => compareReset(a.eff, b.eff) || (a.index - b.index))
    .map(({ acc, eff }) => ({
      id: acc.id,
      resetsAtMs: eff.resetKnown ? eff.resetsAtMs : null,
      daysLeft: eff.resetKnown ? (eff.resetsAtMs - nowMs) / DAY : null,
      note: eff.resetKnown ? null : NOTE_RESET_UNKNOWN,
    }));
}

// `days` columns starting with today, bounded by local midnights in `tz`, so
// a DST day is 23 or 25 hours wide while its label stays one date.
export function dayColumns(nowMs, days = 8, tz = undefined) {
  const today = localFields(nowMs, tz);
  const cols = [];
  let startMs = startOfLocalDay(today.y, today.m, today.d, tz);
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
    const next = new Date(Date.UTC(today.y, today.m - 1, today.d + i + 1));
    const endMs = startOfLocalDay(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), tz);
    cols.push({
      label: `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()}`,
      startMs,
      endMs,
      today: i === 0,
    });
    startMs = endMs;
  }
  return cols;
}

// ---------------------------------------------------------------------------
// Freshness and notes

export function freshness(generatedAtIso, nowMs) {
  const generatedMs = toMs(generatedAtIso);
  if (generatedMs === null) {
    return { ageMinutes: null, stale: true, text: 'collector last ran at an unknown time' };
  }
  const ageMs = Math.max(0, nowMs - generatedMs);
  const ageMinutes = Math.floor(ageMs / MINUTE);
  const stale = ageMs > STALE_BANNER_MINUTES * MINUTE;
  let text;
  if (stale) text = `collector last ran ${fmtAge(ageMinutes)} ago`;
  else if (ageMinutes < 1) text = 'updated just now';
  else text = `updated ${fmtAge(ageMinutes)} ago`;
  return { ageMinutes, stale, text };
}

// The ranking ignores Fable; the row warns when Fable is the tighter limit.
// Once either weekly reset has passed, both readings are from an ended
// window, so there is nothing to warn about.
export function fableNote(acc, nowMs = Date.now()) {
  const fable = effectiveWindow(acc && acc.weekly_fable, nowMs);
  const weekly = effectiveWindow(acc && acc.weekly, nowMs);
  if (!fable.hasReading || !weekly.hasReading) return null;
  if (fable.resetPassedAtMs !== null || weekly.resetPassedAtMs !== null) return null;
  return fable.usedPct > weekly.usedPct ? 'Fable runs out first here' : null;
}
