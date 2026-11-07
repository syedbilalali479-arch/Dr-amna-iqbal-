import {env} from "@/lib/runtime-env";
import {runHybrid} from "../../../../lib/ai/hybrid-orchestrator";

// Incoming WhatsApp messages from WaSender. Set this URL as the session webhook in the
// WaSender dashboard (https://<your-domain>/api/whatsapp/webhook) and enable the
// "messages.received" / "messages.upsert" events. The same value as the dashboard's
// webhook secret must be set as WHATSAPP_WEBHOOK_SECRET.
const CLINIC = "skinuvia";
const SEND_URL = "https://www.wasenderapi.com/api/send-message";

type RuntimeEnv = typeof env & {
  WHATSAPP_WEBHOOK_SECRET?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_DAILY_CALL_LIMIT?: string;
};

type WaMessage = {
  key?: {id?: string; fromMe?: boolean; remoteJid?: string; senderPn?: string; cleanedSenderPn?: string; participant?: string};
  pushName?: string;
  messageBody?: string;
  message?: {conversation?: string; extendedTextMessage?: {text?: string}; imageMessage?: {caption?: string}; videoMessage?: {caption?: string}};
};

function textOf(m: WaMessage) {
  return (m.messageBody || m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || m.message?.videoMessage?.caption || "").trim();
}

// Prefer the real phone number. Newer WhatsApp payloads often use a private "@lid" remoteJid
// with no phone number at all; in that case we reply to the JID itself so the patient still
// gets an answer.
function senderOf(m: WaMessage): {phone: string; to: string} | null {
  const k = m.key || {};
  for (const c of [k.cleanedSenderPn, k.senderPn, k.remoteJid]) {
    if (!c || /@(g\.us|lid|broadcast|newsletter)$/.test(c)) continue;
    const digits = c.split("@")[0].split(":")[0].replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) return {phone: "+" + digits, to: "+" + digits};
  }
  if (k.remoteJid?.endsWith("@lid")) return {phone: k.remoteJid, to: k.remoteJid};
  return null;
}

// Last few webhook hits, kept in memory for the diagnostics view (GET ?key=<webhook secret>).
const recent: Array<Record<string, unknown>> = [];
function remember(entry: Record<string, unknown>) {
  const row = {at: new Date().toISOString(), ...entry};
  recent.unshift(row);
  recent.length = Math.min(recent.length, 20);
  console.log("[whatsapp-webhook]", JSON.stringify(row));
}

function isGroupOrStatus(m: WaMessage) {
  const jid = m.key?.remoteJid || "";
  return jid.endsWith("@g.us") || jid.endsWith("@broadcast") || jid.endsWith("@newsletter");
}

async function sendReply(token: string, to: string, text: string) {
  const response = await fetch(SEND_URL, {method: "POST", headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"}, body: JSON.stringify({to, text})});
  const body = (await response.json().catch(() => ({}))) as {success?: boolean; message?: string};
  if (!response.ok || body.success === false) throw new Error(body.message || `WhatsApp send failed (${response.status})`);
}

export async function GET(request: Request) {
  const runtime = env as RuntimeEnv;
  const key = new URL(request.url).searchParams.get("key");
  const base = {ok: true, endpoint: "whatsapp-webhook"};
  if (!runtime.WHATSAPP_WEBHOOK_SECRET || key !== runtime.WHATSAPP_WEBHOOK_SECRET) return Response.json(base);
  return Response.json({...base, config: {apiToken: Boolean(runtime.WHATSAPP_API_TOKEN), webhookSecret: true, gemini: Boolean(runtime.GEMINI_API_KEY)}, recent});
}

export async function POST(request: Request) {
  const runtime = env as RuntimeEnv;
  const secret = runtime.WHATSAPP_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-webhook-signature") !== secret) {
    remember({status: 401, reason: "webhook secret mismatch - WHATSAPP_WEBHOOK_SECRET must equal the WaSender webhook secret", signatureSent: Boolean(request.headers.get("x-webhook-signature"))});
    return Response.json({error: "Invalid webhook signature"}, {status: 401});
  }
  if (!runtime.WHATSAPP_API_TOKEN) remember({status: 503, reason: "WHATSAPP_API_TOKEN missing in Railway variables"});
  if (!runtime.WHATSAPP_API_TOKEN) return Response.json({error: "WHATSAPP_API_TOKEN is not configured"}, {status: 503});

  let payload: {event?: string; data?: {messages?: WaMessage | WaMessage[]}};
  try { payload = await request.json(); } catch { return Response.json({error: "Invalid JSON"}, {status: 400}); }

  const event = String(payload.event || "");
  if (event === "webhook.test") { remember({event, status: 200}); return Response.json({ok: true}); }
  if (!event.startsWith("messages")) remember({event, ignored: true});
  if (!event.startsWith("messages")) return Response.json({ok: true, ignored: event || "unknown"});

  const raw = payload.data?.messages;
  const messages = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const db = env.DB!;
  const results: Array<Record<string, unknown>> = [];

  for (const m of messages) {
    try {
      if (m.key?.fromMe || isGroupOrStatus(m)) { results.push({skipped: "outgoing/group"}); continue; }
      const text = textOf(m), sender = senderOf(m);
      if (!text || !sender) { results.push({skipped: text ? "no sender" : "no text (media/sticker?)", jid: m.key?.remoteJid}); continue; }
      const {phone, to} = sender;

      // WaSender can deliver the same message more than once (e.g. received + upsert, or retries).
      const messageId = m.key?.id || crypto.randomUUID();
      const dedupe = await db.prepare("INSERT OR IGNORE INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?,?,?)")
        .bind(`WA-IN-${messageId}`, CLINIC, "whatsapp-webhook", "WHATSAPP_RECEIVED", "conversations", phone, JSON.stringify({phone, length: text.length})).run();
      if (!dedupe.meta?.changes) { results.push({skipped: "duplicate"}); continue; }

      // Staff has taken over this chat: record nothing automatic, stay silent.
      const handoff = await db.prepare("SELECT handoff FROM conversation_states WHERE clinic_id=? AND phone=? AND handoff=1 AND expires_at>datetime('now')").bind(CLINIC, phone).first();
      if (handoff) { results.push({skipped: "staff handoff"}); continue; }

      const result = await runHybrid(db, {name: m.pushName?.trim() || undefined, phone, message: text.slice(0, 2000)}, {
        geminiApiKey: runtime.GEMINI_API_KEY,
        geminiModel: runtime.GEMINI_MODEL,
        geminiDailyLimit: Number(runtime.GEMINI_DAILY_CALL_LIMIT || 150),
      });
      if (result.response) await sendReply(runtime.WHATSAPP_API_TOKEN, to, result.response);
      results.push({replied: Boolean(result.response), intent: result.intent});
    } catch (error) {
      console.error("WhatsApp webhook error", error);
      results.push({error: error instanceof Error ? error.message : "failed"});
    }
  }
  remember({event, results});
  // Always 200 so WaSender does not keep retrying a message we already handled.
  return Response.json({ok: true, results});
}
