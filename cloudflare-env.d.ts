declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    WHATSAPP_API_TOKEN?: string;
    WHATSAPP_SESSION_ID?: string;
    WHATSAPP_WEBHOOK_SECRET?: string;
    GEMINI_API_KEY?: string;
    GEMINI_MODEL?: string;
    GEMINI_DAILY_CALL_LIMIT?: string;
    WHATSAPP_AI_DAILY_LIMIT?: string;
    WHATSAPP_MESSAGE_REPLY_DELAY_MS?: string;
    WHATSAPP_CALL_REPLY_DELAY_MS?: string;
  }
}
