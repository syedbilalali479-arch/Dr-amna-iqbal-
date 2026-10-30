import test from 'node:test';
import assert from 'node:assert/strict';
import {printInvoice,printReadyWindow} from '../lib/invoice-print.ts';
import {readFileSync} from 'node:fs';

test('medicine sale receipt shows sale columns and excludes batch and expiry',()=>{
 let html='';
 const reserved={document:{open:()=>{},write:(value:string)=>{html+=value},close:()=>{},readyState:'complete'},focus:()=>{},print:()=>{},setTimeout:(callback:()=>void)=>{callback();return 1}} as unknown as Window;
 printInvoice({kind:'sales',number:'SALE-1',patient_name:'Patient',state:'Finalized',discount:0,paid:60,items:[{medicine_id:'m1',medicine_name:'Test Cream',description:'Test Cream',quantity:2,price:30,batch:'PRIVATE-BATCH',expiry:'2030-01-01'}]},reserved);
 for(const text of ['Medicine name','Quantity','Unit price','Amount','Test Cream','Subtotal','Total'])assert.match(html,new RegExp(text));
 assert.doesNotMatch(html,/PRIVATE-BATCH|2030-01-01|Batch|Expiry/);
 assert.doesNotMatch(html,/Outstanding balance/);
 assert.match(html,/color:#111/);
 assert.match(html,/@page\{size:auto;margin:10mm\}/);
 assert.doesNotMatch(html,/@page\{size:A4/);
});

test('waits for a loading print document before opening browser preview',()=>{
 let loaded:EventListener|undefined,printed=0;
 const popup={closed:false,document:{readyState:'loading'},addEventListener:(event:string,callback:EventListener)=>{if(event==='load')loaded=callback},setTimeout:(callback:()=>void)=>{callback();return 1},focus:()=>{},print:()=>{printed++}} as unknown as Window;
 printReadyWindow(popup,0);
 assert.equal(printed,0);
 loaded?.(new Event('load'));
 assert.equal(printed,1);
});

test('browser printing uses a real same-origin document instead of about blank',()=>{
 const helper=readFileSync(new URL('../lib/invoice-print.ts',import.meta.url),'utf8'),route=readFileSync(new URL('../app/print-document/route.ts',import.meta.url),'utf8'),appointment=readFileSync(new URL('../app/appointment-editor.tsx',import.meta.url),'utf8');
 assert.match(helper,/\/print-document\?key=/);
 assert.match(route,/DOMParser/);
 assert.match(route,/document\.fonts/);
 assert.match(route,/requestAnimationFrame/);
 assert.doesNotMatch(route,/document\.open\(|document\.write\(/);
 assert.doesNotMatch(appointment,/window\.open\('','_blank'/);
});
