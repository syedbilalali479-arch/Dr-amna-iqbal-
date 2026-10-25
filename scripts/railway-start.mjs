import {mkdirSync,chownSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
if(!process.env.ADMIN_PASSWORD||process.env.ADMIN_PASSWORD.length<16||!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)throw new Error('Set ADMIN_PASSWORD (16+ characters) and SESSION_SECRET (32+ characters) before starting.');
if(!process.env.RAILWAY_VOLUME_MOUNT_PATH&&!process.env.DATABASE_PATH)throw new Error('Attach a persistent Railway volume at /data before starting.');
process.env.DATABASE_PATH||=join(process.env.RAILWAY_VOLUME_MOUNT_PATH,'skinuvia.sqlite');
process.env.DEPLOY_TARGET='railway';process.env.HOSTNAME='0.0.0.0';process.env.PORT||='8080';
const directory=dirname(process.env.DATABASE_PATH);mkdirSync(directory,{recursive:true,mode:0o700});
if(process.getuid?.()===0){chownSync(directory,1000,1000);for(const suffix of ['','-wal','-shm'])if(existsSync(process.env.DATABASE_PATH+suffix))chownSync(process.env.DATABASE_PATH+suffix,1000,1000);process.setgid(1000);process.setuid(1000);}
await import('../server.js');
