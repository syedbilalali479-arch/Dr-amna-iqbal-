import {env} from '@/lib/runtime-env';
import {getChatGPTUser} from '../../chatgpt-auth';
import {listStaff,manageStaff} from '../../../lib/staff-accounts';
export async function GET(){
 const user=await getChatGPTUser();
 if(!user)return Response.json({error:'Authentication required'},{status:401});
 if(user.role!=='admin')return Response.json({error:'Doctor / Admin access required'},{status:403});
 return Response.json({accounts:await listStaff(env.DB!)},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request){
 const user=await getChatGPTUser();
 if(!user)return Response.json({error:'Authentication required'},{status:401});
 if(user.role!=='admin')return Response.json({error:'Doctor / Admin access required'},{status:403});
 const origin=request.headers.get('origin'),expected=process.env.RAILWAY_PUBLIC_DOMAIN?`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`:new URL(request.url).origin;
 if(origin&&origin!==expected)return Response.json({error:'Invalid origin'},{status:403});
 try{
  const result=await manageStaff(env.DB!,user.userId,await request.json() as Record<string,unknown>,process.env.ADMIN_USERNAME||'admin');
  return Response.json({...result,accounts:await listStaff(env.DB!)},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){
  const message=e instanceof Error?e.message:'Unable to update staff access.';
  return Response.json({error:message.includes('UNIQUE')?'This username is already in use.':message},{status:400});
 }
}
