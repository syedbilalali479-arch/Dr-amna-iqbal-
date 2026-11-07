import {env} from "@/lib/runtime-env";
import {ensureWebhook, publicWebhookUrl, sessionInfo} from "../../../../lib/wasender";
import {acceptWebhook, activity, ensureSweeper, log} from "../../../../lib/whatsapp/engine";

// WaSender posts every WhatsApp event here. Messages are stored first and answered by the
// AI receptionist a few seconds later (see lib/whatsapp/engine.ts).
type RuntimeEnv = typeof env & {WHATSAPP_WEBHOOK_SECRET?: string; GEMINI_API_KEY?: string};
const CLINIC = "skinuvia";

async function secrets() {
  const runtime = env as RuntimeEnv;
  const info = runtime.WHATSAPP_API_TOKEN ? await sessionInfo(runtime.WHATSAPP_API_TOKEN, runtime.WHATSAPP_SESSION_ID) : null;
  return {info, list: [runtime.WHATSAPP_WEBHOOK_SECRET, info?.webhookSecret].filter(Boolean) as string[]};
}

// Opening this URL in a browser also registers it as the WaSender session webhook.
// Add ?key=<webhook secret> to see diagnostics.
export async function GET(request: Request) {
  const runtime = env as RuntimeEnv;
  ensureSweeper();
  let webhook: Record<string, unknown> = {ok: false, reason: "WHATSAPP_API_TOKEN / WHATSAPP_SESSION_ID not set in Railway"};
  if (runtime.WHATSAPP_API_TOKEN && runtime.WHATSAPP_SESSION_ID) {
    try { webhook = await ensureWebhook(runtime.WHATSAPP_API_TOKEN, runtime.WHATSAPP_SESSION_ID, publicWebhookUrl(request)); }
    catch (error) { webhook = {ok: false, reason: error instanceof Error ? error.message : "failed"}; }
  }
  const base = {ok: true, endpoint: "whatsapp-webhook", webhookRegistered: Boolean(webhook.ok)};
  const key = new URL(request.url).searchParams.get("key");
  const {info, list} = await secrets();
  if (!key || !list.includes(key)) return Response.json(base);
  const db = env.DB!;
  const count = async (sql: string) => Number((await db.prepare(sql).bind(CLINIC).first<{n: number}>())?.n || 0);
  return Response.json({
    ...base,
    webhook,
    config: {apiToken: Boolean(runtime.WHATSAPP_API_TOKEN), sessionId: Boolean(runtime.WHATSAPP_SESSION_ID), sessionApiKeyFound: Boolean(info?.apiKey), sessionStatus: info?.status, webhookSecret: list.length > 0, gemini: Boolean(runtime.GEMINI_API_KEY)},
    queue: {
      waiting: await count("SELECT COUNT(*) n FROM whatsapp_inbound WHERE clinic_id=? AND status IN ('RECEIVED','PROCESSING')"),
      failedToday: await count("SELECT COUNT(*) n FROM whatsapp_inbound WHERE clinic_id=? AND status='FAILED' AND created_at>=date('now')"),
      repliesSentToday: await count("SELECT COUNT(*) n FROM whatsapp_messages WHERE clinic_id=? AND direction='OUT' AND status='SENT' AND created_at>=date('now')"),
      repliesRetrying: await count("SELECT COUNT(*) n FROM whatsapp_messages WHERE clinic_id=? AND direction='OUT' AND status IN ('PENDING','RETRY','SENDING')"),
      repliesFailed: await count("SELECT COUNT(*) n FROM whatsapp_messages WHERE clinic_id=? AND direction='OUT' AND status='FAILED'"),
      geminiCallsToday: await count("SELECT COUNT(*) n FROM whatsapp_ai_usage WHERE clinic_id=? AND created_at>=date('now')"),
    },
    recent: activity,
  });
}

export async function POST(request: Request) {
  const runtime = env as RuntimeEnv;
  const {list} = await secrets();
  const signature = request.headers.get("x-webhook-signature");
  if (list.length && !list.includes(signature || "")) {
    log({status: 401, reason: "webhook secret mismatch - remove WHATSAPP_WEBHOOK_SECRET from Railway or copy it exactly from WaSender", signatureSent: Boolean(signature)});
    return Response.json({error: "Invalid webhook signature"}, {status: 401});
  }
  if (!runtime.WHATSAPP_API_TOKEN) log({status: "warning", reason: "WHATSAPP_API_TOKEN missing in Railway variables - messages are saved but replies cannot be sent"});
  let payload: unknown;
  try { payload = await request.json(); } catch { return Response.json({error: "Invalid JSON"}, {status: 400}); }
  try {
    const result = await acceptWebhook(payload);
    if (result.accepted) log({stage: "received", event: result.event, accepted: result.accepted});
    return Response.json({ok: true, ...result});
  } catch (error) {
    log({stage: "accept", error: error instanceof Error ? error.message : String(error)});
    return Response.json({error: "Could not store webhook"}, {status: 500});
  }
}
