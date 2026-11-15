// Deterministic reading of dates, times and names in patient messages (English, Roman Urdu, Urdu).
// The AI's understanding is checked against this so a misread date ("05/12" as May 12),
// a time taken from a date ("15/11" -> 11:00) or a word taken as a name ("kal") never books wrongly.
import {pakistanParts} from "../pakistan-time.ts";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
function validDay(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
function addDays(date: string, days: number) {
  const t = new Date(`${date}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}
/** A day/month without a year means the next time that day comes round. */
function upcoming(today: string, m: number, d: number) {
  const y = Number(today.slice(0, 4));
  for (const year of [y, y + 1]) if (validDay(year, m, d) && iso(year, m, d) >= today) return iso(year, m, d);
  return null;
}

const MONTHS: Array<[RegExp, number]> = [
  [/^(jan|january|janwari|janvari|جنوری)$/, 1], [/^(feb|february|farwari|farvari|فروری)$/, 2], [/^(mar|march|maarch|مارچ)$/, 3],
  [/^(apr|april|aprail|اپریل)$/, 4], [/^(may|mai|مئی)$/, 5], [/^(jun|june|joon|جون)$/, 6], [/^(jul|july|julai|جولائی)$/, 7],
  [/^(aug|august|agast|agust|اگست)$/, 8], [/^(sep|sept|september|sitambar|stambar|ستمبر)$/, 9], [/^(oct|october|aktubar|october|اکتوبر)$/, 10],
  [/^(nov|november|nomber|navambar|novembar|نومبر)$/, 11], [/^(dec|december|disambar|december|دسمبر)$/, 12],
];
const monthOf = (word: string) => MONTHS.find(([r]) => r.test(word.toLowerCase()))?.[1] ?? null;
const MONTH_WORD = "(jan(?:uary)?|janwari|janvari|feb(?:ruary)?|farwari|farvari|mar(?:ch)?|maarch|apr(?:il)?|aprail|may|mai|jun(?:e)?|joon|jul(?:y)?|julai|aug(?:ust)?|agast|agust|sep(?:t(?:ember)?)?|sitambar|stambar|oct(?:ober)?|aktubar|nov(?:ember)?|nomber|navambar|novembar|dec(?:ember)?|disambar|جنوری|فروری|مارچ|اپریل|مئی|جون|جولائی|اگست|ستمبر|اکتوبر|نومبر|دسمبر)";

// 0 = Sunday … 6 = Saturday. "hafta" alone also means "week", so it needs "ko"/"ke din".
const WEEKDAYS: Array<[RegExp, number]> = [
  [/\b(sunday|itwar|itwaar|etwar)\b|(?:^|\s)اتوار(?=\s|$)/i, 0], [/\b(monday|peer|pir|somwar)\b|(?:^|\s)پیر(?=\s|$)/i, 1], [/\b(tuesday|tues|mangal|mangalwar)\b|(?:^|\s)منگل(?=\s|$)/i, 2],
  [/\b(wednesday|budh|budhwar)\b|(?:^|\s)بدھ(?=\s|$)/i, 3], [/\b(thursday|thurs|jumerat|jumeraat|jumairat)\b|(?:^|\s)جمعرات(?=\s|$)/i, 4],
  [/\b(friday|juma|jumma|jummah|jumah)\b|(?:^|\s)جمعہ(?=\s|$)/i, 5], [/\b(saturday|sanichar|(?:hafta|hafte|haftay)\s+(?:ko|ke din|walay din|wale din))\b|(?:^|\s)ہفتہ(?=\s|$)/i, 6],
];
const urdu = (t: string, word: string) => new RegExp(`(?:^|\\s)${word}(?=\\s|$)`).test(t);

/** Finds an explicit appointment date in the text, resolved against Pakistan time. */
export function parseDate(text: string, now = new Date()): string | null {
  const today = pakistanParts(now).date;
  const t = ` ${text.toLowerCase().replace(/[،,؟?!]/g, " ")} `;
  let m: RegExpMatchArray | null;
  if ((m = t.match(/\b(20\d\d)-(\d{1,2})-(\d{1,2})\b/))) return validDay(+m[1], +m[2], +m[3]) ? iso(+m[1], +m[2], +m[3]) : null;
  // Pakistan writes day first: 15/11, 15-11-2026, 15.11.26
  if ((m = t.match(/(?<![\d:])(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?(?![\d:])(?!\s*(?:am|pm|a\.m|p\.m|baje|bje|bajay))/))) {
    const d = +m[1], mo = +m[2];
    if (m[3]) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return validDay(y, mo, d) ? iso(y, mo, d) : null; }
    if (mo <= 12) return upcoming(today, mo, d);
  }
  if ((m = t.match(new RegExp(`(?<!\\d)(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?${MONTH_WORD}(?:\\s+(20\\d\\d))?`, "i")))) {
    const mo = monthOf(m[2])!; return m[3] ? (validDay(+m[3], mo, +m[1]) ? iso(+m[3], mo, +m[1]) : null) : upcoming(today, mo, +m[1]);
  }
  if ((m = t.match(new RegExp(`${MONTH_WORD}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)(?:\\s+(20\\d\\d))?`, "i")))) {
    const mo = monthOf(m[1])!; return m[3] ? (validDay(+m[3], mo, +m[2]) ? iso(+m[3], mo, +m[2]) : null) : upcoming(today, mo, +m[2]);
  }
  // "15 tareekh ko" = that day of this month (next month if it has passed)
  if ((m = t.match(/(?<!\d)(\d{1,2})(?:st|nd|rd|th)?\s*(?:tareekh|tarikh|tareekh|tarekh|tareek|tarik|date|تاریخ)/i))) {
    const d = +m[1], y = +today.slice(0, 4), mo = +today.slice(5, 7);
    const here = validDay(y, mo, d) ? iso(y, mo, d) : null;
    if (here && here >= today) return here;
    const next = mo === 12 ? [y + 1, 1] : [y, mo + 1];
    return validDay(next[0], next[1], d) ? iso(next[0], next[1], d) : null;
  }
  if (/\b(parson|parsun|parso|day after tomorrow)\b/.test(t) || urdu(t, "پرسوں")) return addDays(today, 2);
  if (/\b(kal|tomorrow|tmrw|tomoro)\b/.test(t) || urdu(t, "کل")) return addDays(today, 1);
  if (/\b(aaj|aj|today|abhi)\b/.test(t) || urdu(t, "آج")) return today;
  const weekday = WEEKDAYS.find(([r]) => r.test(t));
  if (weekday) {
    const current = new Date(`${today}T12:00:00Z`).getUTCDay();
    let diff = (weekday[1] - current + 7) % 7;
    if (diff === 0 && (/\b(agle|agla|next|aglay)\b/i.test(t) || urdu(t, "اگلے"))) diff = 7;
    return addDays(today, diff);
  }
  return null;
}

const NUMBER_WORDS: Record<string, number> = {ek: 1, aik: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4, panch: 5, paanch: 5, five: 5, chhe: 6, chay: 6, chey: 6, che: 6, six: 6, saat: 7, sat: 7, seven: 7, aath: 8, ath: 8, eight: 8, nau: 9, nine: 9, das: 10, dus: 10, ten: 10, gyarah: 11, gyara: 11, eleven: 11, barah: 12, bara: 12, twelve: 12};
const HOUR = "(\\d{1,2}|ek|aik|one|do|two|teen|three|char|chaar|four|panch|paanch|five|chhe|chay|chey|che|six|saat|sat|seven|aath|ath|eight|nau|nine|das|dus|ten|gyarah|gyara|eleven|barah|bara|twelve)";
const hourValue = (v: string) => (/^\d+$/.test(v) ? Number(v) : NUMBER_WORDS[v.toLowerCase()] ?? NaN);

/** Strips date tokens so their numbers are not read as a time. */
function withoutDates(text: string) {
  return text.toLowerCase()
    .replace(/\b20\d\d-\d{1,2}-\d{1,2}\b/g, " ")
    .replace(/(?<![\d:])\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?(?![\d:])(?!\s*(?:am|pm|a\.m|p\.m|baje|bje|bajay))/g, " ")
    .replace(new RegExp(`(?<!\\d)\\d{1,2}(?:st|nd|rd|th)?\\s*(?:of\\s+)?${MONTH_WORD}(?:\\s+20\\d\\d)?`, "gi"), " ")
    .replace(new RegExp(`${MONTH_WORD}\\s+\\d{1,2}(?:st|nd|rd|th)?(?!\\d)(?:\\s+20\\d\\d)?`, "gi"), " ")
    .replace(/(?<!\d)\d{1,2}(?:st|nd|rd|th)?\s*(?:tareekh|tarikh|tarekh|tareek|tarik|date|تاریخ)/gi, " ");
}

/** Finds an explicit time. The clinic works 5–10 PM, so a bare "7" with a time cue is 7 PM. */
export function parseTime(text: string): string | null {
  const t = ` ${withoutDates(text)} `;
  const morning = /\b(subah|subha|morning|am|a\.m)\b|(?:^|\s)صبح(?=\s|$)/.test(t);
  const toClock = (h: number, min: number) => {
    if (!Number.isFinite(h) || h < 0 || h > 23 || min < 0 || min > 59) return null;
    if (h >= 1 && h <= 11 && !morning) h += 12; // evening clinic
    if (h === 12 && morning) h = 0;
    return `${pad(h)}:${pad(min)}`;
  };
  let m: RegExpMatchArray | null;
  // saade 7 = 7:30, sawa 7 = 7:15, paune 8 = 7:45
  if ((m = t.match(new RegExp(`\\b(saade|sade|saadhe|sarhe|sarhay)\\s+${HOUR}\\b`, "i")))) return toClock(hourValue(m[2]), 30);
  if ((m = t.match(new RegExp(`\\b(sawa|sava|swa)\\s+${HOUR}\\b`, "i")))) return toClock(hourValue(m[2]), 15);
  if ((m = t.match(new RegExp(`\\b(paune|pone|pone|paunay|pon)\\s+${HOUR}\\b`, "i")))) { const h = hourValue(m[2]); return toClock(h - 1, 45); }
  // 7:30, 19:30, 7.30 pm
  if ((m = t.match(/(?<![\d\/])(\d{1,2})[:.](\d{2})(?!\d)\s*(am|pm|a\.m|p\.m|baje|bje)?/i))) {
    const h = +m[1], min = +m[2];
    if (h >= 13) return h <= 23 && min <= 59 ? `${pad(h)}:${pad(min)}` : null;
    if (/^a/i.test(m[3] || "")) return h === 12 ? `00:${pad(min)}` : `${pad(h)}:${pad(min)}`;
    return toClock(h, min);
  }
  // 7 pm, 7pm, 7 baje, saat baje, shaam 7
  if ((m = t.match(new RegExp(`\\b${HOUR}\\s*(pm|p\\.m|am|a\\.m|baje|bje|bajay|o'?clock|بجے)`, "i")))) {
    const h = hourValue(m[1]);
    if (/^a/i.test(m[2])) return h === 12 ? "00:00" : Number.isFinite(h) && h <= 12 ? `${pad(h)}:00` : null;
    if (/^p/i.test(m[2]) && h >= 1 && h <= 11) return `${pad(h + 12)}:00`;
    return toClock(h, 0);
  }
  if ((m = t.match(new RegExp(`(?:\\b|\\s)(shaam|sham|raat|evening|night|شام|رات)\\s*(?:ko\\s*)?${HOUR}\\b`, "i")))) return toClock(hourValue(m[2]), 0);
  return null;
}

const NOT_NAME = /\b(aaj|aj|kal|parson|today|tomorrow|baje|bje|pm|am|shaam|sham|subah|raat|time|date|tareekh|tarikh|haan|han|hn|jee|ji|nahi|nhi|no|yes|ok|okay|okk|theek|thik|acha|accha|done|sure|confirm|thanks|thank|shukriya|salam|assalam|aoa|hello|hi|hey|appointment|booking|book|price|fee|fees|charges|kitni|kitna|kya|kab|kahan|kaise|kyun|please|plz|cancel|reschedule|report|prescription|treatment|facial|laser|consultation|doctor|dr|clinic|monday|tuesday|wednesday|thursday|friday|saturday|sunday|peer|mangal|budh|jumerat|jumma|juma|hafta|itwar)\b/i;

/** Cleans a patient-provided name ("mera naam Ali Khan hai" -> "Ali Khan"); null if it is not a name. */
export function cleanName(value: string | null | undefined, serviceNames: string[] = []): string | null {
  if (!value) return null;
  let n = value.trim().replace(/[.!?،,]+$/g, "")
    .replace(/^(mera|meri|my|patient\s+ka|patient\s+ki|patient)?\s*(naam|name|nam)\s*(is|hai|he|:|-)?\s*/i, "")
    .replace(/^(main|mai|i am|i'm|me)\s+/i, "")
    .replace(/\s+(hai|he|hain|hy|ha)$/i, "")
    .replace(/^(ji|jee)\s+/i, "")
    .trim();
  if (!n || n.length < 2 || n.length > 40) return null;
  if (/\d|@|https?:/i.test(n)) return null;
  if (n.split(/\s+/).length > 4) return null;
  if (NOT_NAME.test(n)) return null;
  if (new RegExp(`^${MONTH_WORD}$`, "i").test(n)) return null;
  const lower = n.toLowerCase().replace(/[^a-z؀-ۿ]/g, "");
  if (serviceNames.some((s) => { const sn = s.toLowerCase().replace(/[^a-z]/g, ""); return sn && (lower === sn || sn.includes(lower) && lower.length > 3); })) return null;
  return n.replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

/** True when the name (or its first word) appears in the text, so a WhatsApp profile name is never assumed. */
export function nameAppearsIn(name: string, text: string) {
  const t = text.toLowerCase(), first = name.toLowerCase().split(/\s+/)[0];
  return t.includes(name.toLowerCase()) || (first.length >= 3 && new RegExp(`(^|[^a-z])${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(t));
}

/** Every distinct date in the text, in the order written ("18 wali ko 20 kar dein" -> [18th, 20th]). */
export function parseAllDates(text: string, now = new Date()): string[] {
  const words = text.split(/\s+/), found: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const date = parseDate(words.slice(i, i + 4).join(" "), now);
    if (date && !found.includes(date)) found.push(date);
  }
  return found;
}
