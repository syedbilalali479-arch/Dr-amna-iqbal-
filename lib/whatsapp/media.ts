// Downloads WhatsApp media through WaSender and keeps patient reports/prescriptions for the doctor.
import {sendingKey} from "../wasender.ts";

const BASE = "https://www.wasenderapi.com/api";
const CLINIC = "skinuvia";
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

/** Decrypts one WhatsApp media message (raw WaSender message JSON) and returns its bytes. */
export async function downloadMedia(token: string, sessionId: string | undefined, rawMessage: string, maxBytes = MAX_DOCUMENT_BYTES) {
  const key = await sendingKey(token, sessionId);
  const response = await fetch(`${BASE}/decrypt-media`, {method: "POST", headers: {Authorization: `Bearer ${key}`, "Content-Type": "application/json"}, body: JSON.stringify({data: {messages: JSON.parse(rawMessage)}}), signal: AbortSignal.timeout(20_000)});
  const body = (await response.json().catch(() => ({}))) as {publicUrl?: string};
  if (!response.ok || !body.publicUrl) throw new Error(`decrypt-media failed (${response.status})`);
  const file = await fetch(body.publicUrl, {signal: AbortSignal.timeout(30_000)});
  if (!file.ok) throw new Error(`media download failed (${file.status})`);
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > maxBytes) throw new Error(`file too large (${Math.round(bytes.byteLength / 1024 / 1024)} MB)`);
  return {bytes, contentType: file.headers.get("content-type") || ""};
}

type Item = {id?: string; kind: string; text?: string; raw: string; provider_message_id?: string; push_name?: string | null};

/** Saves a patient's photo/document. The record is kept even when the download fails, so staff still see it arrived. */
export async function savePatientDocument(db: D1Database, contactKey: string, item: Item, opts: {token?: string; sessionId?: string; contactName?: string | null}) {
  let message: Record<string, unknown> = {};
  try { message = (JSON.parse(item.raw)?.message || {}) as Record<string, unknown>; } catch { /* keep defaults */ }
  const media = (message.imageMessage || message.documentMessage || message.documentWithCaptionMessage || {}) as Record<string, unknown>;
  const caption = item.text && !/^\[(Image|Document)\]$/.test(item.text) ? item.text : String(media.caption || "");
  let mime = String(media.mimetype || (item.kind === "image" ? "image/jpeg" : "application/octet-stream")).split(";")[0];
  const fileName = String(media.fileName || media.title || (item.kind === "image" ? "photo.jpg" : "document"));
  let data: Uint8Array | null = null, error: string | null = null;
  try {
    if (!opts.token) throw new Error("WHATSAPP_API_TOKEN missing, file could not be downloaded");
    const file = await downloadMedia(opts.token, opts.sessionId, item.raw);
    data = new Uint8Array(file.bytes);
    if (!media.mimetype && file.contentType) mime = file.contentType.split(";")[0];
  } catch (e) { error = e instanceof Error ? e.message : String(e); }
  const patient = await db.prepare("SELECT patient_name FROM appointments WHERE clinic_id=? AND phone=? ORDER BY appointment_date DESC, appointment_time DESC LIMIT 1").bind(CLINIC, contactKey).first<{patient_name: string}>();
  const id = `DOC-${crypto.randomUUID()}`;
  await db.prepare("INSERT OR IGNORE INTO patient_documents(id,clinic_id,contact_key,phone,patient_name,kind,mime_type,file_name,caption,size,data,status,error,provider_message_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,'New',?,?)")
    .bind(id, CLINIC, contactKey, contactKey.startsWith("+") ? contactKey : "", patient?.patient_name || opts.contactName || item.push_name || "WhatsApp patient", item.kind === "image" ? "image" : "document", mime, fileName.slice(0, 200), caption.slice(0, 1000), data?.byteLength || 0, data, error, item.provider_message_id || id).run();
  return {id, saved: Boolean(data), error};
}

export function forwardedReply(language: string, doctor: string) {
  if (language === "ENGLISH") return `Thank you, we have received your report/prescription and forwarded it to ${doctor}. She will review it and reply to you here soon.`;
  if (language === "URDU") return "جی، آپ کی رپورٹ / نسخہ موصول ہو گیا ہے اور ڈاکٹر آمنہ اقبال کو بھیج دیا گیا ہے۔ وہ دیکھ کر آپ کو بہتر رہنمائی کریں گی اور جلد یہیں جواب دیں گی۔";
  return `Ji, aap ki report / prescription mil gayi hai aur ${doctor} ko forward kar di gayi hai. Woh dekh kar aap ko behtar guide karengi aur jald yahin jawab de dengi.`;
}
