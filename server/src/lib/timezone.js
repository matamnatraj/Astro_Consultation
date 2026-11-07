// Historical time-zone handling using the IANA database bundled with Node's ICU.

const fmtCache = new Map();
function fmt(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz) {
  try { fmt(tz); return true; } catch { return false; }
}

/** UTC offset (minutes east of UTC) for the zone at the given instant. */
export function offsetAt(tz, date) {
  const p = Object.fromEntries(fmt(tz).formatToParts(date).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/**
 * Convert a wall-clock local date/time in an IANA zone to a UTC Date, using the
 * offset in force on that historical date. Flags DST gaps/overlaps.
 */
export function zonedToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm, ss = 0] = timeStr.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm, ss);
  const H12 = 12 * 3600_000;
  const offsets = [...new Set([offsetAt(tz, new Date(wall - H12)), offsetAt(tz, new Date(wall + H12))])];
  // A candidate offset is valid if the instant it implies really has that offset.
  const valid = offsets.filter((o) => offsetAt(tz, new Date(wall - o * 60000)) === o).sort((a, b) => b - a);
  let ambiguity = null;
  let chosen;
  if (valid.length === 0) {
    ambiguity = 'nonexistent_local_time'; // falls in a DST gap — interpret with the pre-transition offset
    chosen = offsets[0];
  } else {
    if (valid.length > 1) ambiguity = 'ambiguous_local_time'; // DST overlap — earliest instant chosen
    chosen = valid[0];
  }
  const utc = new Date(wall - chosen * 60000);
  return { utc, offsetMinutes: offsetAt(tz, utc), ambiguity };
}
