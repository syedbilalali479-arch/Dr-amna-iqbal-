import test from 'node:test';import assert from 'node:assert/strict';
import {SQLiteD1} from '../lib/sqlite-d1.ts';import {savePatientDocument,forwardedReply} from '../lib/whatsapp/media.ts';
const realFetch=globalThis.fetch;test.after(()=>{globalThis.fetch=realFetch});
const pdf=new TextEncoder().encode('%PDF-1.4 test report');
test('a WhatsApp report is downloaded, linked to the patient and kept for the doctor',async()=>{
 const calls:string[]=[];globalThis.fetch=(async(url:string,init?:{body?:string})=>{calls.push(String(url));
  if(String(url).includes('decrypt-media')){assert.ok(JSON.parse(init!.body!).data.messages.message.documentMessage);return Response.json({publicUrl:'https://files.example/r.pdf'});}
  if(String(url)==='https://files.example/r.pdf')return new Response(pdf,{headers:{'content-type':'application/pdf'}});
  return Response.json({success:false},{status:404});}) as typeof fetch;
 const d1=new SQLiteD1(':memory:','drizzle');const db=d1 as unknown as D1Database;
 d1.connection.prepare("INSERT INTO appointments(id,clinic_id,patient_id,patient_name,phone,doctor,service,appointment_date,appointment_time) VALUES('A1','skinuvia','P1','Maryam Haider','+923001112222','Dr. Aamina Iqbal','Skin Consultation','2026-11-12','18:45')").run();
 const raw=JSON.stringify({key:{id:'M1'},message:{documentMessage:{mimetype:'application/pdf',fileName:'CBC report.pdf',caption:'meri report'}}});
 const r=await savePatientDocument(db,'+923001112222',{kind:'document',text:'meri report',raw,provider_message_id:'M1'},{token:'t',sessionId:undefined,contactName:'WA Name'});
 assert.equal(r.saved,true);const row=d1.connection.prepare('SELECT * FROM patient_documents').get() as Record<string,unknown>;
 assert.equal(row.patient_name,'Maryam Haider');assert.equal(row.file_name,'CBC report.pdf');assert.equal(row.mime_type,'application/pdf');assert.equal(row.caption,'meri report');assert.equal(row.status,'New');assert.equal(row.size,pdf.byteLength);
 assert.equal(new TextDecoder().decode(row.data as Uint8Array),'%PDF-1.4 test report');
 // same WhatsApp message again (webhook retry) is not stored twice
 await savePatientDocument(db,'+923001112222',{kind:'document',text:'meri report',raw,provider_message_id:'M1'},{token:'t'});
 assert.equal(d1.connection.prepare('SELECT count(*) n FROM patient_documents').get()!.n,1);
});
test('a failed download is still recorded so staff know a report arrived',async()=>{
 globalThis.fetch=(async()=>Response.json({},{status:500})) as typeof fetch;
 const d1=new SQLiteD1(':memory:','drizzle');
 const r=await savePatientDocument(d1 as unknown as D1Database,'+923009998888',{kind:'image',text:'[Image]',raw:JSON.stringify({message:{imageMessage:{mimetype:'image/jpeg'}}}),provider_message_id:'M2',push_name:'Sana'},{token:'t'});
 assert.equal(r.saved,false);const row=d1.connection.prepare('SELECT patient_name,kind,error,size,caption FROM patient_documents').get() as Record<string,unknown>;
 assert.equal(row.patient_name,'Sana');assert.equal(row.kind,'image');assert.match(String(row.error),/decrypt-media failed/);assert.equal(row.size,0);assert.equal(row.caption,'');
});
test('forwarded reply in each language names the doctor',()=>{assert.match(forwardedReply('ROMAN_URDU','Dr. Aamina Iqbal'),/Dr\. Aamina Iqbal ko forward kar di/);assert.match(forwardedReply('ENGLISH','Dr. Aamina Iqbal'),/forwarded it to Dr\. Aamina Iqbal/);assert.match(forwardedReply('URDU','x'),/ڈاکٹر آمنہ اقبال/);});
