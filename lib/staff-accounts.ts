import {randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import type {SessionIdentity} from './railway-session';
const scrypt=promisify(scryptCallback);
const clinic='skinuvia';
export type StaffAccount={id:string;username:string;display_name:string;role:'receptionist';active:number;session_version:number;created_at:string};
const publicColumns='id,username,display_name,role,active,session_version,created_at';
export function normalizeUsername(value:unknown){return String(value||'').trim().toLowerCase();}
export async function hashPassword(password:string){
 if(password.length<12||password.length>256)throw new Error('Use a password between 12 and 256 characters.');
 const salt=randomBytes(16).toString('hex'),derived=await scrypt(password,salt,64) as Buffer;
 return `scrypt$${salt}$${derived.toString('hex')}`;
}
export async function verifyPassword(password:string,encoded:string){
 if(password.length>256)return false;
 const [scheme,salt,hash]=encoded.split('$');if(scheme!=='scrypt'||!/^\w{32}$/.test(salt||'')||!/^[a-f0-9]{128}$/.test(hash||''))return false;
 const derived=await scrypt(password,salt,64) as Buffer;return timingSafeEqual(derived,Buffer.from(hash,'hex'));
}
export async function authenticateStaff(db:D1Database,username:string,password:string){
 const row=await db.prepare(`SELECT ${publicColumns},password_hash FROM staff_accounts WHERE clinic_id=? AND username=?`).bind(clinic,normalizeUsername(username)).first<StaffAccount&{password_hash:string}>();
 const valid=await verifyPassword(password,row?.password_hash||'scrypt$00000000000000000000000000000000$'+'0'.repeat(128));
 return row&&valid&&row.active===1&&row.role==='receptionist'?{sub:row.id,role:row.role,version:row.session_version} as SessionIdentity:null;
}
export async function staffForSession(db:D1Database,identity:SessionIdentity){
 if(identity.role!=='receptionist')return null;
 const row=await db.prepare(`SELECT ${publicColumns} FROM staff_accounts WHERE clinic_id=? AND id=? AND active=1 AND role='receptionist' AND session_version=?`).bind(clinic,identity.sub,identity.version).first<StaffAccount>();
 return row;
}
export async function listStaff(db:D1Database){return (await db.prepare(`SELECT ${publicColumns} FROM staff_accounts WHERE clinic_id=? ORDER BY created_at DESC,id`).bind(clinic).all<StaffAccount>()).results;}
export async function manageStaff(db:D1Database,actor:string,input:Record<string,unknown>,adminUsername:string){
 const operation=String(input.operation||''),id=String(input.id||'');
 let accountId=id;const statements:D1PreparedStatement[]=[];let detail:Record<string,unknown>;
 if(operation==='create'){
  const username=normalizeUsername(input.username),name=String(input.display_name||'').trim();
  if(!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username))throw new Error('Username must be 3–64 characters: letters, numbers, dots, underscores or hyphens.');
  if(username===normalizeUsername(adminUsername))throw new Error('This username is reserved for the doctor account.');
  if(!name||name.length>100)throw new Error('Enter a staff name of up to 100 characters.');
  if(await db.prepare('SELECT id FROM staff_accounts WHERE clinic_id=? AND username=?').bind(clinic,username).first())throw new Error('This username is already in use.');
  const hash=await hashPassword(String(input.password||''));accountId='STAFF-'+crypto.randomUUID();
  statements.push(db.prepare('INSERT INTO staff_accounts(id,clinic_id,username,display_name,password_hash) VALUES(?,?,?,?,?)').bind(accountId,clinic,username,name,hash));
  detail={username,display_name:name,role:'receptionist'};
 }else{
  const existing=await db.prepare(`SELECT ${publicColumns} FROM staff_accounts WHERE clinic_id=? AND id=?`).bind(clinic,id).first<StaffAccount>();
  if(!existing)throw new Error('Staff account no longer exists.');
  if(operation==='reset_password'){
   const hash=await hashPassword(String(input.password||''));
   statements.push(db.prepare('UPDATE staff_accounts SET password_hash=?,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE clinic_id=? AND id=?').bind(hash,clinic,id));
   detail={username:existing.username,password_reset:true};
  }else if(operation==='set_active'&&typeof input.active==='boolean'){
   statements.push(db.prepare('UPDATE staff_accounts SET active=?,session_version=session_version+1,updated_at=CURRENT_TIMESTAMP WHERE clinic_id=? AND id=?').bind(input.active?1:0,clinic,id));
   detail={username:existing.username,active:input.active};
  }else throw new Error('Unsupported staff operation.');
 }
 statements.push(db.prepare('INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),clinic,actor,operation.toUpperCase(),'staff_accounts',accountId,JSON.stringify(detail)));
 await db.batch(statements);return {id:accountId};
}
