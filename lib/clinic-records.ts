export type ClinicRow=Record<string,unknown>;
export type ClinicData=Record<string,ClinicRow[]>;
export const clinicKeys=['patients','appointments','prescriptions','medicines','invoices','leads','followups','plans','promotions','treatments','conversations','patterns','learning','states','audit'] as const;
export const pharmacyKeys=['vendors','purchases','sales','vendor_payments','expenses','invoices','stock_movements'] as const;
export function emptyClinicData():ClinicData{return Object.fromEntries([...new Set([...clinicKeys,...pharmacyKeys])].map(key=>[key,[]]));}
export type RecordsError={source:'clinic'|'pharmacy';message:string;status?:number};
class RequestError extends Error {constructor(message:string,readonly status?:number){super(message)}}
async function requestRecords(url:string,keys:readonly string[],label:string,fetcher:typeof fetch,timeoutMs:number){
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new RequestError(`${label} took too long to load. Check your connection and retry.`));controller.abort();},timeoutMs)});
  return await Promise.race([(async()=>{
   const response=await fetcher(url,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   if(response.status===401)throw new RequestError('Your session has expired. Reload the page to sign in again.',401);
   if(!response.ok)throw new RequestError(`${label} could not be loaded. Please retry.`,response.status);
   let body:Record<string,unknown>;try{body=await response.json()}catch{throw new RequestError(`${label} returned an invalid response. Please retry.`)}
   if(!body||keys.some(key=>!Array.isArray(body[key])))throw new RequestError(`${label} returned incomplete records. Please retry.`);
   return Object.fromEntries(keys.map(key=>[key,body[key]])) as ClinicData;
  })(),timeout]);
 }catch(e){if(e instanceof RequestError)throw e;throw new RequestError(`${label} could not be reached. Check your connection and retry.`)}finally{if(timer)clearTimeout(timer);}
}
export async function fetchClinicRecords(fetcher:typeof fetch=fetch,timeoutMs=15000){
 const results=await Promise.allSettled([
  requestRecords('/api/clinic',clinicKeys,'Clinic records',fetcher,timeoutMs),
  requestRecords('/api/commerce',pharmacyKeys,'Pharmacy records',fetcher,timeoutMs),
 ]);
 const errors:RecordsError[]=results.flatMap((result,index)=>result.status==='rejected'?[{source:index===0?'clinic' as const:'pharmacy' as const,message:result.reason instanceof Error?result.reason.message:'Unable to load records',status:result.reason instanceof RequestError?result.reason.status:undefined}]:[]);
 return {clinic:results[0].status==='fulfilled'?results[0].value:undefined,pharmacy:results[1].status==='fulfilled'?results[1].value:undefined,errors};
}
export function mergeClinicRecords(previous:ClinicData,clinic?:ClinicData,pharmacy?:ClinicData):ClinicData{
 return {...previous,...clinic,...pharmacy,invoices:[...(clinic?.invoices??previous.invoices.filter(r=>!r.revision)),...(pharmacy?.invoices??previous.invoices.filter(r=>Boolean(r.revision)))]};
}
