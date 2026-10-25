import {join} from 'node:path';
import {SQLiteD1} from './sqlite-d1';
let database:SQLiteD1|undefined;
export const env={
 get DB(){database??=new SQLiteD1(process.env.DATABASE_PATH||join(process.env.RAILWAY_VOLUME_MOUNT_PATH||'.railway-data','skinuvia.sqlite'),join(process.cwd(),'drizzle'));return database as unknown as D1Database;},
 get WHATSAPP_API_TOKEN(){return process.env.WHATSAPP_API_TOKEN;},
 get WHATSAPP_SESSION_ID(){return process.env.WHATSAPP_SESSION_ID;},
 get GEMINI_API_KEY(){return process.env.GEMINI_API_KEY;},
 get GEMINI_MODEL(){return process.env.GEMINI_MODEL;},
 get GEMINI_DAILY_CALL_LIMIT(){return process.env.GEMINI_DAILY_CALL_LIMIT;},
} as Cloudflare.Env;
