import {describeRecord} from '../../../../lib/record-numbers';
import {env} from '@/lib/runtime-env';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {normalizePhone} from '../../../../lib/prescription-delivery';
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Authentication required'},{status:401});
 try{
  if(!env.WHATSAPP_API_TOKEN)return Response.json({error:'Clinic WhatsApp is not connected. Download the PDF and attach it in WhatsApp, or connect clinic WhatsApp in the Inbox.'},{status:503});
  const form=await request.formData(),rxId=String(form.get('prescription_id')||''),phone=normalizePhone(String(form.get('phone')||'')),file=form.get('file');
  const rx=await env.DB!.prepare('SELECT patient_name,status,version FROM prescriptions WHERE clinic_id=? AND id=?').bind('skinuvia',rxId).first<{patient_name:string;status:string;version:number}>();
  if(!rx)return Response.json({error:'Prescription not found'},{status:404});if(rx.status!=='Approved')throw new Error('Save an approved prescription before sending');if(Number(form.get('version'))!==rx.version)throw new Error('This prescription has changed. Reopen it before sending.');
  if(!(file instanceof File)||file.size>5*1024*1024||file.type!=='application/pdf')throw new Error('Attach a PDF up to 5 MB');
  const bytes=await file.arrayBuffer();if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('Invalid PDF');
  const requestId=String(form.get('request_id')||'');if(!/^[a-f0-9-]{36}$/i.test(requestId))throw new Error('Missing send request ID');
  const previous=await env.DB!.prepare('SELECT action FROM audit_logs WHERE id=? AND clinic_id=?').bind(requestId,'skinuvia').first<{action:string}>();if(previous)return Response.json({error:'This send was already attempted. Check the WhatsApp conversation before trying again.'},{status:409});
  await env.DB!.prepare('INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?,?,?)').bind(requestId,'skinuvia',user.userId,'SEND_STARTED','prescriptions',rxId,JSON.stringify({phone,version:rx.version})).run();
  try{
   const headers={Authorization:`Bearer ${env.WHATSAPP_API_TOKEN}`};
   const uploaded=await fetch('https://www.wasenderapi.com/api/upload',{method:'POST',headers:{...headers,'Content-Type':'application/pdf'},body:bytes});const upload=await uploaded.json() as {success?:boolean;publicUrl?:string;message?:string};if(!uploaded.ok||!upload.success||!upload.publicUrl)throw new Error(upload.message||'PDF upload failed');
   const response=await fetch('https://www.wasenderapi.com/api/send-message',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({to:phone,text:`Skinuvia prescription for ${rx.patient_name}`,documentUrl:upload.publicUrl,fileName:`Skinuvia-${(await describeRecord(env.DB!,'skinuvia','prescriptions',{id:rxId})).number}.pdf`})});const result=await response.json() as {success?:boolean;message?:string;data?:{msgId?:unknown;status?:string}};if(!response.ok||!result.success)throw new Error(result.message||'WhatsApp rejected the message');
   await env.DB!.prepare('UPDATE audit_logs SET action=?,detail=? WHERE id=?').bind('SEND_ACCEPTED',JSON.stringify({phone,version:rx.version,messageId:result.data?.msgId,status:result.data?.status}),requestId).run();return Response.json({ok:true,message:'WhatsApp accepted the prescription for sending. Check the conversation for delivery.'});
  }catch(e){await env.DB!.prepare('UPDATE audit_logs SET action=? WHERE id=?').bind('SEND_UNCONFIRMED',requestId).run();throw e;}
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to send prescription'},{status:400});}
}
