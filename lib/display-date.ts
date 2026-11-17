/** Dashboard dates are shown day first, as in Pakistan: DD/MM/YYYY. Storage stays ISO (YYYY-MM-DD). */
export function formatDisplayDate(value: unknown, empty = '—') {
  const raw = String(value ?? '').trim();
  const parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return parts ? `${parts[3]}/${parts[2]}/${parts[1]}` : raw || empty;
}

/** Reads a typed DD/MM/YYYY (also D-M-YYYY, DD.MM.YY) back to ISO. Returns '' for blank, null when invalid. */
export function parseDisplayDate(text: string): string | null {
  const raw = text.trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2}|\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]), month = Number(m[2]), year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Column keys that hold a calendar date. */
export const isDateColumn = (key: string) => key === 'date' || key === 'expiry' || key.endsWith('_date');

/** Dashboard times are shown in 12-hour format: 17:30 → 5:30 PM. Storage stays 24-hour (HH:MM). */
export function formatDisplayTime(value: unknown, empty = '—') {
  const raw = String(value ?? '').trim();
  const parts = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!parts) return raw || empty;
  const hour = Number(parts[1]);
  if (hour > 23) return raw;
  return `${hour % 12 || 12}:${parts[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
}

/** Column keys that hold a clock time. */
export const isTimeColumn = (key: string) => key === 'time' || key.endsWith('_time');
