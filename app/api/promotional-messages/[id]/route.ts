import {env} from '@/lib/runtime-env';
import {getChatGPTUser} from '../../../chatgpt-auth';
const CLINIC='skinuvia';
async function ensureQueue(){await env.DB!.prepare("CREATE TABLE IF NOT EXISTS promotional_delivery_queue (id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL,clinic_id TEXT NOT NULL,phone TEXT NOT NULL,scheduled_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Queued',last_error TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(campaign_id,phone))").run();}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getChatGPTUser();if(!user||user.role!=='admin')return Response.json({error:'Admin access required'},{status:403});
 try{
  await ensureQueue();
  const {id}=await params;
  const input=await request.json() as {action?:string};
  const campaign=await env.DB!.prepare("SELECT id,status,message,image_data,audience,treatment FROM promotional_campaigns WHERE id=? AND clinic_id=?").bind(id,CLINIC).first<{id:string;status:string;message:string;image_data:string|null;audience:string;treatment:string}>();
  if(!campaign)return Response.json({error:'Campaign not found'},{status:404});
  if(input.action==='pause'||input.action==='resume'){
   const from=input.action==='pause'?'Scheduled':'Paused',to=input.action==='pause'?'Paused':'Scheduled';
   const result=await env.DB!.prepare("UPDATE promotional_campaigns SET status=? WHERE id=? AND clinic_id=? AND status=?").bind(to,id,CLINIC,from).run();
   if(!result.meta.changes)return Response.json({error:'Campaign is not in the correct state'},{status:409});
   return Response.json({ok:true,status:to});
  }
  if(input.action!=='schedule')return Response.json({error:'Unknown action'},{status:400});
  if(campaign.status!=='Draft')return Response.json({error:'Campaign is not a draft'},{status:409});
  if(!campaign.message?.trim())return Response.json({error:'Write a message before scheduling'},{status:400});
  if(campaign.audience!=='all')return Response.json({error:'Treatment audience matching must be verified before scheduling'},{status:409});
  const contacts=await env.DB!.prepare("SELECT phone FROM conversations WHERE clinic_id=? AND phone IS NOT NULL").bind(CLINIC).all<{phone:string}>();
  const numbers=Array.from(new Set(contacts.results.map(c=>String(c.phone).replace(/\D/g,'')).filter(p=>p.length>=10&&p.length<=15)));
  if(!numbers.length)return Response.json({error:'No WhatsApp conversation contacts found'},{status:400});
  if(numbers.length>200)return Response.json({error:'Audience exceeds 200 contacts; review before scheduling'},{status:400});
  const start=Date.now(),span=48*60*60*1000;
  const jobs=numbers.map((phone,index)=>env.DB!.prepare("INSERT OR IGNORE INTO promotional_delivery_queue(id,campaign_id,clinic_id,phone,scheduled_at,status) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),id,CLINIC,phone,new Date(start+Math.floor(index*span/numbers.length)).toISOString(),'Queued'));
  await env.DB!.batch([...jobs,env.DB!.prepare("UPDATE promotional_campaigns SET status='Scheduled',recipients=? WHERE id=? AND clinic_id=? AND status='Draft'").bind(numbers.length,id,CLINIC)]);
  return Response.json({ok:true,status:'Scheduled',queued:numbers.length,note:'Queue saved. Dispatch is disabled until provider validation and delivery worker are configured.'});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Scheduling failed'},{status:500});}
}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getChatGPTUser();if(!user||user.role!=='admin')return Response.json({error:'Admin access required'},{status:403});
 try{await ensureQueue();const {id}=await params;const result=await env.DB!.prepare("SELECT status,COUNT(*) AS total FROM promotional_delivery_queue WHERE campaign_id=? AND clinic_id=? GROUP BY status").bind(id,CLINIC).all();return Response.json({counts:result.results})}catch(error){return Response.json({error:String(error)},{status:500})}
}
