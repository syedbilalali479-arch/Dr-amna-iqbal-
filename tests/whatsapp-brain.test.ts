import test from 'node:test';import assert from 'node:assert/strict';
import {SQLiteD1} from '../lib/sqlite-d1.ts';import {handleTurn,type Contact} from '../lib/whatsapp/brain.ts';
import {pakistanParts} from '../lib/pakistan-time.ts';
type A={intent:string;patient_name?:string|null;service_name?:string|null;date?:string|null;time?:string|null;explicit_confirmation?:boolean};
const day=(n:number)=>{const t=new Date(`${pakistanParts().date}T12:00:00Z`);t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
const dm=(iso:string)=>`${Number(iso.slice(8))}/${Number(iso.slice(5,7))}`;
let next:A={intent:'OTHER'};const backends:string[]=[];
const realFetch=globalThis.fetch;
globalThis.fetch=(async(_url:string,init:{body:string})=>{const body=JSON.parse(init.body);const sys=body.systemInstruction?.parts?.[0]?.text||'';
 let text:string;if(sys.includes('ONE JSON')){text=JSON.stringify({language:'ROMAN_URDU',needs_human:false,medical_urgency:false,patient_name:null,service_name:null,date:null,time:null,explicit_confirmation:false,...next});}
 else{const u=body.contents[0].parts[0].text;const b=u.slice(u.indexOf('BACKEND RESULT (authoritative):')+32,u.indexOf('Write the reply now.')).trim();backends.push(b);text='OK';}
 return new Response(JSON.stringify({candidates:[{content:{parts:[{text}]}}]}),{status:200,headers:{'content-type':'application/json'}});}) as typeof fetch;
test.after(()=>{globalThis.fetch=realFetch});
const cfg={apiKey:'stub',model:'stub'};
function setup(){const db=new SQLiteD1(':memory:','drizzle');db.connection.exec("DELETE FROM treatments");
 for(const [n,p] of [['Skin Consultation',2000],['Hydra Facial',5000],['Glow Facial',3500],['Laser Hair Removal',8000]] as const)db.connection.prepare("INSERT INTO treatments(id,clinic_id,name,price,status) VALUES(?,?,?,?,'Active')").run(crypto.randomUUID(),'skinuvia',n,p);
 return db}
const contact=(draft={}):Contact=>({contact_key:'+923001234567',reply_to:'+923001234567',name:'Profile Name',language:'ROMAN_URDU',draft,human_controlled:0,handover_at:null});
const D=(db:SQLiteD1)=>db as unknown as D1Database;
const last=()=>backends[backends.length-1];

test('day-first date wins over a misread AI date and books correctly',async()=>{const db=setup();const target=day(5);const [y,m,d]=target.split('-');
 next={intent:'BOOKING_REQUEST',patient_name:'Ayesha Khan',service_name:'Hydra Facial',date:`${y}-${d}-${m}`,time:'07:00'};
 const r=await handleTurn(D(db),cfg,contact(),`mera naam Ayesha Khan hai, Hydra Facial ${dm(target)} ko 7 baje`);
 assert.match(last(),/^CONFIRMED/);const a=db.connection.prepare('SELECT * FROM appointments').get() as Record<string,unknown>;
 assert.equal(a.appointment_date,target);assert.equal(a.appointment_time,'19:00');assert.equal(a.patient_name,'Ayesha Khan');assert.equal(a.service,'Hydra Facial');assert.equal(a.price,5000);assert.equal(a.status,'Awaiting Payment');assert.equal(a.source,'WhatsApp AI');assert.ok(r.appointmentId);});

test('words, dates and the profile name are never taken as the patient name',async()=>{const db=setup();
 next={intent:'BOOKING_REQUEST',patient_name:'Kal',service_name:'Skin Consultation'};let r=await handleTurn(D(db),cfg,contact(),'kal consultation chahiye shaam 6 baje');
 assert.match(last(),/BOOKING_DETAILS_NEEDED.*patient's full name/);assert.equal(r.draft.patientName,undefined);assert.equal(r.draft.date,day(1));assert.equal(r.draft.time,'18:00');
 next={intent:'BOOKING_REQUEST',patient_name:'Profile Name'};r=await handleTurn(D(db),cfg,contact(r.draft),'haan');assert.equal(r.draft.patientName,undefined);
 next={intent:'BOOKING_REQUEST',patient_name:null};r=await handleTurn(D(db),cfg,contact(r.draft),'Sana Bibi');
 assert.match(last(),/^CONFIRMED.*Sana Bibi/);assert.equal((db.connection.prepare('SELECT patient_name FROM appointments').get() as {patient_name:string}).patient_name,'Sana Bibi');});

test('an ambiguous service is asked, not guessed',async()=>{const db=setup();
 next={intent:'BOOKING_REQUEST',patient_name:'Hina',service_name:'facial',date:day(2),time:'18:30'};const r=await handleTurn(D(db),cfg,contact(),'Hina, facial parson saade 6');
 assert.equal(r.draft.service,undefined);assert.match(last(),/which treatment/);assert.equal(db.connection.prepare('SELECT count(*) n FROM appointments').get()!.n,0);});

test('taken slot offers alternatives; outside hours and past dates are refused',async()=>{const db=setup();
 next={intent:'BOOKING_REQUEST',patient_name:'Ali',service_name:'Skin Consultation'};await handleTurn(D(db),cfg,contact(),`Ali consultation ${dm(day(3))} 7 baje`);
 const other={...contact(),contact_key:'+923009999999',reply_to:'+923009999999'};
 next={intent:'BOOKING_REQUEST',patient_name:'Bilal',service_name:'Skin Consultation'};let r=await handleTurn(D(db),cfg,other,`Bilal consultation ${dm(day(3))} 7 baje`);
 assert.match(last(),/^SLOT_TAKEN.*(6:45 PM|7:15 PM)/);assert.equal(r.draft.time,undefined);
 r=await handleTurn(D(db),cfg,{...other,draft:{}},`Bilal consultation ${dm(day(3))} subah 11 baje`);assert.match(last(),/OUTSIDE_HOURS/);
 r=await handleTurn(D(db),cfg,{...other,draft:{}},`Bilal consultation ${dm(day(-2))}/${day(-2).slice(0,4)} 7 baje`);assert.match(last(),/DATE_IN_PAST/);});

test('reschedule: asks which when several, moves the named one to the new date',async()=>{const db=setup();
 next={intent:'BOOKING_REQUEST',patient_name:'Ali',service_name:'Skin Consultation'};await handleTurn(D(db),cfg,contact(),`Ali consultation ${dm(day(3))} 7 baje`);
 next={intent:'BOOKING_REQUEST',patient_name:'Zara',service_name:'Glow Facial'};await handleTurn(D(db),cfg,contact(),`Zara Glow Facial ${dm(day(4))} 8 baje`);
 next={intent:'RESCHEDULE',date:day(6),time:'20:00'};await handleTurn(D(db),cfg,contact(),'appointment shift karni hai');assert.match(last(),/^MULTIPLE_APPOINTMENTS/);
 next={intent:'RESCHEDULE',date:null,time:null};await handleTurn(D(db),cfg,contact(),`Zara ki ${dm(day(4))} wali appointment ${dm(day(6))} ko 8 baje kar dein`);
 assert.match(last(),/^RESCHEDULED: Zara/);const z=db.connection.prepare("SELECT appointment_date,appointment_time FROM appointments WHERE patient_name='Zara'").get() as Record<string,string>;
 assert.equal(z.appointment_date,day(6));assert.equal(z.appointment_time,'20:00');const a=db.connection.prepare("SELECT appointment_date FROM appointments WHERE patient_name='Ali'").get() as Record<string,string>;assert.equal(a.appointment_date,day(3));});

test('cancel asks for confirmation then cancels',async()=>{const db=setup();
 next={intent:'BOOKING_REQUEST',patient_name:'Ali',service_name:'Skin Consultation'};await handleTurn(D(db),cfg,contact(),`Ali consultation ${dm(day(3))} 7 baje`);
 next={intent:'CANCEL'};let r=await handleTurn(D(db),cfg,contact(),'cancel kar dein');assert.match(last(),/^CONFIRM_CANCEL/);
 next={intent:'BOOKING_CONFIRMATION',explicit_confirmation:true};r=await handleTurn(D(db),cfg,contact(r.draft),'haan');assert.match(last(),/^CANCELLED/);
 assert.equal((db.connection.prepare('SELECT status FROM appointments').get() as {status:string}).status,'Cancelled');});
test('price and treatment questions carry the exact listed price and the consultation advice',async()=>{const db=setup();
 next={intent:'PRICE_QUESTION',service_name:'Hydra Facial'};await handleTurn(D(db),cfg,contact(),'hydra facial ki fees kitni hai?');assert.match(last(),/SERVICE_FACT: Hydra Facial costs exactly PKR 5,000/);assert.match(last(),/consultation/);
 next={intent:'INFO_QUESTION',service_name:null};await handleTurn(D(db),cfg,contact(),'PRP ke kya fayde hain?');assert.match(last(),/not in the list[\s\S]*consultation/);
 next={intent:'MEDICAL_CONCERN'};await handleTurn(D(db),cfg,contact(),'mere chehre pe daane hain kya karun');assert.match(last(),/MEDICAL_QUESTION.*do not diagnose/);});
