// Turning the shop's local days into the strings SQLite actually stores.
//
// This lives on its own because two models now filter by date — orders and stock movements —
// and a second copy of it is a second chance to get the offset wrong. Every screen that asks
// "today" has to mean the same today.

// created_at is written by SQLite's CURRENT_TIMESTAMP, which is UTC, in the format
// "YYYY-MM-DD HH:MM:SS" with no zone marker. A "from" of 2026-10-11 therefore has to become the
// UTC instant of local midnight, which on this PKT machine (UTC+5) is 19:00 the day before.
// Without that conversion a day's takings would be counted from 05:00 to 05:00.
//
// The comparison itself is a string comparison: the format is fixed-width and most significant
// part first, so "2026-10-11 19:00:00" < "2026-10-11 20:00:00" as text. Everything stored is
// written this way, so the values sort as dates.
//
// `new Date("...T00:00:00")` with no zone is parsed as the *machine's* local time, which is the
// shop's — the API and the till run on the same PC, so "local" here is the same local the
// operator means when they say today.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Format first, then reality. The regex alone lets 2026-02-31 through, and `new Date()` turns
// that into March 3rd rather than refusing — so a typo would silently filter the wrong day.
function parseLocalDay(date, label) {
    if (!DATE_ONLY.test(String(date))) throw new Error(`${label} must look like YYYY-MM-DD`);

    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) throw new Error(`${label} is not a real date: ${date}`);

    return parsed;
}

function toSqliteUtc(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

function localDayStartUtc(date, label = 'from') {
    return toSqliteUtc(parseLocalDay(date, label));
}

// Exclusive upper bound: the midnight *after* `to`, so `to = today` includes everything
// recorded today rather than stopping at 00:00 this morning.
function localDayEndUtc(date, label = 'to') {
    const parsed = parseLocalDay(date, label);
    parsed.setDate(parsed.getDate() + 1);
    return toSqliteUtc(parsed);
}

module.exports = { DATE_ONLY, localDayStartUtc, localDayEndUtc };
