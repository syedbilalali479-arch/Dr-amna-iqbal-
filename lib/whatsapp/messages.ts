// Fixed WhatsApp messages that must always look the same: booking confirmation and closings.
import {clinicProfile, clinicSchedule} from "../clinic-profile.ts";

const longDate = (d: string) => new Intl.DateTimeFormat("en-PK", {timeZone: "Asia/Karachi", weekday: "long", day: "numeric", month: "long", year: "numeric"}).format(new Date(`${d}T12:00:00+05:00`));
const clock = (t: string) => { const h = Number(t.slice(0, 2)); return `${h % 12 || 12}:${t.slice(3, 5)} ${h >= 12 ? "PM" : "AM"}`; };

export function confirmationMessage(b: {patientName: string; service: string; date: string; time: string; price?: string | null; language?: string}) {
  const english = b.language === "ENGLISH";
  return [
    english ? "✅ *Appointment Confirmed!*" : "✅ *Appointment Confirm ho gayi hai!*",
    "",
    `👤 *Patient:* ${b.patientName}`,
    `💆 *Service:* ${b.service}`,
    `📅 *Date:* ${longDate(b.date)}`,
    `⏰ *Time:* ${clock(b.time)}`,
    `👩‍⚕️ *Doctor:* ${clinicProfile.doctor}`,
    ...(b.price ? [`💰 *Fee:* ${b.price}`] : []),
    "",
    `📍 *${clinicProfile.name} Clinic:* ${clinicProfile.address}`,
    `🗺️ *Location:* ${clinicSchedule.mapsUrl}`,
    `📞 ${clinicProfile.phone}`,
    "",
    english ? "Please arrive 10 minutes early. See you soon! 🌸" : "Please 10 minute pehle tashreef le aayein. Aap ka intezar rahega! 🌸",
  ].join("\n");
}

// Messages that only close the chat. "ok"/"ji"/"haan" are closings only when nothing was asked.
const PHRASE = "(?:ok+|okay|okk+|k|kk|theek(?:\\s*(?:hai|he|h))?|thik(?:\\s*(?:hai|he|h))?|thk|acha|accha|achha|g|ji+|jee|done|great|nice|perfect|good|alright|sure|haan?(?:\\s*ji)?|hmm+|thanks?|thank\\s*(?:you|u)|thnx|thx|tysm|shukriya|shukria|meharbani|jazak\\s*allah(?:\\s*khair)?|jzk|jazakallah(?:\\s*khair)?|allah\\s*hafiz|khuda\\s*hafiz|fi\\s*aman\\s*allah|bye+|tc|take\\s*care|see\\s*you|شکریہ|جزاک\\s*اللہ|اللہ\\s*حافظ|ٹھیک\\s*ہے|اوکے|جی)";
const CLOSING = new RegExp(`^${PHRASE}(?:\\s+${PHRASE})*$`, "i");
export function isClosingOnly(text: string) {
  const t = text.trim().toLowerCase()
    .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u200d\ufe0f]/gu, " ")
    .replace(/[.!?,،۔؟]+/g, " ")
    .replace(/\b(bohat|bohot|bht|bahut|buhat|very|so|much|aap\s*ka|ap\s*ka|aapka|apka|sir|madam|maam|mam|dr|doctor|sahiba|sahib|bhai|baji|api)\b/gi, " ")
    .replace(/\s+/g, " ").trim();
  if (!t) return true; // emoji / sticker only
  return CLOSING.test(t);
}
