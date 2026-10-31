import {env} from '@/lib/runtime-env';
import {getChatGPTUser} from '../../chatgpt-auth';

const clinic='skinuvia';
async function setup(){await env.DB!.prepare("CREATE TABLE IF NOT EXISTS promotional_campaigns (id TEXT PRIMARY KEY, clinic_id TEXT NOT NULL, title TEXT, message TEXT, image_data TEXT, audience TEXT, treatment TEXT, channels TEXT, status TEXT NOT NULL, recipients INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();}
export async function GET(){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Authentication required'},{status:401});if(user.role!=='admin')return Response.json({error:'Admin access required'},{status:403});
 try{await setup();const result=await env.DB!.prepare("SELECT id,title,message,audience,treatment,channels,status,recipients,created_at,CASE WHEN image_data IS NOT NULL AND image_data!='' THEN 1 ELSE 0 END AS has_image FROM promotional_campaigns WHERE clinic_id=? ORDER BY created_at DESC LIMIT 100").bind(clinic).all();return Response.json({campaigns:result.results},{headers:{'Cache-Control':'private, no-store'}})}catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to load campaigns'},{status:500})}
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Authentication required'},{status:401});if(user.role!=='admin')return Response.json({error:'Admin access required'},{status:403});
 try{
  const body=await request.json() as Record<string,unknown>;
  const title=String(body.title||'').slice(0,160),message=String(body.message||'').slice(0,3000),treatment=String(body.treatment||'').slice(0,160),audience=String(body.audience||'all'),image=String(body.image||''),channels=body.channels&&typeof body.channels==='object'?JSON.stringify(body.channels):'{}';
  if(!['all','interested','received'].includes(audience))return Response.json({error:'Invalid audience'},{status:400});
  if(image&&(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)||image.length>450000))return Response.json({error:'Image must be PNG/JPEG/WebP under approximately 330 KB'},{status:400});
  if(!title&&!message&&!image)return Response.json({error:'Add a message, image, or campaign name to save a draft'},{status:400});
  await setup();
  // Only WhatsApp AI conversation contacts; never all patients in the database.
  const contacts=await env.DB!.prepare("SELECT phone FROM conversations WHERE clinic_id=? AND phone IS NOT NULL AND TRIM(phone)!=''").bind(clinic).all<{phone:string}>();
  const unique=new Set(contacts.results.map(c=>String(c.phone).replace(/\D/g,'')));
  const id=crypto.randomUUID();
  await env.DB!.prepare("INSERT INTO promotional_campaigns(id,clinic_id,title,message,image_data,audience,treatment,channels,status,recipients) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(id,clinic,title,message,image,audience,treatment,channels,'Draft',unique.size).run();
  return Response.json({ok:true,id,status:'Draft',eligibleConversationContacts:unique.size,note:'Draft saved only. No WhatsApp messages have been sent.'});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to save campaign'},{status:500})}
}
