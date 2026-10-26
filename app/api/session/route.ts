import {createSession,constantEqual,sessionCookie} from '../../../lib/railway-session';
import {env} from '@/lib/runtime-env';
import {authenticateStaff,normalizeUsername} from '../../../lib/staff-accounts';
const attempts=new Map<string,{count:number;until:number}>();
export async function POST(request:Request){
 if(process.env.DEPLOY_TARGET!=='railway')return new Response('Not found',{status:404});
 if(!process.env.ADMIN_PASSWORD||!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)return Response.json({error:'Clinic sign-in has not been configured'},{status:503});
 const origin=request.headers.get('origin'),expectedOrigin=process.env.RAILWAY_PUBLIC_DOMAIN?`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`:new URL(request.url).origin;if(origin&&origin!==expectedOrigin)return new Response('Invalid origin',{status:403});
 const ip=request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown',now=Date.now();const attempt=attempts.get(ip);if(attempt&&attempt.until>now&&attempt.count>=10)return new Response('Too many sign-in attempts. Try again later.',{status:429});
 if(attempts.size>1000)for(const [key,value] of attempts)if(value.until<now)attempts.delete(key);
 const form=await request.formData(),username=normalizeUsername(form.get('username')),password=String(form.get('password')||'');
 const adminName=constantEqual(username,normalizeUsername(process.env.ADMIN_USERNAME||'admin')),adminPassword=constantEqual(password,process.env.ADMIN_PASSWORD);
 const identity=adminName&&adminPassword?{sub:'clinic-admin',role:'admin' as const}:await authenticateStaff(env.DB!,username,password);
 if(!identity){attempts.set(ip,{count:attempt&&attempt.until>now?attempt.count+1:1,until:now+900000});return new Response(null,{status:303,headers:{Location:'/login?error=1'}});}
 attempts.delete(ip);const token=createSession(process.env.SESSION_SECRET,now,identity);return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':`${sessionCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${process.env.NODE_ENV==='production'?'; Secure':''}`, 'Cache-Control':'no-store'}});
}
export async function GET(){return new Response(null,{status:303,headers:{Location:'/login','Set-Cookie':`${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`}});}
