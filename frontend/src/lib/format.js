const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// SQLite's CURRENT_TIMESTAMP produces UTC in "YYYY-MM-DD HH:MM:SS" form — no timezone
// marker. `new Date("2026-10-03 19:30:00")` does not match the ISO-8601 grammar, so V8
// falls back to its own parsing and treats it as *local* time. The stored value is UTC,
// so every timestamp in the app was being read five hours off on this PKT machine: a
// delivery recorded at 00:30 local (19:30 UTC the previous day) displayed as the day
// before.
//
// Appending the missing Z is the fix for reading them. The real cure is to store ISO-8601
// with an explicit offset, which is a schema change and belongs with the deferred
// migration work.
function parseTimestamp(value) {
  if (typeof value !== 'string') return null;
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  const withZone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "04 Oct 2026". A spelled month rather than 04/10/2026, because DD/MM and MM/DD are
// indistinguishable for the first twelve days of any month and this table gets read by
// whoever is checking a delivery against a supplier's slip.
export function formatDate(value) {
  const date = parseTimestamp(value);
  if (!date) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// "14:23". 24-hour, because a till in Pakistan reads a 24-hour clock and "2:23" on a receipt
// could be either side of a shift change.
export function formatTime(value) {
  const date = parseTimestamp(value);
  if (!date) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// "04 Oct 2026, 14:23" — for detail views where the order being looked at is not obviously
// today's. The order history itself shows the time alone and states the date once in the
// header, because repeating "04 Oct 2026" down fifty rows is fifty lines of noise.
export function formatDateTime(value) {
  const date = parseTimestamp(value);
  if (!date) return '—';
  return `${formatDate(value)}, ${formatTime(value)}`;
}

// Today in the shop's own timezone, as "YYYY-MM-DD" — the shape the API's from/to filters
// take. Deliberately not toISOString(), which would hand back the UTC date and so be a day
// behind for every evening between 19:00 and midnight local.
export function localDateString(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// How many days back a preset range starts, also as a local date string.
export function daysAgoString(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDateString(date);
}

// "Is this timestamp on the shop's today?" — used to decide whether a row needs its date
// spelled out. Compares local calendar days rather than elapsed hours, so 23:50 and 00:10
// are on different days however close together they are.
export function isToday(value) {
  const date = parseTimestamp(value);
  if (!date) return false;
  return localDateString(date) === localDateString();
}
