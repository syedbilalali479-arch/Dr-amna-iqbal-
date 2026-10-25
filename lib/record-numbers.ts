export type NumberedRow=Record<string,unknown>;
export const numberPrefixes:Record<string,string>={patients:'MR',appointments:'AP',invoices:'INV',prescriptions:'RX',medicines:'MED',vendors:'VEN',purchases:'PUR',sales:'SALE',vendor_payments:'PAY',leads:'LEAD',followups:'FU',plans:'PLAN',promotions:'OFFER',treatments:'SVC',conversations:'CHAT',patterns:'RULE',stock_movements:'STK'};
export function formatRecordNumber(kind:string,n:number){return `${numberPrefixes[kind]||'REF'}-${String(n).padStart(3,'0')}`;}
export function numberStatement(db:D1Database,clinic:string,kind:string,entity:string){return db.prepare('INSERT INTO record_numbers(clinic_id,kind,entity_id,number) SELECT ?,?,?,coalesce(max(number),0)+1 FROM record_numbers WHERE clinic_id=? AND kind=? ON CONFLICT(clinic_id,kind,entity_id) DO NOTHING').bind(clinic,kind,entity,clinic,kind);}
export async function decorateRecords(db:D1Database,clinic:string,data:Record<string,unknown>){
 let rows=(await db.prepare('SELECT kind,entity_id,number FROM record_numbers WHERE clinic_id=?').bind(clinic).all<{kind:string;entity_id:string;number:number}>()).results;
 const known=new Set(rows.map(r=>r.kind+'|'+r.entity_id)),pending:D1PreparedStatement[]=[];
 const ensure=(kind:string,id:unknown)=>{if(!id||id==='unlinked'||!numberPrefixes[kind])return;const key=kind+'|'+String(id);if(!known.has(key)){known.add(key);pending.push(numberStatement(db,clinic,kind,String(id)))}};
 for(const [kind,value] of Object.entries(data))if(numberPrefixes[kind]&&Array.isArray(value))for(const row of value as NumberedRow[]){ensure(kind,row.id);ensure('patients',row.patient_id)}
 if(pending.length){for(let start=0;start<pending.length;start+=75)await db.batch(pending.slice(start,start+75));rows=(await db.prepare('SELECT kind,entity_id,number FROM record_numbers WHERE clinic_id=?').bind(clinic).all<{kind:string;entity_id:string;number:number}>()).results;}
 const byKind=new Map(rows.map(r=>[r.kind+'|'+r.entity_id,formatRecordNumber(r.kind,r.number)])),byId=new Map(rows.map(r=>[r.entity_id,formatRecordNumber(r.kind,r.number)]));
 const out={...data};for(const [kind,value] of Object.entries(data))if(numberPrefixes[kind]&&Array.isArray(value))out[kind]=(value as NumberedRow[]).map(row=>({...row,number:byKind.get(kind+'|'+row.id),...(row.patient_id?{patient_number:byKind.get('patients|'+row.patient_id)}:{}),...(row.document_id?{document_number:byId.get(String(row.document_id))}:{}),...(row.medicine_id?{medicine_number:byId.get(String(row.medicine_id))}:{})}));return out;
}
export async function describeRecord(db:D1Database,clinic:string,kind:string,row:NumberedRow){return ((await decorateRecords(db,clinic,{[kind]:[row]}))[kind] as NumberedRow[])[0];}
