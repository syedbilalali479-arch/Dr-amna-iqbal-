import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import {statusForPayment,statusLabel,STATUS_FROM_PAYMENT_SQL,AWAITING_PAYMENT} from '../lib/appointment-status.ts';
test('status follows payment and keeps final statuses',()=>{
 assert.equal(statusForPayment(null,'Unpaid'),AWAITING_PAYMENT);
 assert.equal(statusForPayment('Waiting','Paid'),'Confirmed');
 assert.equal(statusForPayment('Confirmed','Unpaid'),AWAITING_PAYMENT);
 assert.equal(statusForPayment(AWAITING_PAYMENT,'Partially Paid'),'Confirmed');
 for(const s of ['Completed','Cancelled','No-show','Rescheduled'])assert.equal(statusForPayment(s,'Paid'),s);
});
test('awaiting payment label tells whether the bill was made',()=>{
 assert.equal(statusLabel(AWAITING_PAYMENT,false),'Bill not made · Waiting for payment');
 assert.equal(statusLabel(AWAITING_PAYMENT,true),'Bill made · Waiting for payment');
 assert.equal(statusLabel('Confirmed',true),'Confirmed');
});
test('SQL status expression matches the TypeScript rule',()=>{
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE appointments(status TEXT)');
 for(const [status,payment,expected] of [['Waiting','Paid','Confirmed'],['Confirmed','Unpaid',AWAITING_PAYMENT],['Completed','Unpaid','Completed'],['Cancelled','Paid','Cancelled']]){
  db.exec('DELETE FROM appointments');db.prepare('INSERT INTO appointments VALUES(?)').run(status);
  db.prepare(`UPDATE appointments SET status=${STATUS_FROM_PAYMENT_SQL}`).run(payment);
  assert.equal((db.prepare('SELECT status FROM appointments').get() as {status:string}).status,expected);
 }
});
test('migration 0012 confirms paid appointments, marks the rest Awaiting Payment and audits the change',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE appointments(id TEXT,clinic_id TEXT,status TEXT,payment_status TEXT);CREATE TABLE audit_logs(id TEXT PRIMARY KEY,clinic_id TEXT,actor_id TEXT,action TEXT,entity_type TEXT,entity_id TEXT,detail TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
 const rows=[['a','Waiting','Paid','Confirmed'],['b','Confirmed','Unpaid',AWAITING_PAYMENT],['c','Waiting','Unpaid',AWAITING_PAYMENT],['d','Confirmed','Paid','Confirmed'],['e','Completed','Unpaid','Completed'],['f','Cancelled','Paid','Cancelled'],['g','Waiting','Partially Paid','Confirmed']];
 for(const [id,status,payment] of rows)db.prepare("INSERT INTO appointments VALUES(?,'skinuvia',?,?)").run(id,status,payment);
 db.exec(readFileSync('drizzle/0012_status_follows_payment.sql','utf8'));
 for(const [id,,,expected] of rows)assert.equal((db.prepare('SELECT status FROM appointments WHERE id=?').get(id) as {status:string}).status,expected,id);
 assert.equal((db.prepare("SELECT count(*) AS n FROM audit_logs WHERE action='STATUS_MIGRATION'").get() as {n:number}).n,4);
});
test('migration 0013 finalizes draft appointment bills and re-syncs payment',async()=>{
 const {SQLiteD1}=await import('../lib/sqlite-d1.ts');const d1=new SQLiteD1(':memory:','drizzle');const db=d1.connection;
 try{
  const appt=(id:string,status:string,payment:string)=>db.prepare("INSERT INTO appointments(id,clinic_id,patient_id,patient_name,phone,doctor,service,appointment_date,appointment_time,status,payment_status,price) VALUES(?,'skinuvia','PT-1','Rabia','0300','Dr. Aamina Iqbal','Skin Consultation','2026-11-10','18:00',?,?,2000)").run(id,status,payment);
  const bill=(id:string,appointment:string,state:string,paid:number)=>db.prepare("INSERT INTO commerce_documents(id,clinic_id,kind,body) VALUES(?,'skinuvia','invoices',?)").run(id,JSON.stringify({appointment_id:appointment,patient_id:'PT-1',patient_name:'Rabia',state,net:2000,paid,balance:2000-paid,status:paid===2000?'Paid':paid>0?'Partially Paid':'Unpaid'}));
  appt('A-draft-paid',AWAITING_PAYMENT,'Unpaid');bill('I-1','A-draft-paid','Draft',2000);
  appt('A-draft-part','Confirmed','Unpaid');bill('I-2','A-draft-part','Draft',500);
  appt('A-final-unpaid','Confirmed','Paid');bill('I-3','A-final-unpaid','Finalized',0);
  appt('A-done','Completed','Unpaid');bill('I-4','A-done','Draft',2000);
  appt('A-nobill',AWAITING_PAYMENT,'Unpaid');
  db.exec(readFileSync('drizzle/0013_finalize_draft_appointment_bills.sql','utf8'));
  const row=(id:string)=>db.prepare('SELECT status,payment_status FROM appointments WHERE id=?').get(id) as {status:string;payment_status:string};
  assert.deepEqual({...row('A-draft-paid')},{status:'Confirmed',payment_status:'Paid'});
  assert.deepEqual({...row('A-draft-part')},{status:'Confirmed',payment_status:'Partially Paid'});
  assert.deepEqual({...row('A-final-unpaid')},{status:AWAITING_PAYMENT,payment_status:'Unpaid'});
  assert.deepEqual({...row('A-done')},{status:'Completed',payment_status:'Paid'});
  assert.deepEqual({...row('A-nobill')},{status:AWAITING_PAYMENT,payment_status:'Unpaid'});
  const states=db.prepare("SELECT json_extract(body,'$.state') AS s FROM commerce_documents WHERE kind='invoices'").all() as {s:string}[];
  assert.ok(states.every(x=>x.s==='Finalized'));
  assert.equal((db.prepare("SELECT count(*) AS n FROM audit_logs WHERE action='FINALIZE_DRAFT_BILL'").get() as {n:number}).n,3);
 }finally{d1.connection.close()}
});
test('migration 0014 closes an unbilled booking duplicated by a paid walk-in the same day',async()=>{
 const {SQLiteD1}=await import('../lib/sqlite-d1.ts');const d1=new SQLiteD1(':memory:','drizzle');const db=d1.connection;
 try{
  const appt=(id:string,name:string,phone:string,date:string,status:string)=>db.prepare("INSERT INTO appointments(id,clinic_id,patient_id,patient_name,phone,doctor,service,appointment_date,appointment_time,status,payment_status,price) VALUES(?,'skinuvia','PT-1',?,?,'Dr. Aamina Iqbal','Skin Consultation',?,'18:00',?,'Unpaid',2000)").run(id,name,phone,date,status);
  appt('booking','Rabia','0300','2026-11-10',AWAITING_PAYMENT);appt('walkin','rabia ','0300','2026-11-10','Confirmed');
  appt('other-day','Rabia','0300','2026-11-11',AWAITING_PAYMENT);appt('sister','Sana','0300','2026-11-10',AWAITING_PAYMENT);
  db.prepare("INSERT INTO commerce_documents(id,clinic_id,kind,body) VALUES('INV-W','skinuvia','invoices',?)").run(JSON.stringify({appointment_id:'walkin',state:'Finalized',status:'Paid',paid:2000,net:2000}));
  db.exec(readFileSync('drizzle/0014_close_duplicate_unbilled_bookings.sql','utf8'));
  const st=(id:string)=>(db.prepare('SELECT status,notes FROM appointments WHERE id=?').get(id) as {status:string;notes:string});
  assert.equal(st('booking').status,'Cancelled');assert.match(st('booking').notes,/walkin/);
  assert.equal(st('walkin').status,'Confirmed');assert.equal(st('other-day').status,AWAITING_PAYMENT);assert.equal(st('sister').status,AWAITING_PAYMENT);
 }finally{d1.connection.close()}
});
test('migration 0015 cancels bills whose appointment was deleted and leaves live bills alone',async()=>{
 const {SQLiteD1}=await import('../lib/sqlite-d1.ts');const d1=new SQLiteD1(':memory:','drizzle');const db=d1.connection;
 try{
  db.prepare("INSERT INTO appointments(id,clinic_id,patient_id,patient_name,phone,doctor,service,appointment_date,appointment_time,status,payment_status,price) VALUES('live','skinuvia','PT-1','A','0300','Dr. Aamina Iqbal','Skin Consultation','2026-11-10','18:00','Confirmed','Paid',2000)").run();
  const bill=(id:string,appointment:string)=>db.prepare("INSERT INTO commerce_documents(id,clinic_id,kind,body) VALUES(?,'skinuvia','invoices',?)").run(id,JSON.stringify({appointment_id:appointment,state:'Finalized',status:'Paid',paid:2000,net:2000,balance:0,date:'2026-11-10'}));
  bill('I-live','live');bill('I-gone','deleted-appointment');
  db.exec(readFileSync('drizzle/0015_void_bills_of_deleted_appointments.sql','utf8'));
  const body=(id:string)=>JSON.parse((db.prepare('SELECT body FROM commerce_documents WHERE id=?').get(id) as {body:string}).body);
  assert.equal(body('I-live').state,'Finalized');
  assert.equal(body('I-gone').state,'Voided');assert.equal(body('I-gone').appointment_deleted,true);assert.equal(body('I-gone').paid,2000);
  assert.equal((db.prepare("SELECT count(*) AS n FROM audit_logs WHERE entity_id='I-gone'").get() as {n:number}).n,1);
 }finally{d1.connection.close()}
});
test('migration 0016 re-syncs status and payment drift left by an older build',async()=>{
 const {SQLiteD1}=await import('../lib/sqlite-d1.ts');const d1=new SQLiteD1(':memory:','drizzle');const db=d1.connection;
 try{
  const appt=(id:string,status:string,payment:string,name='P',phone='0300')=>db.prepare("INSERT INTO appointments(id,clinic_id,patient_id,patient_name,phone,doctor,service,appointment_date,appointment_time,status,payment_status,price) VALUES(?,'skinuvia','PT-1',?,?,'Dr. Aamina Iqbal','Skin Consultation','2026-11-12','18:45',?,?,2000)").run(id,name,phone,status,payment);
  const bill=(id:string,appointment:string,status:string,paid:number)=>db.prepare("INSERT INTO commerce_documents(id,clinic_id,kind,body) VALUES(?,'skinuvia','invoices',?)").run(id,JSON.stringify({appointment_id:appointment,state:'Finalized',status,paid,net:2000}));
  appt('maryam',AWAITING_PAYMENT,'Paid','Maryam','0301');bill('I-m','maryam','Paid',2000);
  appt('walkin-old','Waiting','Paid','W','0302');bill('I-w','walkin-old','Paid',2000);
  appt('booked','Confirmed','Unpaid','Q','0303');
  appt('refund',AWAITING_PAYMENT,'Paid','R','0304');bill('I-r','refund','Refunded',0);
  appt('done','Completed','Unpaid','D','0305');bill('I-d','done','Paid',2000);
  appt('dup-booking',AWAITING_PAYMENT,'Unpaid','Sana','0306');appt('dup-walkin','Waiting','Paid','sana','0306');bill('I-s','dup-walkin','Paid',2000);
  db.exec(readFileSync('drizzle/0016_resync_after_rollback.sql','utf8'));
  const row=(id:string)=>({...(db.prepare('SELECT status,payment_status FROM appointments WHERE id=?').get(id) as object)});
  assert.deepEqual(row('maryam'),{status:'Confirmed',payment_status:'Paid'});
  assert.deepEqual(row('walkin-old'),{status:'Confirmed',payment_status:'Paid'});
  assert.deepEqual(row('booked'),{status:AWAITING_PAYMENT,payment_status:'Unpaid'});
  assert.deepEqual(row('refund'),{status:'Confirmed',payment_status:'Refunded'});
  assert.deepEqual(row('done'),{status:'Completed',payment_status:'Paid'});
  assert.deepEqual(row('dup-booking'),{status:'Cancelled',payment_status:'Unpaid'});
  assert.deepEqual(row('dup-walkin'),{status:'Confirmed',payment_status:'Paid'});
 }finally{d1.connection.close()}
});
