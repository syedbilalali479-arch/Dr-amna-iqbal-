import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import type {ClinicRole} from './access-control';
export const sessionCookie='skinuvia_session';
export type SessionIdentity={sub:string;role:ClinicRole;version?:number};
export function constantEqual(a:string,b:string){return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());}
export function createSession(secret:string,now=Date.now(),identity:SessionIdentity={sub:'clinic-admin',role:'admin'}){
 if(secret.length<32)throw new Error('Session secret is not configured');
 const body=Buffer.from(JSON.stringify({...identity,exp:Math.floor(now/1000)+43200})).toString('base64url');
 return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');
}
export function readSession(token:string,secret:string,now=Date.now()):SessionIdentity|null{
 try{
  if(secret.length<32)return null;
  const [body,signature,...extra]=token.split('.');if(!body||!signature||extra.length)return null;
  const expected=createHmac('sha256',secret).update(body).digest('base64url');if(!constantEqual(signature,expected))return null;
  const payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
  if(!Number.isFinite(payload.exp)||payload.exp<=Math.floor(now/1000))return null;
  // Existing doctor sessions remain valid across the role rollout.
  if(payload.sub==='clinic-admin'&&(payload.role===undefined||payload.role==='admin'))return {sub:'clinic-admin',role:'admin'};
  if(typeof payload.sub==='string'&&payload.sub.startsWith('STAFF-')&&payload.role==='receptionist'&&Number.isInteger(payload.version)&&payload.version>0)return {sub:payload.sub,role:'receptionist',version:payload.version};
  return null;
 }catch{return null;}
}
export function validSession(token:string,secret:string,now=Date.now()){
 return readSession(token,secret,now)!==null;
}
