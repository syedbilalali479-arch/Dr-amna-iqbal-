import test from 'node:test';import assert from 'node:assert/strict';
import {SQLiteD1} from '../lib/sqlite-d1.ts';
import {handleTurnV3,isAffirmative,isDecline,type V3State} from '../lib/whatsapp/engine-v3.ts';
import type {Contact,Draft} from '../lib/whatsapp/brain.ts';
import {pakistanParts} from '../lib/pakistan-time.ts';
import {createTurnGuard,MAX_MODEL_CALLS,outputIssues,similarity} from '../lib/whatsapp/loop-guard.ts';

// ---- scripted DeepSeek ----
type Step={text:string}|{tools:Array<{name:string;args:Record<string,unknown>}>}|{fail:number};
let script:Step[]=[];let modelCalls=0;const seenToolResults:string[]=[];
const realFetch=globalThis.fetch;
globalThis.fetch=(async(_url:string,init:{body:string})=>{
 const body=JSON.parse(init.body);modelCalls++;
 for(const m of body.messages)if(m.role==='tool')seenToolResults.push(m.content);
 const step=script.shift();if(!step)throw new Error('model called more often than scripted');
 if('fail' in step)return new Response(JSON.stringify({error:{message:'down'}}),{status:step.fail});
 const message='text' in step?{content:step.text}:{content:null,tool_calls:step.tools.map((t,i)=>({id:`call_${modelCalls}_${i}`,type:'function',function:{name:t.name,arguments:JSON.stringify(t.args)}}))};
 return new Response(JSON.stringify({choices:[{message}],usage:{prompt_tokens:10,completion_tokens:5}}),{status:200,headers:{'content-type':'application/json'}});}) as typeof fetch;
test.after(()=>{globalThis.fetch=realFetch});

const cfg={apiKey:'stub',model:'deepseek-chat',provider:'deepseek' as const};
const day=(n:number)=>{const t=new Date(`${pakistanParts().date}T12:00:00Z`);t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
const wd=(n:number)=>{let k=0,d='';for(let i=1;k<n;i++){d=day(i);const w=new Date(`${d}T12:00:00Z`).getUTCDay();if(w!==0&&w!==6)k++;}return d};
const dm=(iso:string)=>`${Number(iso.slice(8))}/${Number(iso.slice(5,7))}`;
const D=(db:SQLiteD1)=>db as unknown as D1Database;
function setup(){script=[];modelCalls=0;seenToolResults.length=0;const db=new SQLiteD1(':memory:','drizzle');db.connection.exec("DELETE FROM treatments");
 for(const [n,p] of [['Skin Consultation',2000],['Hydra Facial',5000],['Glow Facial',3500],['Laser Hair Removal',8000]] as const)db.connection.prepare("INSERT INTO treatments(id,clinic_id,name,price,status) VALUES(?,?,?,?,'Active')").run(crypto.randomUUID(),'skinuvia',n,p);
 db.connection.prepare("INSERT INTO whatsapp_contacts(clinic_id,contact_key,reply_to,name) VALUES('skinuvia','+923001234567','+923001234567','Profile Name')").run();
 return db}
const contact=(draft:Draft={}):Contact=>({contact_key:'+923001234567',reply_to:'+923001234567',name:'Profile Name',language:'ROMAN_URDU',draft,human_controlled:0,handover_at:null});
// every real turn first stores the patient's message, then calls the engine
const say=async(db:SQLiteD1,draft:Draft,text:string,key?:string)=>{db.connection.prepare("INSERT INTO whatsapp_messages(id,clinic_id,contact_key,direction,content,status,source) VALUES(?,?,?,'IN',?,'RECEIVED','text')").run(crypto.randomUUID(),'skinuvia','+923001234567',text);
 const r=await handleTurnV3(D(db),cfg,contact(draft),text,{turnKey:key,currentInbound:1});
 if(r.reply)db.connection.prepare("INSERT INTO whatsapp_messages(id,clinic_id,contact_key,direction,content,status,source) VALUES(?,?,?,'OUT',?,'SENT','deepseek')").run(crypto.randomUUID(),'skinuvia','+923001234567',r.reply);return r};
const seed=(db:SQLiteD1,id:string,name:string,phone:string,date:string,time:string,source='WhatsApp AI')=>{db.connection.prepare("INSERT INTO patients(id,clinic_id,name,phone) VALUES(?,?,?,?)").run('P-'+id,'skinuvia',name,phone);
 db.connection.prepare("INSERT INTO appointments(id,clinic_id,patient_id,patient_name,phone,doctor,service,appointment_date,appointment_time,status,source,price) VALUES(?,?,?,?,?,'Dr. Aamina Iqbal','Skin Consultation',?,?,'Confirmed',?,2000)").run(id,'skinuvia','P-'+id,name,phone,date,time,source)};
const rows=(db:SQLiteD1)=>db.connection.prepare("SELECT * FROM appointments").all() as Array<Record<string,unknown>>;
const v3=(d:Draft)=>d.v3 as V3State;
const propose=(extra:Record<string,unknown>={})=>({name:'propose_booking',args:{patient_name:'Ayesha Khan',date:wd(3),time:'19:00',...extra}});

test('yes/no detection: a bare yes is a yes, a yes with details is not',()=>{
 for(const t of ['haan','Haan ji','ji theek hai','ok','okay kar dein','yes','bilkul','done','Ji haan 👍','ہاں'])assert.equal(isAffirmative(t),true,t);
 for(const t of ['haan lekin 8 baje','nahi','ok kal 7 baje','price kya hai','haan mujhe facial ka price batao','ji aap ka address kya hai','haan 5/12'])assert.equal(isAffirmative(t),false,t);
 for(const t of ['nahi','no','nahi ji','rehne do','no thanks'])assert.equal(isDecline(t),true,t);
 assert.equal(isDecline('nahi 8 baje karein'),false);});

test('proposal then a bare "haan" books exactly once, with the backend confirmation and no model call for the yes',async()=>{const db=setup();
 script=[{tools:[propose()]},{text:'Ayesha Khan, Skin Consultation, summary theek hai? Confirm ke liye haan likhein.'}];
 let r=await say(db,{},`Ayesha Khan, ${dm(wd(3))} ko 7 baje consultation chahiye`);
 assert.equal(rows(db).length,0,'nothing is booked before the patient says yes');assert.ok(v3(r.draft).pending);assert.equal(r.draft.active,true);assert.match(r.reply!,/Confirm/);
 const calls=modelCalls;
 r=await say(db,r.draft,'haan');
 assert.equal(modelCalls,calls,'the yes is settled by the backend');
 assert.equal(rows(db).length,1);assert.equal(rows(db)[0].appointment_date,wd(3));assert.equal(rows(db)[0].appointment_time,'19:00');assert.equal(rows(db)[0].patient_name,'Ayesha Khan');assert.equal(rows(db)[0].source,'WhatsApp AI');
 assert.match(r.reply!,/✅[\s\S]*Ayesha Khan[\s\S]*Skin Consultation[\s\S]*7:00 PM[\s\S]*📍/);assert.equal(r.intent,'BOOKING_CONFIRMATION');assert.equal(v3(r.draft).pending,null);assert.equal(r.draft.active,false);
 // a second yes does not book again and does not restart the booking
 script=[{text:'Ji, aap ki appointment confirm ho chuki hai. Koi aur madad?'}];
 await say(db,r.draft,'haan');assert.equal(rows(db).length,1);});

test('a retried turn (same inbound ids) returns the same answer and never books twice',async()=>{const db=setup();
 script=[{tools:[propose()]},{text:'Confirm kar dein?'}];
 let r=await say(db,{},`Ayesha Khan ${dm(wd(3))} 7 baje`,'IN-1');
 const before=r.draft;r=await say(db,before,'haan','IN-2');assert.equal(rows(db).length,1);const reply=r.reply;
 const again=await handleTurnV3(D(db),cfg,contact(before),'haan',{turnKey:'IN-2'}); // crash/retry with the OLD draft
 assert.equal(rows(db).length,1);assert.ok(again);
 const same=await handleTurnV3(D(db),cfg,contact(r.draft),'haan',{turnKey:'IN-2'});
 assert.equal(same.reply,reply);assert.equal(rows(db).length,1);});

test('the model cannot confirm in the same turn it proposed, nor on a message that is not a clear yes',async()=>{const db=setup();
 script=[{tools:[propose()]},{tools:[{name:'confirm_pending_action',args:{operation_id:'x'}}]},{text:'Summary confirm kar dein?'}];
 let r=await say(db,{},`Ayesha Khan ${dm(wd(3))} 7 baje`);assert.equal(rows(db).length,0);
 const op=v3(r.draft).pending!;
 script=[{tools:[{name:'confirm_pending_action',args:{operation_id:op.id}}]},{text:'Pehle bata dein: 8 baje theek hai?'}];
 r=await say(db,r.draft,'8 baje kar do');assert.equal(rows(db).length,0);assert.match(seenToolResults.join('|'),/not_confirmed/);});

test('a made-up booking claim is blocked and rewritten; the patient never sees it',async()=>{const db=setup();
 script=[{text:'Ji aap ki appointment book ho gayi hai!'},{text:'Aap ka naam aur din bata dein, main check kar leti hoon.'}];
 const r=await say(db,{},'appointment chahiye');assert.equal(rows(db).length,0);assert.doesNotMatch(r.reply!,/book ho gayi/);assert.match(r.reply!,/naam/);assert.equal(modelCalls,2);});

test('asking for a confirmation that was never prepared is blocked',async()=>{const db=setup();
 script=[{text:'Appointment confirm kar doon?'},{tools:[propose()]},{text:'Summary theek hai? haan likh dein.'}];
 const r=await say(db,{},`Ayesha Khan ${dm(wd(3))} 7 baje`);assert.ok(v3(r.draft).pending);assert.equal(rows(db).length,0);});

test('an unlisted price is blocked, a listed one is allowed',async()=>{const db=setup();
 script=[{text:'Hydra Facial PKR 9,999 ka hai.'},{text:'Hydra Facial PKR 5,000 ka hai. Dr. Aamina Iqbal consultation mein behtar guide karengi.'}];
 const r=await say(db,{},'hydra facial ka price?');assert.match(r.reply!,/5,000/);assert.doesNotMatch(r.reply!,/9,999/);});

test('guard: a model that never answers cannot loop; duplicates are not re-run; the patient is escalated',async()=>{const db=setup();
 const g=createTurnGuard();assert.equal(g.beforeToolCall('search_services','{"query":"a"}').run,true);g.afterToolCall('search_services','search_services:{"query":"a"}',{status:'ok'});
 assert.equal(g.beforeToolCall('search_services','{"query":"a"}').run,false);
 g.afterToolCall('propose_booking','k',{});assert.equal(g.beforeToolCall('propose_booking','{"date":"2030-01-01"}').run,false);
 script=[1,2,3,4,5].map(()=>({tools:[{name:'search_services',args:{query:'facial'}}]}));
 const r=await say(db,{},'facial');assert.ok(modelCalls<=MAX_MODEL_CALLS);assert.equal(r.handover,'BOOKING_LOOP');assert.match(r.reply!,/clinic team/i);});

test('the same clarifying question three turns running escalates to staff instead of looping',async()=>{const db=setup();let d:Draft={};let last;
 const asks=['Ji, appointment kis patient ke naam par book karni hai?','Please batayein, appointment kis patient ke naam par book karni hai?','Aur ek baar, appointment kis patient ke naam par book karni hai?'];
 for(let i=0;i<3;i++){script=[{text:asks[i]},{text:asks[i]}];last=await say(db,d,['mujhe appointment chahiye','book karni hai','jaldi chahiye'][i]);d=last.draft;}
 assert.equal(last!.handover,'BOOKING_LOOP');assert.match(last!.reply!,/clinic team/i);});

test('a taken slot offers the next free time and books only that, after the patient accepts',async()=>{const db=setup();
 seed(db,'APT-x','Someone','0300',wd(3),'19:00','Reception');
 script=[{tools:[propose()]},{text:'19:00 booked hai, 7:15 PM chalega? haan likhein.'}];
 let r=await say(db,{},`Ayesha Khan ${dm(wd(3))} 7 baje`);assert.equal(v3(r.draft).pending!.time,'19:15');assert.equal(v3(r.draft).pending!.moved,true);
 r=await say(db,r.draft,'haan');const mine=rows(db).find((x)=>x.patient_name==='Ayesha Khan')!;assert.equal(mine.appointment_time,'19:15');assert.match(r.reply!,/7:15 PM/);});

test('a slot taken between proposal and "haan" is re-offered, not double-booked',async()=>{const db=setup();
 script=[{tools:[propose()]},{text:'Confirm?'}];let r=await say(db,{},`Ayesha Khan ${dm(wd(3))} 7 baje`);
 seed(db,'APT-y','Rival','0300',wd(3),'19:00','Reception');
 r=await say(db,r.draft,'haan');assert.equal(rows(db).filter((x)=>x.patient_name==='Ayesha Khan').length,0);assert.match(r.reply!,/7:15 PM/);assert.equal(v3(r.draft).pending!.time,'19:15');
 r=await say(db,r.draft,'haan');assert.equal(rows(db).filter((x)=>x.patient_name==='Ayesha Khan')[0].appointment_time,'19:15');});

test('names are never taken from the WhatsApp profile; the model must ask',async()=>{const db=setup();
 script=[{tools:[propose({patient_name:'Profile Name'})]},{text:'Aap ka naam kya hai?'}];
 const r=await say(db,{},`${dm(wd(3))} ko 7 baje appointment`);assert.match(seenToolResults.join('|'),/incomplete/);assert.equal(v3(r.draft).pending ?? null,null);assert.equal(rows(db).length,0);});

test('closed days and past dates are refused by the backend',async()=>{const db=setup();
 let sat='';for(let i=1;i<9;i++){const d=day(i);if(new Date(`${d}T12:00:00Z`).getUTCDay()===6){sat=d;break;}}
 script=[{tools:[propose({date:sat})]},{text:'Clinic Saturday band hota hai, Peer se Jumma bata dein.'}];
 await say(db,{},`Ayesha Khan ${dm(sat)} 7 baje`);assert.match(seenToolResults.join('|'),/unavailable/);assert.equal(rows(db).length,0);});

test('an existing appointment is not duplicated: the patient is asked change vs additional',async()=>{const db=setup();
 seed(db,'APT-aaaaaa11-1111','Ayesha Khan','+923001234567',wd(2),'18:00');
 script=[{tools:[propose()]},{text:'Ayesha Khan ki appointment pehle se hai. Naya time chahiye ya doosri appointment?'}];
 await say(db,{},`Ayesha Khan ${dm(wd(3))} 7 baje`);assert.match(seenToolResults.join('|'),/existing_appointment/);assert.equal(rows(db).length,1);});

test('cancel: propose, "haan" cancels the right row, a second "haan" does nothing',async()=>{const db=setup();
 seed(db,'APT-aaaaaa11-1111','Ayesha Khan','+923001234567',wd(2),'18:00');
 script=[{tools:[{name:'propose_cancellation',args:{}}]},{text:'Ayesha Khan ki appointment cancel kar dein? haan likhein.'}];
 let r=await say(db,{},'meri appointment cancel kar dein');assert.equal(rows(db)[0].status,'Confirmed');
 r=await say(db,r.draft,'haan');assert.equal(rows(db)[0].status,'Cancelled');assert.match(r.reply!,/cancel kar di gayi/);assert.equal(r.intent,'CANCEL');});

test('reschedule moves the same row without creating a new one',async()=>{const db=setup();
 seed(db,'APT-aaaaaa11-1111','Ayesha Khan','+923001234567',wd(2),'18:00');
 script=[{tools:[{name:'propose_reschedule',args:{new_date:wd(4),new_time:'20:00'}}]},{text:'Ayesha Khan ki appointment shift kar dein? haan likhein.'}];
 let r=await say(db,{},`appointment ${dm(wd(4))} ko 8 baje kar dein`);assert.equal(rows(db)[0].appointment_date,wd(2));
 r=await say(db,r.draft,'ji');assert.equal(rows(db).length,1);assert.equal(rows(db)[0].appointment_date,wd(4));assert.equal(rows(db)[0].appointment_time,'20:00');assert.equal(r.intent,'RESCHEDULE');});

test('"nahi" drops the pending operation without a model call and without booking',async()=>{const db=setup();
 script=[{tools:[propose()]},{text:'Confirm?'}];let r=await say(db,{},`Ayesha Khan ${dm(wd(3))} 7 baje`);const calls=modelCalls;
 r=await say(db,r.draft,'nahi');assert.equal(modelCalls,calls);assert.equal(rows(db).length,0);assert.equal(v3(r.draft).pending,null);assert.equal(r.draft.active,false);});

test('an expired proposal is not confirmed by a late "haan"',async()=>{const db=setup();
 script=[{tools:[propose()]},{text:'Confirm?'}];let r=await say(db,{},`Ayesha Khan ${dm(wd(3))} 7 baje`);
 const d=structuredClone(r.draft);(d.v3 as V3State).pending!.expiresAt=Date.now()-1000;
 script=[{text:'Aap kis cheez ke liye haan keh rahi hain? Appointment ke liye naam aur din bata dein.'}];
 r=await say(db,d,'haan');assert.equal(rows(db).length,0);});

test('medicine questions are forwarded to the doctor and hand the chat over',async()=>{const db=setup();
 script=[{tools:[{name:'forward_to_doctor',args:{kind:'medicine',summary:'which cream'}}]},{text:'Ji, aap ka sawal Dr. Aamina Iqbal ko forward kar diya gaya hai.'}];
 const r=await say(db,{},'kaun si cream lagaun?');assert.equal(r.handover,'MEDICINE_QUESTION_FOR_DOCTOR');assert.equal(r.intent,'MEDICINE_QUESTION');});

test('emergency words are handled deterministically with no model call',async()=>{const db=setup();
 const r=await say(db,{},'meri saans nahi aa rahi aur chehra sooj gaya');assert.equal(modelCalls,0);assert.equal(r.handover,'MEDICAL_URGENCY');assert.match(r.reply!,/emergency/i);});

test('AI provider down: one safe reply, then silence (never a loop of identical replies)',async()=>{const db=setup();
 script=[{fail:500},{fail:500}];
 const r1=await handleTurnV3(D(db),cfg,contact(),'appointment chahiye',{currentInbound:0});assert.match(r1.reply!,/message mil gaya/);assert.equal(r1.handover,'AI_UNAVAILABLE');
 script=[{fail:500},{fail:500}];
 const r2=await handleTurnV3(D(db),cfg,contact(r1.draft),'hello?',{currentInbound:0,lastOutIsSafeReply:true});assert.equal(r2.reply,null);});

test('similar replies are detected as repeats',()=>{assert.ok(similarity('Aap ka naam kya hai? Please bata dein','Aap ka naam kya hai please bata dein')>0.88);
 assert.ok(outputIssues('Aap ka naam kya hai please bata dein ji',{committed:false,recentReplies:['Aap ka naam kya hai please bata dein ji']}).some((i)=>/repeated/.test(i)));});
