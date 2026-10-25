import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
export const sessionCookie='skinuvia_session';
export function constantEqual(a:string,b:string){return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());}
export function createSession(secret:string,now=Date.now()){
 if(secret.length<32)throw new Error('Session secret is not configured');
 const body=Buffer.from(JSON.stringify({sub:'clinic-admin',exp:Math.floor(now/1000)+43200})).toString('base64url');
 return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');
}
export function validSession(token:string,secret:string,now=Date.now()){
 try{if(secret.length<32)return false;const [body,signature,...extra]=token.split('.');if(!body||!signature||extra.length)return false;const expected=createHmac('sha256',secret).update(body).digest('base64url');if(!constantEqual(signature,expected))return false;const payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));return payload.sub==='clinic-admin'&&Number.isFinite(payload.exp)&&payload.exp>Math.floor(now/1000);}catch{return false;}
}
