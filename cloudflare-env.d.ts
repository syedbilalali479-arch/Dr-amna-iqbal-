declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    WHATSAPP_API_TOKEN?: string;
    WHATSAPP_SESSION_ID?: string;
  }
}
