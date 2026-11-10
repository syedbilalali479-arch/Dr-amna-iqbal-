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
