import {env} from '@/lib/runtime-env';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {canAccessModule} from '../../../../lib/access-control';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Authentication required'},{status:401});
 if(!canAccessModule(user.role,'documents'))return Response.json({error:'No access'},{status:403});
 const {id}=await params;
 const row=await env.DB!.prepare('SELECT mime_type,file_name,data FROM patient_documents WHERE clinic_id=? AND id=?').bind('skinuvia',id).first<{mime_type:string;file_name:string;data:ArrayBuffer|Uint8Array|null}>();
 if(!row)return Response.json({error:'Not found'},{status:404});
 if(!row.data)return Response.json({error:'This file could not be downloaded from WhatsApp. Ask the patient to send it again.'},{status:404});
 const safeName=row.file_name.replace(/[^\w.\- ]+/g,'_')||'file';
 return new Response(new Blob([new Uint8Array(row.data as ArrayBuffer)]),{headers:{'Content-Type':row.mime_type||'application/octet-stream','Content-Disposition':`inline; filename="${safeName}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox"}});
}
