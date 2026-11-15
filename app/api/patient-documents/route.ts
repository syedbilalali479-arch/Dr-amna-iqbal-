import {env} from '@/lib/runtime-env';
import {getChatGPTUser} from '../../chatgpt-auth';
import {canAccessModule} from '../../../lib/access-control';
const CLINIC='skinuvia';
export async function GET(){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Authentication required'},{status:401});
 if(!canAccessModule(user.role,'documents'))return Response.json({error:'No access'},{status:403});
 const rows=(await env.DB!.prepare('SELECT id,contact_key,phone,patient_name,kind,mime_type,file_name,caption,size,status,error,reviewed_at,reviewed_by,created_at FROM patient_documents WHERE clinic_id=? ORDER BY created_at DESC LIMIT 300').bind(CLINIC).all()).results;
 return Response.json({documents:rows},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Authentication required'},{status:401});
 if(!canAccessModule(user.role,'documents'))return Response.json({error:'No access'},{status:403});
 const {id,status}=await request.json() as {id?:string;status?:string};
 if(!id||!['New','Reviewed'].includes(String(status)))return Response.json({error:'Choose New or Reviewed'},{status:400});
 const db=env.DB!;
 await db.batch([
  db.prepare('UPDATE patient_documents SET status=?,reviewed_at=?,reviewed_by=? WHERE clinic_id=? AND id=?').bind(status,status==='Reviewed'?new Date().toISOString():null,status==='Reviewed'?user.displayName:null,CLINIC,id),
  db.prepare('INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),CLINIC,user.userId,'UPDATE','patient_documents',id,JSON.stringify({status})),
 ]);
 return Response.json({ok:true});
}
