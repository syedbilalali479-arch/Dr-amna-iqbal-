import test from 'node:test';
import assert from 'node:assert/strict';
import {appointmentPrintEntries,appointmentPrintHtml} from '../lib/record-print.ts';

test('appointment print contains only the requested fields in the requested order',()=>{
 const row={id:'private-id',number:'SR-001',patient_number:'MR-007',patient_name:'Test Patient',phone:'03001234567',service:'Hydra Facial',appointment_date:'2026-11-01',appointment_time:'17:30',price:9000,created_at:'2026-10-30 12:00:00',doctor:'Private doctor',status:'Confirmed',notes:'Private notes'};
 const entries=appointmentPrintEntries(row);
 assert.deepEqual(entries.map(([label])=>label),['MR Number','Patient Name','Phone Number','Service / Treatment','Appointment Date','Appointment Time','Price','Created At']);
 assert.deepEqual(Object.fromEntries(entries),{'MR Number':'MR-007','Patient Name':'Test Patient','Phone Number':'03001234567','Service / Treatment':'Hydra Facial','Appointment Date':'11/01/2026','Appointment Time':'17:30','Price':'PKR 9,000','Created At':'2026-10-30 12:00:00'});
 const printed=JSON.stringify(entries);
 for(const hidden of ['private-id','SR-001','Private doctor','Confirmed','Private notes'])assert.doesNotMatch(printed,new RegExp(hidden));
});

test('appointment slip is compact, dark and suppresses browser header space',()=>{
 const html=appointmentPrintHtml({patient_name:'Test',appointment_date:'2026-11-01'},'30 Oct 2026');
 assert.match(html,/@page\{margin:0\}/);
 assert.match(html,/width:72mm/);
 assert.match(html,/color:#000/);
 assert.doesNotMatch(html,/railway|https?:\/\//i);
});
