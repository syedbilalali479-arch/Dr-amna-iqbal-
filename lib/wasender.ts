// WaSender has two kinds of keys:
//  - Personal Access Token: manages sessions (/whatsapp-sessions/...: connect, QR, settings)
//  - Session API key: sends messages (/send-message, /upload)
// WHATSAPP_API_TOKEN may be either. When it is the access token we look up the session's own
// API key and webhook secret, so sending and webhook verification work without extra setup.
const BASE = "https://www.wasenderapi.com/api";
export const WEBHOOK_EVENTS = ["messages.received", "messages.upsert"];

export type SessionInfo = {apiKey?: string; webhookSecret?: string; webhookUrl?: string; webhookEnabled?: boolean; webhookEvents?: string[]; status?: string};
let cached: {at: number; info: SessionInfo | null} | null = null;

export async function sessionInfo(token: string, sessionId?: string, force = false): Promise<SessionInfo | null> {
  if (!sessionId) return null;
  if (!force && cached && Date.now() - cached.at < 5 * 60_000) return cached.info;
  let info: SessionInfo | null = null;
  try {
    const response = await fetch(`${BASE}/whatsapp-sessions/${sessionId}`, {headers: {Authorization: `Bearer ${token}`}});
    const body = (await response.json().catch(() => ({}))) as {success?: boolean; data?: Record<string, unknown>};
    const d = body.data;
    if (response.ok && body.success !== false && d) {
      info = {
        apiKey: (d.api_key as string) || undefined,
        webhookSecret: (d.webhook_secret as string) || undefined,
        webhookUrl: (d.webhook_url as string) || undefined,
        webhookEnabled: Boolean(d.webhook_enabled),
        webhookEvents: Array.isArray(d.webhook_events) ? (d.webhook_events as string[]) : [],
        status: (d.status as string) || undefined,
      };
    }
  } catch (error) {
    console.error("[wasender] session lookup failed", error);
  }
  cached = {at: Date.now(), info};
  return info;
}

/** Key to use for /send-message: the session API key if we can find it, else the configured token. */
export async function sendingKey(token: string, sessionId?: string) {
  return (await sessionInfo(token, sessionId))?.apiKey || token;
}

export async function sendText(token: string, sessionId: string | undefined, to: string, text: string) {
  const key = await sendingKey(token, sessionId);
  const response = await fetch(`${BASE}/send-message`, {method: "POST", headers: {Authorization: `Bearer ${key}`, "Content-Type": "application/json"}, body: JSON.stringify({to, text})});
  const body = (await response.json().catch(() => ({}))) as {success?: boolean; message?: string};
  if (!response.ok || body.success === false) throw new Error(`WaSender send failed (${response.status}): ${body.message || "unknown error"}`);
}

/** Make sure WaSender posts incoming messages to this app. Returns what happened. */
export async function ensureWebhook(token: string, sessionId: string | undefined, url: string) {
  const info = await sessionInfo(token, sessionId, true);
  if (!info) return {ok: false, reason: "Could not read the WaSender session (check WHATSAPP_API_TOKEN is the Personal Access Token and WHATSAPP_SESSION_ID is correct)"};
  const events = info.webhookEvents || [];
  if (info.webhookUrl === url && info.webhookEnabled && events.includes("messages.received")) return {ok: true, changed: false};
  const response = await fetch(`${BASE}/whatsapp-sessions/${sessionId}`, {
    method: "PUT",
    headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/json"},
    body: JSON.stringify({webhook_url: url, webhook_enabled: true, webhook_events: Array.from(new Set([...events, ...WEBHOOK_EVENTS]))}),
  });
  const body = (await response.json().catch(() => ({}))) as {success?: boolean; message?: string};
  await sessionInfo(token, sessionId, true);
  if (!response.ok || body.success === false) return {ok: false, reason: `WaSender rejected webhook update (${response.status}): ${body.message || "unknown"}`};
  return {ok: true, changed: true};
}

export function publicWebhookUrl(request: Request) {
  const host = process.env.RAILWAY_PUBLIC_DOMAIN || request.headers.get("x-forwarded-host") || new URL(request.url).host;
  return `https://${host}/api/whatsapp/webhook`;
}
