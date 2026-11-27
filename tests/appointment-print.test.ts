import test from 'node:test';
import assert from 'node:assert/strict';
import {appointmentPrintEntries,appointmentPrintHtml} from '../lib/record-print.ts';

test('appointment print contains only the requested fields in the requested order',()=>{
 const row={id:'private-id',number:'SR-001',patient_number:'MR-007',patient_name:'Test Patient',phone:'03001234567',service:'Hydra Facial',appointment_date:'2026-11-01',appointment_time:'17:30',price:9000,created_at:'2026-10-30 12:00:00',doctor:'Private doctor',status:'Confirmed',notes:'Private notes'};
 const entries=appointmentPrintEntries(row);
 assert.deepEqual(entries.map(([label])=>label),['MR Number','Patient Name','Phone Number','Service / Treatment','Appointment Date','Appointment Time','Price','Created At']);
 assert.deepEqual(Object.fromEntries(entries),{'MR Number':'MR-007','Patient Name':'Test Patient','Phone Number':'03001234567','Service / Treatment':'Hydra Facial','Appointment Date':'01/11/2026','Appointment Time':'5:30 PM','Price':'PKR 9,000','Created At':'2026-10-30 12:00:00'});
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

test('a discounted bill prints price, discount and the amount payable, not the undiscounted price alone',()=>{
 const row={patient_name:'Fida Hussain',service:'Skin Consultation',price:2000,appointment_date:'2026-11-27',appointment_time:'18:00'};
 const entries=Object.fromEntries(appointmentPrintEntries(row,{discount:500,total:2000,net:1500}));
 assert.equal(entries['Price'],'PKR 2,000');assert.equal(entries['Discount'],'PKR 500');assert.equal(entries['Total Payable'],'PKR 1,500');
 const html=appointmentPrintHtml(row,'27 Nov 2026',{discount:500,total:2000,net:1500});
 assert.match(html,/Total Payable[\s\S]*PKR 1,500/);
 // no discount (or no invoice) keeps the original slip
 assert.deepEqual(Object.keys(Object.fromEntries(appointmentPrintEntries(row,{discount:0,total:2000,net:2000}))).includes('Discount'),false);
 assert.deepEqual(appointmentPrintEntries(row),appointmentPrintEntries(row,null));
});
