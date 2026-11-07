import {join} from 'node:path';
import {SQLiteD1} from './sqlite-d1';
let database:SQLiteD1|undefined;
export const env={
 get DB(){database??=new SQLiteD1(process.env.DATABASE_PATH||join(process.env.RAILWAY_VOLUME_MOUNT_PATH||'.railway-data','skinuvia.sqlite'),join(process.cwd(),'drizzle'));return database as unknown as D1Database;},
 get WHATSAPP_API_TOKEN(){return process.env.WHATSAPP_API_TOKEN;},
 get WHATSAPP_SESSION_ID(){return process.env.WHATSAPP_SESSION_ID;},
 get WHATSAPP_WEBHOOK_SECRET(){return process.env.WHATSAPP_WEBHOOK_SECRET;},
 get GEMINI_API_KEY(){return process.env.GEMINI_API_KEY;},
 get GEMINI_MODEL(){return process.env.GEMINI_MODEL;},
 get GEMINI_DAILY_CALL_LIMIT(){return process.env.GEMINI_DAILY_CALL_LIMIT;},
 get WHATSAPP_AI_DAILY_LIMIT(){return process.env.WHATSAPP_AI_DAILY_LIMIT;},
 get WHATSAPP_MESSAGE_REPLY_DELAY_MS(){return process.env.WHATSAPP_MESSAGE_REPLY_DELAY_MS;},
 get WHATSAPP_CALL_REPLY_DELAY_MS(){return process.env.WHATSAPP_CALL_REPLY_DELAY_MS;},
} as Cloudflare.Env;
