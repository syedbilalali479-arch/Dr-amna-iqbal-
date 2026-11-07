// WhatsApp receptionist engine (modelled on the Dr. Nighat clinic flow):
// 1. webhook stores every inbound message durably (duplicates ignored)
// 2. replies wait for a short quiet period so a burst of messages gets ONE answer
// 3. one worker per contact; the AI brain decides, the backend books
// 4. every reply goes through a persistent outbox with retries
// 5. a background sweeper recovers anything missed after a restart
import {env} from "@/lib/runtime-env";
import {runHybrid} from "../ai/hybrid-orchestrator.ts";
import {sendText, sendingKey} from "../wasender.ts";
import {parseWebhook, type InboundItem} from "./payload.ts";
import {handleTurn, type Contact, type Draft} from "./brain.ts";
import {transcribe, type GeminiConfig, type Language} from "./gemini.ts";

const CLINIC = "skinuvia";
const BASE = "https://www.wasenderapi.com/api";
const HANDOVER_MINUTES = 15;

type RuntimeEnv = typeof env & {GEMINI_API_KEY?: string; GEMINI_MODEL?: string; GEMINI_DAILY_CALL_LIMIT?: string; WHATSAPP_AI_DAILY_LIMIT?: string; WHATSAPP_MESSAGE_REPLY_DELAY_MS?: string; WHATSAPP_CALL_REPLY_DELAY_MS?: string};
const runtime = () => env as RuntimeEnv;
const db = () => env.DB!;
const replyDelay = () => Number(runtime().WHATSAPP_MESSAGE_REPLY_DELAY_MS || 5000);
const callDelay = () => Number(runtime().WHATSAPP_CALL_REPLY_DELAY_MS || 15000);
const iso = (ms = Date.now()) => new Date(ms).toISOString();
const id = (p: string) => `${p}-${crypto.randomUUID()}`;
const conversationId = (key: string) => "WAC-" + key.replace(/[^0-9a-z]/gi, "").slice(-20);

export const activity: Array<Record<string, unknown>> = [];
export function log(entry: Record<string, unknown>) {
  const row = {at: iso(), ...entry};
  activity.unshift(row);
  activity.length = Math.min(activity.length, 40);
  console.log("[whatsapp-ai]", JSON.stringify(row));
}

// ---------- 1. accept ----------
export async function acceptWebhook(payload: unknown) {
  const {event, items} = parseWebhook(payload);
  let accepted = 0;
  for (const item of items) {
    const wait = item.kind === "call" ? callDelay() : item.kind === "text" ? replyDelay() : 1000;
    const result = await db().prepare("INSERT OR IGNORE INTO whatsapp_inbound(id,clinic_id,provider_message_id,contact_key,reply_to,push_name,kind,text,raw,available_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
      .bind(id("IN"), CLINIC, item.providerMessageId, item.contactKey, item.replyTo, item.pushName || null, item.kind, item.text.slice(0, 4000), JSON.stringify(item.raw).slice(0, 20000), iso(Date.now() + wait)).run();
    if (!result.meta?.changes) continue;
    accepted++;
    // Debounce: every new message from this contact moves its reply back.
    if (item.kind === "text") await db().prepare("UPDATE whatsapp_inbound SET available_at=? WHERE clinic_id=? AND contact_key=? AND status='RECEIVED' AND kind='text'").bind(iso(Date.now() + wait), CLINIC, item.contactKey).run();
    schedule(item.contactKey, wait);
  }
  ensureSweeper();
  return {event, received: items.length, accepted};
}

// ---------- 2. per-contact scheduling ----------
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const running = new Set<string>();
const rerun = new Set<string>();

function schedule(key: string, delayMs: number) {
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => { timers.delete(key); void processContact(key); }, Math.max(50, delayMs + 50));
  (timer as {unref?: () => void}).unref?.();
  timers.set(key, timer);
}

export async function processContact(key: string) {
  if (running.has(key)) { rerun.add(key); return; }
  running.add(key);
  try {
    do {
      rerun.delete(key);
      const pending = (await db().prepare("SELECT * FROM whatsapp_inbound WHERE clinic_id=? AND contact_key=? AND status='RECEIVED' ORDER BY created_at, rowid").bind(CLINIC, key).all<Record<string, string>>()).results;
      if (!pending.length) break;
      const latest = Math.max(...pending.map((p) => Date.parse(p.available_at)));
      if (latest > Date.now()) { schedule(key, latest - Date.now()); break; }
      const ids = pending.map((p) => p.id);
      await db().prepare(`UPDATE whatsapp_inbound SET status='PROCESSING',attempts=attempts+1 WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).run();
      try {
        await handleBatch(key, pending);
        await db().prepare(`UPDATE whatsapp_inbound SET status='PROCESSED',error=NULL WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).run();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log({contact: mask(key), stage: "process", error: message});
        const retry = Number(pending[0].attempts || 0) < 2;
        await db().prepare(`UPDATE whatsapp_inbound SET status=?,error=?,available_at=? WHERE id IN (${ids.map(() => "?").join(",")})`).bind(retry ? "RECEIVED" : "FAILED", message.slice(0, 500), iso(Date.now() + 30_000), ...ids).run();
        if (retry) schedule(key, 30_000);
      }
    } while (rerun.has(key));
  } finally {
    running.delete(key);
  }
}

const mask = (key: string) => key.length > 6 ? key.slice(0, 4) + "…" + key.slice(-3) : key;

// ---------- 3. handle one combined patient turn ----------
async function loadContact(key: string, replyTo: string, pushName: string | null): Promise<Contact & {mode: string}> {
  await db().prepare("INSERT INTO whatsapp_contacts(clinic_id,contact_key,reply_to,name,last_message_at) VALUES(?,?,?,?,?) ON CONFLICT(clinic_id,contact_key) DO UPDATE SET reply_to=excluded.reply_to,name=COALESCE(excluded.name,whatsapp_contacts.name),updated_at=CURRENT_TIMESTAMP").bind(CLINIC, key, replyTo, pushName, iso()).run();
  const row = await db().prepare("SELECT * FROM whatsapp_contacts WHERE clinic_id=? AND contact_key=?").bind(CLINIC, key).first<Record<string, unknown>>();
  const conv = await db().prepare("SELECT mode FROM conversations WHERE clinic_id=? AND id=?").bind(CLINIC, conversationId(key)).first<{mode: string}>();
  let draft: Draft = {};
  try { draft = JSON.parse(String(row?.draft || "{}")); } catch { draft = {}; }
  // A booking draft older than a day is stale.
  if (row?.last_message_at && Date.now() - Date.parse(String(row.last_message_at)) > 24 * 3600_000) draft = {};
  return {contact_key: key, reply_to: replyTo, name: (row?.name as string) || pushName, language: ((row?.language as Language) || "ROMAN_URDU"), draft, human_controlled: Number(row?.human_controlled || 0), handover_at: (row?.handover_at as string) || null, mode: conv?.mode || "AI"};
}

async function recordInbound(key: string, items: Array<Record<string, string>>, texts: string[]) {
  for (const [i, item] of items.entries()) await db().prepare("INSERT INTO whatsapp_messages(id,clinic_id,contact_key,direction,content,provider_message_id,status,source) VALUES(?,?,?,'IN',?,?,'RECEIVED',?)").bind(id("MSG"), CLINIC, key, texts[i] || item.text, item.provider_message_id, item.kind).run();
}

async function upsertConversation(contact: Contact, lastMessage: string, intent: string, mode: string, unread: boolean, state: unknown) {
  await db().prepare("INSERT INTO conversations(id,clinic_id,contact_name,phone,last_message,mode,intent,status,unread,state) VALUES(?,?,?,?,?,?,?,'Open',?,?) ON CONFLICT(id) DO UPDATE SET contact_name=excluded.contact_name,last_message=excluded.last_message,mode=excluded.mode,intent=excluded.intent,status='Open',unread=CASE WHEN excluded.unread=1 THEN conversations.unread+1 ELSE conversations.unread END,state=excluded.state,updated_at=CURRENT_TIMESTAMP")
    .bind(conversationId(contact.contact_key), CLINIC, contact.name || "WhatsApp Contact", contact.contact_key, lastMessage.slice(0, 500), mode, intent, unread ? 1 : 0, JSON.stringify(state)).run();
}

async function transcribeVoice(item: Record<string, string>, cfg: GeminiConfig | null) {
  if (!cfg || !runtime().WHATSAPP_API_TOKEN) return null;
  try {
    const key = await sendingKey(runtime().WHATSAPP_API_TOKEN!, runtime().WHATSAPP_SESSION_ID);
    const response = await fetch(`${BASE}/decrypt-media`, {method: "POST", headers: {Authorization: `Bearer ${key}`, "Content-Type": "application/json"}, body: JSON.stringify({data: {messages: JSON.parse(item.raw)}}), signal: AbortSignal.timeout(20_000)});
    const body = (await response.json().catch(() => ({}))) as {publicUrl?: string};
    if (!response.ok || !body.publicUrl) throw new Error(`decrypt-media failed (${response.status})`);
    const audio = await fetch(body.publicUrl, {signal: AbortSignal.timeout(20_000)});
    if (!audio.ok) throw new Error(`audio download failed (${audio.status})`);
    const bytes = await audio.arrayBuffer();
    if (bytes.byteLength > 20 * 1024 * 1024) throw new Error("voice note too large");
    const mime = (JSON.parse(item.raw)?.message?.audioMessage?.mimetype as string) || audio.headers.get("content-type") || "audio/ogg";
    const text = (await transcribe(cfg, bytes, mime)).trim();
    return text.length < 2 || /\[unclear\]/i.test(text) ? null : text;
  } catch (error) {
    log({stage: "voice", error: error instanceof Error ? error.message : String(error)});
    return null;
  }
}

async function geminiConfig(): Promise<GeminiConfig | null> {
  const r = runtime();
  if (!r.GEMINI_API_KEY) return null;
  const limit = Number(r.WHATSAPP_AI_DAILY_LIMIT || 1500);
  const used = await db().prepare("SELECT COUNT(*) AS n FROM whatsapp_ai_usage WHERE clinic_id=? AND created_at>=date('now')").bind(CLINIC).first<{n: number}>();
  if (Number(used?.n || 0) >= limit) { log({stage: "ai", note: "daily Gemini limit reached, using basic replies"}); return null; }
  return {apiKey: r.GEMINI_API_KEY, model: r.GEMINI_MODEL || "gemini-2.5-flash-lite", onCall: async (operation, ok, ms) => { await db().prepare("INSERT INTO whatsapp_ai_usage(id,clinic_id,operation,outcome,latency_ms) VALUES(?,?,?,?,?)").bind(id("AIU"), CLINIC, operation, ok ? "SUCCESS" : "FAILED", ms).run(); }};
}

async function handleBatch(key: string, items: Array<Record<string, string>>) {
  const last = items[items.length - 1];
  const contact = await loadContact(key, last.reply_to, items.map((i) => i.push_name).filter(Boolean).pop() || null);
  const cfg = await geminiConfig();

  // Missed calls get a short WhatsApp message, nothing else.
  const calls = items.filter((i) => i.kind === "call");
  const messages = items.filter((i) => i.kind !== "call");
  if (calls.length && !messages.length) {
    await recordInbound(key, calls, []);
    await queueReply(contact, "Assalam-o-Alaikum! Main Skinuvia clinic ki assistant hoon. Is waqt call attend nahi ho saki. Aap yahin message kar dein, main aap ki madad karti hoon.", "CALL", "call_auto_reply");
    await upsertConversation(contact, "[Missed call]", "call", contact.mode, true, {draft: contact.draft});
    return;
  }

  // Voice notes are transcribed; pictures/documents are flagged for staff.
  const texts: string[] = [];
  let voiceFailed = false;
  for (const item of messages) {
    if (item.kind === "audio") { const t = await transcribeVoice(item, cfg); if (t) texts.push(`[Voice note] ${t}`); else { texts.push("[Voice note - could not be understood]"); voiceFailed = true; } }
    else if (item.kind === "image" || item.kind === "document") texts.push(`[Patient sent a ${item.kind === "image" ? "photo" : "document"} for the doctor to see]${item.text && !/^\[(Image|Document)\]$/.test(item.text) ? " " + item.text : ""}`);
    else texts.push(item.text);
  }
  await recordInbound(key, messages, texts);
  const turn = texts.length > 1 ? texts.map((t, i) => `[Message ${i + 1}] ${t}`).join("\n") : texts[0] || "";

  // Staff manually took over (Inbox mode = Human): stay silent.
  if (contact.mode === "Human" && !contact.human_controlled) { await upsertConversation(contact, turn, "human", "Human", true, {draft: contact.draft}); log({contact: mask(key), stage: "skip", reason: "staff has taken over (mode Human)"}); return; }
  // AI handover still active: acknowledge, don't run the AI. Auto-release after 15 minutes.
  if (contact.human_controlled && contact.handover_at && Date.now() - Date.parse(contact.handover_at) < HANDOVER_MINUTES * 60_000) {
    const recentAck = await db().prepare("SELECT 1 FROM whatsapp_messages WHERE clinic_id=? AND contact_key=? AND direction='OUT' AND intent='HANDOVER_ACK' AND created_at>=datetime('now','-5 minutes')").bind(CLINIC, key).first();
    if (!recentAck) await queueReply(contact, "Ji, aap ka message mil gaya hai. Main ne staff ko dobara notify kar diya hai, woh jald yahin reply karenge.", "HANDOVER_ACK", "handover");
    await upsertConversation(contact, turn, "human", "Human", true, {draft: contact.draft});
    return;
  }
  if (contact.human_controlled) await db().prepare("UPDATE whatsapp_contacts SET human_controlled=0,handover_at=NULL,handover_reason=NULL WHERE clinic_id=? AND contact_key=?").bind(CLINIC, key).run();

  if (voiceFailed && texts.every((t) => t.startsWith("[Voice note - "))) {
    await queueReply(contact, "Aap ka voice note mil gaya hai, lekin abhi main isay clear sun nahi pa rahi. Please apni baat short text mein likh dein, main foran madad karti hoon.", "VOICE_UNCLEAR", "voice");
    await upsertConversation(contact, turn, "voice", "AI", true, {draft: contact.draft});
    return;
  }

  let reply: string | null = null, intent = "OTHER", language = contact.language, draft = contact.draft, handover: string | null | undefined = null, route = "gemini";
  if (cfg) {
    try { ({reply, intent, language, draft, handover} = await handleTurn(db(), cfg, contact, turn)); }
    catch (error) { log({contact: mask(key), stage: "gemini", error: error instanceof Error ? error.message : String(error), fallback: "basic engine"}); route = "basic"; }
  } else route = "basic";
  if (route === "basic") {
    const startedAt = iso(Date.now() - 1000);
    const result = await runHybrid(db(), {name: contact.name || undefined, phone: key, message: texts.join("\n")}, {geminiApiKey: runtime().GEMINI_API_KEY, geminiModel: runtime().GEMINI_MODEL, geminiDailyLimit: Number(runtime().GEMINI_DAILY_CALL_LIMIT || 150)});
    reply = result.response; intent = String(result.intent); handover = result.state?.handoff ? "BASIC_ENGINE_HANDOFF" : null;
    // runHybrid logs one Inbox row per message; keep a single row per contact instead.
    await db().prepare("DELETE FROM conversations WHERE clinic_id=? AND phone=? AND id LIKE 'WA-%' AND created_at>=?").bind(CLINIC, key, startedAt.replace("T", " ").slice(0, 19)).run();
  }

  await db().prepare("UPDATE whatsapp_contacts SET draft=?,language=?,last_message_at=?,human_controlled=?,handover_at=?,handover_reason=?,updated_at=CURRENT_TIMESTAMP WHERE clinic_id=? AND contact_key=?")
    .bind(JSON.stringify(draft || {}), language, iso(), handover ? 1 : 0, handover ? iso() : null, handover || null, CLINIC, key).run();
  if (reply) await queueReply(contact, reply, intent, route);
  await upsertConversation(contact, turn, intent.toLowerCase(), handover ? "Human" : "AI", true, {draft, handover});
  log({contact: mask(key), stage: "replied", route, intent, handover: handover || undefined, messages: messages.length});
}

// ---------- 4. outbox ----------
async function queueReply(contact: Contact, text: string, intent: string, source: string) {
  const msgId = id("MSG");
  await db().prepare("INSERT INTO whatsapp_messages(id,clinic_id,contact_key,direction,content,status,intent,source,next_attempt_at) VALUES(?,?,?,'OUT',?,'PENDING',?,?,?)").bind(msgId, CLINIC, contact.contact_key, text, intent, source, iso()).run();
  await deliver(msgId);
}

const BACKOFF = [30_000, 120_000, 600_000, 1_800_000];
async function deliver(msgId: string) {
  const msg = await db().prepare("SELECT m.*, c.reply_to FROM whatsapp_messages m JOIN whatsapp_contacts c ON c.clinic_id=m.clinic_id AND c.contact_key=m.contact_key WHERE m.id=? AND m.status IN ('PENDING','RETRY')").bind(msgId).first<Record<string, string>>();
  if (!msg) return;
  const claim = await db().prepare("UPDATE whatsapp_messages SET status='SENDING' WHERE id=? AND status IN ('PENDING','RETRY')").bind(msgId).run();
  if (!claim.meta?.changes) return; // another worker is already sending it
  const token = runtime().WHATSAPP_API_TOKEN;
  try {
    if (!token) throw new Error("WHATSAPP_API_TOKEN missing in Railway variables");
    await sendText(token, runtime().WHATSAPP_SESSION_ID, msg.reply_to, msg.content);
    await db().prepare("UPDATE whatsapp_messages SET status='SENT',attempts=attempts+1,error=NULL WHERE id=?").bind(msgId).run();
  } catch (error) {
    const attempts = Number(msg.attempts || 0) + 1;
    const message = error instanceof Error ? error.message : String(error);
    const retry = attempts <= BACKOFF.length;
    await db().prepare("UPDATE whatsapp_messages SET status=?,attempts=?,error=?,next_attempt_at=? WHERE id=?").bind(retry ? "RETRY" : "FAILED", attempts, message.slice(0, 500), iso(Date.now() + (BACKOFF[attempts - 1] || 0)), msgId).run();
    log({stage: "send", error: message, attempt: attempts, willRetry: retry});
  }
}

// ---------- 5. sweeper (restart recovery + outbox retries) ----------
const g = globalThis as {__waSweeper?: ReturnType<typeof setInterval>};
export function ensureSweeper() {
  if (g.__waSweeper) return;
  g.__waSweeper = setInterval(() => { void sweep().catch((e) => console.error("[whatsapp-ai] sweep failed", e)); }, 15_000);
  (g.__waSweeper as {unref?: () => void}).unref?.();
  void sweep().catch(() => undefined);
}

async function sweep() {
  if (!env.DB) return;
  // Work interrupted by a restart.
  const stuck = (await db().prepare("SELECT id,contact_key FROM whatsapp_inbound WHERE clinic_id=? AND status='PROCESSING' AND created_at<=datetime('now','-5 minutes')").bind(CLINIC).all<{id: string; contact_key: string}>()).results;
  for (const row of stuck) if (!running.has(row.contact_key)) await db().prepare("UPDATE whatsapp_inbound SET status='RECEIVED' WHERE id=? AND status='PROCESSING'").bind(row.id).run();
  // A send interrupted by a restart: retry it (WaSender may rarely have sent it already).
  await db().prepare("UPDATE whatsapp_messages SET status='RETRY' WHERE clinic_id=? AND direction='OUT' AND status='SENDING' AND created_at<=datetime('now','-10 minutes')").bind(CLINIC).run();
  const due = (await db().prepare("SELECT DISTINCT contact_key FROM whatsapp_inbound WHERE clinic_id=? AND status='RECEIVED' AND available_at<=? LIMIT 20").bind(CLINIC, iso()).all<{contact_key: string}>()).results;
  for (const row of due) if (!running.has(row.contact_key) && !timers.has(row.contact_key)) void processContact(row.contact_key);
  const retries = (await db().prepare("SELECT id FROM whatsapp_messages WHERE clinic_id=? AND direction='OUT' AND status IN ('PENDING','RETRY') AND next_attempt_at<=? ORDER BY created_at LIMIT 10").bind(CLINIC, iso()).all<{id: string}>()).results;
  for (const row of retries) await deliver(row.id);
}

export type {InboundItem};
