import test from 'node:test';
import assert from 'node:assert/strict';
import {printInvoice} from '../lib/invoice-print.ts';

test('medicine sale receipt shows sale columns and excludes batch and expiry',()=>{
 let html='';
 const reserved={document:{write:(value:string)=>{html+=value},close:()=>{}},focus:()=>{},print:()=>{}} as unknown as Window;
 printInvoice({kind:'sales',number:'SALE-1',patient_name:'Patient',state:'Finalized',discount:0,paid:60,items:[{medicine_id:'m1',medicine_name:'Test Cream',description:'Test Cream',quantity:2,price:30,batch:'PRIVATE-BATCH',expiry:'2030-01-01'}]},reserved);
 for(const text of ['Medicine name','Quantity','Unit price','Amount','Test Cream','Subtotal','Total'])assert.match(html,new RegExp(text));
 assert.doesNotMatch(html,/PRIVATE-BATCH|2030-01-01|Batch|Expiry/);
});
