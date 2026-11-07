// Conversation brain: Gemini understands the turn, the backend validates and performs every
// booking action, then Gemini writes the patient reply from the verified backend result.
import {clinicProfile, servicePriceLabel} from "../clinic-profile.ts";
import {pakistanParts} from "../pakistan-time.ts";
import {saveAppointment} from "../appointment-booking.ts";
import {analyze, writeReply, type Analysis, type GeminiConfig, type Language} from "./gemini.ts";

const CLINIC = "skinuvia";
const DOCTOR = "Dr. Aamina Iqbal";
const OPEN = "17:00", CLOSE = "22:00", SLOT = 15;

export type Draft = {patientName?: string; service?: string; date?: string; time?: string; active?: boolean; pendingCancelId?: string; askedCount?: number; lastAsked?: string};
export type Contact = {contact_key: string; reply_to: string; name: string | null; language: Language; draft: Draft; human_controlled: number; handover_at: string | null};
export type TurnResult = {reply: string | null; intent: string; language: Language; draft: Draft; handover?: string | null; appointmentId?: string};
type Treatment = {name: string; description?: string; price: number; price_max?: number | null; pricing_type?: string; duration?: number; availability?: string; booking_instructions?: string | null};
type Appointment = {id: string; patient_name: string; service: string; appointment_date: string; appointment_time: string; status: string; updated_at: string};

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmt12 = (t: string) => { const m = toMin(t), h = Math.floor(m / 60) % 12 || 12; return `${h}:${String(m % 60).padStart(2, "0")} ${m >= 720 ? "PM" : "AM"}`; };
const fmtDate = (d: string) => new Intl.DateTimeFormat("en-PK", {timeZone: "Asia/Karachi", weekday: "long", day: "numeric", month: "long"}).format(new Date(`${d}T12:00:00+05:00`));

async function loadFacts(db: D1Database) {
  const treatments = (await db.prepare("SELECT name,description,price,price_max,pricing_type,duration,availability,booking_instructions FROM treatments WHERE clinic_id=? AND status='Active' ORDER BY name").bind(CLINIC).all<Treatment>()).results;
  const promotions = (await db.prepare("SELECT name,service,original_price,offer_price,expiry_date FROM promotions WHERE clinic_id=? AND status='Active' AND expiry_date>=date('now') LIMIT 10").bind(CLINIC).all<Record<string, unknown>>()).results;
  return {treatments, promotions};
}

async function upcoming(db: D1Database, phone: string): Promise<Appointment[]> {
  const today = pakistanParts().date;
  return (await db.prepare("SELECT id,patient_name,service,appointment_date,appointment_time,status,updated_at FROM appointments WHERE clinic_id=? AND phone=? AND appointment_date>=? AND status NOT IN ('Cancelled','Completed','Rescheduled','No Show') ORDER BY appointment_date,appointment_time LIMIT 10").bind(CLINIC, phone, today).all<Appointment>()).results;
}

function factsText(facts: Awaited<ReturnType<typeof loadFacts>>) {
  const services = facts.treatments.map((t) => `- ${t.name}: ${servicePriceLabel(t)}${t.duration ? `, about ${t.duration} min` : ""}${t.availability ? `, ${t.availability}` : ""}${t.booking_instructions ? `. Note: ${t.booking_instructions}` : ""}`).join("\n") || "- (no services listed)";
  const offers = facts.promotions.map((p) => `- ${p.name}: ${p.service} PKR ${Number(p.offer_price).toLocaleString("en-PK")} (was PKR ${Number(p.original_price).toLocaleString("en-PK")}), until ${p.expiry_date}`).join("\n") || "- none right now";
  return `CLINIC FACTS (verified):
Clinic: ${clinicProfile.name}. Doctor: ${clinicProfile.doctor}, ${clinicProfile.qualifications}, ${clinicProfile.designation}.
Timing: ${clinicProfile.hours} (appointments every ${SLOT} minutes from 5:00 PM, last slot 9:45 PM).
Address: ${clinicProfile.address}. Phone: ${clinicProfile.phone}, landline ${clinicProfile.landline}.
Consultation fee: PKR ${clinicProfile.consultationFee.toLocaleString("en-PK")}.
Services and prices:
${services}
Active offers:
${offers}`;
}

async function contextText(db: D1Database, contact: Contact, facts: Awaited<ReturnType<typeof loadFacts>>, appointments: Appointment[]) {
  const now = pakistanParts();
  const history = (await db.prepare("SELECT direction,content,created_at FROM whatsapp_messages WHERE clinic_id=? AND contact_key=? ORDER BY created_at DESC, rowid DESC LIMIT 12").bind(CLINIC, contact.contact_key).all<{direction: string; content: string; created_at: string}>()).results.reverse();
  const appts = appointments.map((a) => `- ${a.patient_name}: ${a.service} on ${fmtDate(a.appointment_date)} (${a.appointment_date}) at ${fmt12(a.appointment_time)} [${a.status}]`).join("\n") || "- none";
  return `currentDateTime: ${now.weekday} ${now.date} ${now.time} (Asia/Karachi)
${factsText(facts)}

WHATSAPP PROFILE NAME (unverified): ${contact.name || "unknown"}
UPCOMING APPOINTMENTS FOR THIS NUMBER:
${appts}
CURRENT BOOKING DRAFT: ${JSON.stringify(contact.draft)}

RECENT CONVERSATION (oldest first):
${history.map((m) => `${m.direction === "IN" ? "Patient" : "Clinic"}: ${m.content}`).join("\n") || "(new conversation)"}`;
}

function matchService(name: string | null | undefined, treatments: Treatment[]) {
  if (!name) return null;
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return treatments.find((t) => t.name.toLowerCase().replace(/[^a-z0-9]/g, "") === n)
    ?? treatments.find((t) => { const tn = t.name.toLowerCase().replace(/[^a-z0-9]/g, ""); return tn.includes(n) || n.includes(tn); })
    ?? null;
}

async function freeSlots(db: D1Database, date: string, from: string, excludeId?: string) {
  const taken = new Set((await db.prepare("SELECT appointment_time FROM appointments WHERE clinic_id=? AND appointment_date=? AND doctor=? AND status NOT IN ('Cancelled','Rescheduled') AND id<>?").bind(CLINIC, date, DOCTOR, excludeId || "").all<{appointment_time: string}>()).results.map((r) => r.appointment_time));
  const now = pakistanParts();
  const free: number[] = [];
  for (let m = toMin(OPEN); m + SLOT <= toMin(CLOSE); m += SLOT) {
    if (taken.has(toTime(m))) continue;
    if (date === now.date && m <= toMin(now.time)) continue;
    free.push(m);
  }
  // Offer the three free slots closest to the time the patient asked for.
  const target = toMin(from);
  const alternatives = free.sort((x, y) => Math.abs(x - target) - Math.abs(y - target) || x - y).slice(0, 3).sort((x, y) => x - y).map(toTime);
  return {taken, alternatives};
}

/** Checks date/time rules. Returns a normalised time or a reason it cannot be booked. */
function checkSlot(date: string, time: string): {ok: true; time: string; note?: string} | {ok: false; reason: string} {
  const now = pakistanParts();
  if (date < now.date) return {ok: false, reason: `DATE_IN_PAST: ${date} has already passed. Ask for a future date.`};
  let m = toMin(time);
  let note: string | undefined;
  if (m % SLOT) { const rounded = Math.round(m / SLOT) * SLOT; note = `Requested ${fmt12(time)} adjusted to ${fmt12(toTime(rounded))} (slots are every ${SLOT} minutes).`; m = rounded; }
  if (m < toMin(OPEN) || m + SLOT > toMin(CLOSE)) return {ok: false, reason: `OUTSIDE_HOURS: clinic timing is ${clinicProfile.hours}; ${fmt12(time)} is outside it. Ask for a time between 5:00 PM and 9:45 PM.`};
  if (date === now.date && m <= toMin(now.time)) return {ok: false, reason: `TIME_PASSED: ${fmt12(toTime(m))} today has already passed (now ${fmt12(now.time)}). Ask for a later time or another day.`};
  return {ok: true, time: toTime(m), note};
}

function missingOf(d: Draft) {
  return (["patientName", "service", "date", "time"] as const).filter((k) => !d[k]);
}
const MISSING_LABEL: Record<string, string> = {patientName: "patient's full name", service: "which treatment/service", date: "appointment date", time: "appointment time"};

/** Short template replies used when Gemini is unavailable for the reply step. */
function templateReply(result: {kind: string; text?: string}) {
  return result.text || "Ji, aap ka message mil gaya hai. Hamari team jald aap se rabta karegi.";
}

export async function handleTurn(db: D1Database, cfg: GeminiConfig, contact: Contact, turn: string): Promise<TurnResult> {
  const facts = await loadFacts(db);
  const appointments = await upcoming(db, contact.contact_key);
  const context = await contextText(db, contact, facts, appointments);
  const a: Analysis = await analyze(cfg, context, turn);
  const draft: Draft = {...contact.draft};
  let backend = "NO_ACTION: just answer the patient's question(s) from the clinic facts.";
  let fallback = "";
  let handover: string | null = null;
  let appointmentId: string | undefined;

  if (a.medical_urgency) {
    handover = "MEDICAL_URGENCY";
    backend = `MEDICAL_URGENCY: show care, advise them to seek immediate medical attention if symptoms are severe, and say the clinic team / ${DOCTOR} has been informed and will contact them.`;
    fallback = `Ji, aap ki takleef ka sun kar afsos hua. Agar symptoms zyada hain to foran qareebi hospital/emergency se rabta karein. Main ne ${DOCTOR} ki team ko inform kar diya hai, woh jald aap se rabta karenge.`;
  } else if (a.needs_human || a.intent === "HUMAN_REQUEST") {
    handover = "PATIENT_REQUESTED_HUMAN";
    backend = "HANDOVER: tell the patient a clinic staff member has been notified and will reply here soon; they do not need to repeat themselves.";
    fallback = "Ji, main ne clinic staff ko notify kar diya hai. Woh jald yahin aap ko reply karenge.";
  } else if (a.intent === "CANCEL" || (draft.pendingCancelId && a.explicit_confirmation && ["BOOKING_CONFIRMATION", "OTHER", "THANKS_BYE"].includes(a.intent))) {
    const target = appointments.length === 1 ? appointments[0] : appointments.find((x) => x.id === draft.pendingCancelId);
    if (!appointments.length) backend = "NO_UPCOMING_APPOINTMENT: this number has no upcoming appointment to cancel. Offer help with a new booking.";
    else if (!target) backend = `MULTIPLE_APPOINTMENTS: ask which one to cancel. Options:\n${appointments.map((x) => `- ${x.patient_name}, ${x.service}, ${fmtDate(x.appointment_date)} ${fmt12(x.appointment_time)}`).join("\n")}`;
    else if (a.explicit_confirmation && draft.pendingCancelId === target.id) {
      await db.batch([
        db.prepare("UPDATE appointments SET status='Cancelled',updated_at=CURRENT_TIMESTAMP WHERE clinic_id=? AND id=?").bind(CLINIC, target.id),
        db.prepare("INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), CLINIC, "whatsapp-ai", "CANCEL", "appointments", target.id, JSON.stringify({by: contact.contact_key})),
      ]);
      draft.pendingCancelId = undefined;
      backend = `CANCELLED: ${target.patient_name}'s ${target.service} appointment on ${fmtDate(target.appointment_date)} at ${fmt12(target.appointment_time)} has been cancelled. Offer to book another time if they want.`;
      fallback = `Ji, ${target.patient_name} ki ${fmtDate(target.appointment_date)} ${fmt12(target.appointment_time)} wali appointment cancel kar di gayi hai.`;
    } else {
      draft.pendingCancelId = target.id;
      backend = `CONFIRM_CANCEL: ask the patient to confirm cancelling ${target.patient_name}'s ${target.service} appointment on ${fmtDate(target.appointment_date)} at ${fmt12(target.appointment_time)}.`;
      fallback = `${target.patient_name} ki ${fmtDate(target.appointment_date)} ${fmt12(target.appointment_time)} wali appointment cancel kar dein? Confirm karne ke liye "haan" likh dein.`;
    }
  } else if (a.intent === "RESCHEDULE" && appointments.length) {
    const target = appointments[0];
    const date = a.date || draft.date, time = a.time || draft.time;
    if (!date || !time) {
      draft.date = date ?? undefined; draft.time = time ?? undefined;
      backend = `RESCHEDULE_NEEDS_DETAILS: appointment to move is ${target.patient_name}, ${target.service}, ${fmtDate(target.appointment_date)} ${fmt12(target.appointment_time)}. Ask for the new ${!date ? "date" : "time"}.`;
    } else {
      const slot = checkSlot(date, time);
      if (!slot.ok) backend = `RESCHEDULE_REJECTED: ${slot.reason}`;
      else {
        const {taken, alternatives} = await freeSlots(db, date, slot.time, target.id);
        if (taken.has(slot.time)) backend = `SLOT_TAKEN: ${fmtDate(date)} ${fmt12(slot.time)} is already booked. Offer these free times: ${alternatives.map(fmt12).join(", ") || "none that day; ask for another day"}.`;
        else {
          await db.batch([
            db.prepare("UPDATE appointments SET appointment_date=?,appointment_time=?,updated_at=CURRENT_TIMESTAMP WHERE clinic_id=? AND id=?").bind(date, slot.time, CLINIC, target.id),
            db.prepare("INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), CLINIC, "whatsapp-ai", "RESCHEDULE", "appointments", target.id, JSON.stringify({from: [target.appointment_date, target.appointment_time], to: [date, slot.time]})),
          ]);
          draft.date = undefined; draft.time = undefined;
          backend = `RESCHEDULED: ${target.patient_name}'s ${target.service} appointment moved to ${fmtDate(date)} at ${fmt12(slot.time)}.${slot.note ? " " + slot.note : ""}`;
          fallback = `Ji, ${target.patient_name} ki appointment ${fmtDate(date)} ${fmt12(slot.time)} par shift kar di gayi hai.`;
        }
      }
    }
  } else if (a.intent === "APPOINTMENT_STATUS") {
    backend = appointments.length ? `UPCOMING_APPOINTMENTS:\n${appointments.map((x) => `- ${x.patient_name}, ${x.service}, ${fmtDate(x.appointment_date)} ${fmt12(x.appointment_time)}`).join("\n")}` : "NO_UPCOMING_APPOINTMENT for this number. Offer to book one.";
  } else if (a.intent === "BOOKING_REQUEST" || a.intent === "BOOKING_CONFIRMATION" || (draft.active && ["OTHER", "INFO_QUESTION"].includes(a.intent) && (a.patient_name || a.date || a.time || a.service_name))) {
    draft.active = true;
    if (a.patient_name) draft.patientName = a.patient_name;
    const service = matchService(a.service_name, facts.treatments);
    if (service) draft.service = service.name;
    if (a.date) draft.date = a.date;
    if (a.time) draft.time = a.time;
    let rejected = "";
    if (draft.date && draft.time) {
      const slot = checkSlot(draft.date, draft.time);
      if (!slot.ok) { rejected = slot.reason; if (slot.reason.startsWith("DATE_IN_PAST")) draft.date = undefined; else draft.time = undefined; }
      else draft.time = slot.time;
    }
    const missing = missingOf(draft);
    if (rejected) backend = `BOOKING_NOT_POSSIBLE: ${rejected} Known details: ${JSON.stringify(draft)}.`;
    else if (missing.length) {
      const ask = missing[0];
      draft.askedCount = draft.lastAsked === ask ? (draft.askedCount || 0) + 1 : 1;
      draft.lastAsked = ask;
      if (draft.askedCount >= 4) { handover = "BOOKING_LOOP"; backend = "HANDOVER: booking details could not be collected after several tries; say staff will help complete the booking here."; }
      else backend = `BOOKING_DETAILS_NEEDED: still missing ${missing.map((k) => MISSING_LABEL[k]).join(", ")}. Ask ONLY for the ${MISSING_LABEL[ask]}${ask === "service" ? ` (services: ${facts.treatments.map((t) => t.name).join(", ")})` : ""}${ask === "time" ? " (5:00 PM to 9:45 PM)" : ""}. Known so far: ${JSON.stringify({name: draft.patientName, service: draft.service, date: draft.date, time: draft.time})}.`;
      fallback = ask === "patientName" ? "Appointment kis patient ke naam par book karni hai?" : ask === "service" ? "Kaunsa treatment ya service book karni hai?" : ask === "date" ? "Appointment kis date ko chahiye?" : "Kis time appointment chahiye? Clinic ki timing 5 se 10 baje shaam hai.";
    } else {
      const {taken, alternatives} = await freeSlots(db, draft.date!, draft.time!);
      if (taken.has(draft.time!)) {
        backend = `SLOT_TAKEN: ${fmtDate(draft.date!)} ${fmt12(draft.time!)} is already booked. Offer these free times: ${alternatives.map(fmt12).join(", ") || "none that day; ask for another day"}. Other details are saved.`;
        fallback = `${fmtDate(draft.date!)} ko ${fmt12(draft.time!)} ka slot available nahi hai.${alternatives.length ? ` Available: ${alternatives.map(fmt12).join(", ")}.` : " Koi aur din batayein."}`;
        draft.time = undefined;
      } else {
        const service = facts.treatments.find((t) => t.name === draft.service);
        const saved = await saveAppointment(db, "whatsapp-ai", {request_id: crypto.randomUUID(), record: {patient_name: draft.patientName, phone: contact.contact_key, service: draft.service, appointment_date: draft.date, appointment_time: draft.time, source: "WhatsApp AI", price: service?.price || 0, notes: "Booked by WhatsApp AI receptionist"}});
        appointmentId = String(saved.appointment?.id || "");
        backend = `CONFIRMED: appointment booked for ${draft.patientName}, ${draft.service}, ${fmtDate(draft.date!)} at ${fmt12(draft.time!)} with ${DOCTOR}. ${service ? `Price: ${servicePriceLabel(service)}.` : ""} Ask them to arrive 10 minutes early.`;
        fallback = `Ji, ${draft.patientName} ki ${draft.service} appointment ${fmtDate(draft.date!)} ko ${fmt12(draft.time!)} par confirm ho gayi hai. Please 10 minute pehle tashreef le aayein.`;
        for (const k of Object.keys(draft) as Array<keyof Draft>) delete draft[k];
      }
    }
  } else if (a.intent === "THANKS_BYE") {
    backend = "CLOSING: reply with one short polite closing line. Do not ask any question.";
  }

  let reply: string;
  try { reply = await writeReply(cfg, clinicProfile.name, DOCTOR, context, turn, backend); }
  catch (error) { console.error("[whatsapp-ai] reply generation failed, using template", error); reply = templateReply({kind: "fallback", text: fallback}); }
  return {reply, intent: a.intent, language: a.language, draft, handover, appointmentId};
}
