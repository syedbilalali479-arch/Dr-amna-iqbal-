import test from 'node:test';import assert from 'node:assert/strict';
import {emptyClinicData,fetchClinicRecords,mergeClinicRecords,clinicKeys,pharmacyKeys} from '../lib/clinic-records.ts';
const payload=(keys:readonly string[])=>Object.fromEntries(keys.map(k=>[k,[]]));
test('initial data has no demonstration patients, revenue or stock',()=>{for(const rows of Object.values(emptyClinicData()))assert.deepEqual(rows,[])});
test('clinic and pharmacy requests run concurrently with fresh same-origin credentials',async()=>{
 const calls:{url:string;init?:RequestInit}[]=[];const resolve:((r:Response)=>void)[]=[];
 const fetcher=((url:unknown,init?:RequestInit)=>{calls.push({url:String(url),init});return new Promise<Response>(r=>resolve.push(r))}) as typeof fetch;
 const request=fetchClinicRecords(fetcher,1000);assert.equal(calls.length,2);for(const c of calls){assert.equal(c.init?.credentials,'same-origin');assert.equal(c.init?.cache,'no-store')}
 resolve[0](Response.json(payload(clinicKeys)));resolve[1](Response.json(payload(pharmacyKeys)));const result=await request;assert.deepEqual(result.errors,[]);assert.ok(result.clinic&&result.pharmacy);
});
test('a stuck request finishes with a timeout and retains the successful source',async()=>{
 const fetcher=((url:unknown)=>String(url).includes('commerce')?new Promise<Response>(()=>{}):Promise.resolve(Response.json({...payload(clinicKeys),patients:[{id:'REAL-1',name:'Existing patient'}]}))) as typeof fetch;
 const result=await fetchClinicRecords(fetcher,25);assert.equal(result.errors.length,1);assert.equal(result.errors[0].source,'pharmacy');assert.match(result.errors[0].message,/too long/);assert.equal(result.clinic?.patients[0].id,'REAL-1');
});
test('authentication expiry and invalid responses become actionable failures',async()=>{
 const result=await fetchClinicRecords((async(url:unknown)=>String(url).includes('commerce')?new Response('<html>error</html>'):new Response('',{status:401})) as typeof fetch,1000);
 assert.equal(result.errors.length,2);assert.equal(result.errors[0].status,401);assert.match(result.errors[0].message,/session has expired/);assert.match(result.errors[1].message,/invalid response/);
});
test('partial reload preserves real records and invoice sources without duplication',()=>{
 const previous={...emptyClinicData(),patients:[{id:'patient'}],invoices:[{id:'legacy'},{id:'finance',revision:1}]};
 const pharmacy={...payload(pharmacyKeys),invoices:[{id:'finance',revision:2}]} ;const first=mergeClinicRecords(previous,undefined,pharmacy);assert.deepEqual(first.patients,previous.patients);assert.deepEqual(first.invoices,[{id:'legacy'},{id:'finance',revision:2}]);assert.deepEqual(mergeClinicRecords(first,undefined,pharmacy).invoices,first.invoices);
 assert.deepEqual(mergeClinicRecords(first,payload(clinicKeys),payload(pharmacyKeys)).invoices,[]);
});
test('retry succeeds after a transient network failure',async()=>{
 const failed=await fetchClinicRecords((async()=>{throw new TypeError('offline')}) as typeof fetch,100);assert.equal(failed.errors.length,2);
 const recovered=await fetchClinicRecords((async(url:unknown)=>Response.json(payload(String(url).includes('commerce')?pharmacyKeys:clinicKeys))) as typeof fetch,100);assert.deepEqual(recovered.errors,[]);
});
