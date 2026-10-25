import {env} from '@/lib/runtime-env';
import {getChatGPTUser} from '../../chatgpt-auth';
import {commerceKinds, normalizeDocument, stockDelta, type CommerceRecord} from '../../../lib/commerce';
import {resolvePatient} from '../../../lib/patient-record';
const clinic='skinuvia';
const id=()=>crypto.randomUUID();
export async function GET() {
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Authentication required'},{status:401});
 try {
  const result:Record<string,unknown[]>={vendors:[],purchases:[],sales:[],vendor_payments:[],invoices:[]};
  const docs=await env.DB!.prepare('SELECT * FROM commerce_documents WHERE clinic_id=? ORDER BY created_at DESC').bind(clinic).all<{id:string;kind:string;body:string;revision:number;created_at:string;updated_at:string}>();
  for(const row of docs.results)result[row.kind]?.push({...JSON.parse(row.body),id:row.id,revision:row.revision,created_at:row.created_at,updated_at:row.updated_at});
  result.stock_movements=(await env.DB!.prepare('SELECT * FROM stock_movements WHERE clinic_id=? ORDER BY created_at DESC LIMIT 500').bind(clinic).all()).results;
  return Response.json(result);
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Unable to load pharmacy records'},{status:500});}
}
export async function POST(request:Request) {
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Authentication required'},{status:401});
 try {
  const {resource:kind,operation,record:input}=await request.json() as {resource:string;operation:string;record:CommerceRecord};
  if(!commerceKinds.includes(kind as typeof commerceKinds[number])||!['create','update','delete'].includes(operation))throw new Error('Unsupported operation');
  const db=env.DB!; const recordId=String(input.id||id());
  const stored=await db.prepare('SELECT body,revision FROM commerce_documents WHERE clinic_id=? AND id=? AND kind=?').bind(clinic,recordId,kind).first<{body:string;revision:number}>();
  if(operation!=='create'&&!stored)return Response.json({error:'Record no longer exists. Refresh the page.'},{status:404});
  if(operation==='create'&&stored)throw new Error('This record already exists');
  if(stored&&Number(input.revision)!==stored.revision)return Response.json({error:'This record changed. Refresh before editing.'},{status:409});
  const before=stored?JSON.parse(stored.body) as CommerceRecord:null;
  if(operation==='delete'&&kind==='vendors') {
   const linked=await db.prepare("SELECT id FROM commerce_documents WHERE clinic_id=? AND kind IN ('purchases','vendor_payments') AND json_extract(body,'$.vendor_id')=? LIMIT 1").bind(clinic,recordId).first();
   if(linked)throw new Error('This vendor has purchases or payments. Keep its history and edit its details instead.');
  }
  if(operation==='delete'&&before?.state==='Finalized')throw new Error('Void the finalized document before deleting it to preserve its history.');
  const after=operation==='delete'?null:normalizeDocument(kind,{...input,id:recordId});
  const newEntities:D1PreparedStatement[]=[];
  if(after&&!['vendors','purchases','vendor_payments'].includes(kind)){const resolved=await resolvePatient(db,clinic,after);after.patient_id=resolved.patient.id;after.patient_name=resolved.patient.name;after.phone=resolved.patient.phone;newEntities.push(...resolved.statements);if(resolved.statements.length)newEntities.push(db.prepare('INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?,?,?)').bind(id(),clinic,user.userId,'AUTO_CREATE','patients',resolved.patient.id,JSON.stringify({after:resolved.patient})));}
  if(after&&['purchases','vendor_payments'].includes(kind)&&!after.vendor_id){const name=String(after.vendor_name||'').trim();if(!name)throw new Error('Enter a vendor name');after.vendor_name=name;const matches=(await db.prepare("SELECT id,body FROM commerce_documents WHERE clinic_id=? AND kind='vendors' AND lower(json_extract(body,'$.name'))=lower(?)").bind(clinic,name).all<{id:string;body:string}>()).results;if(matches.length>1)throw new Error('Select the intended vendor from the suggestions');if(matches[0])after.vendor_id=matches[0].id;else{after.vendor_id=id();const vendor={id:after.vendor_id,name,phone:'',opening_date:after.date,opening_balance:0,balance_type:'Payable'};newEntities.push(db.prepare("INSERT INTO commerce_documents(id,clinic_id,kind,body) VALUES(?,?,'vendors',?)").bind(after.vendor_id,clinic,JSON.stringify(vendor)));}}
  if(after?.vendor_id) {
   const vendor=await db.prepare("SELECT body FROM commerce_documents WHERE clinic_id=? AND id=? AND kind='vendors'").bind(clinic,String(after.vendor_id)).first<{body:string}>();if(!vendor&&!newEntities.length)throw new Error('Vendor does not exist');
   if(vendor){after.vendor_name=JSON.parse(vendor.body).name;if(String(after.date)<String(JSON.parse(vendor.body).opening_date))throw new Error('The date must be on or after the vendor opening balance date');}
  }
  if(kind==='vendors'&&after&&stored){const earliest=await db.prepare("SELECT MIN(json_extract(body,'$.date')) AS date FROM commerce_documents WHERE clinic_id=? AND kind IN ('purchases','vendor_payments') AND json_extract(body,'$.vendor_id')=?").bind(clinic,recordId).first<{date:string|null}>();if(earliest?.date&&String(after.opening_date)>earliest.date)throw new Error('Opening balance date cannot be after existing purchases or payments');}
  if(after?.appointment_id) {
   const appointment=await db.prepare('SELECT patient_id FROM appointments WHERE clinic_id=? AND id=?').bind(clinic,String(after.appointment_id)).first<{patient_id:string}>();
   if(!appointment||appointment.patient_id!==after.patient_id)throw new Error('Invoice patient must match the appointment');
  }
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const pendingMedicines=new Map<string,Record<string,unknown>>();
  for(const line of after?.items||[])if(kind!=='invoices') {
   let med:Record<string,unknown>|null=null;
   if(kind==='purchases'&&!line.medicine_id){med=pendingMedicines.get(String(line.medicine_name).toLowerCase()+'|'+line.batch)||await db.prepare('SELECT * FROM medicines WHERE clinic_id=? AND lower(name)=lower(?) AND batch=?').bind(clinic,line.medicine_name!,line.batch!).first<Record<string,unknown>>();if(med&&String(med.expiry)!==line.expiry)throw new Error('That batch already has a different expiry. Select it or enter a distinct batch number.');if(!med){const sellingPrice=Number(line.selling_price||0);if(!Number.isFinite(sellingPrice)||sellingPrice<0)throw new Error('Enter a valid selling price');med={id:id(),name:line.medicine_name,batch:line.batch,expiry:line.expiry,generic_name:line.generic_name||''};newEntities.push(db.prepare('INSERT INTO medicines(id,clinic_id,name,generic_name,batch,expiry,quantity,minimum_stock,purchase_rate,selling_price,vendor) VALUES(?,?,?,?,?,?,0,10,?,?,?)').bind(med.id,clinic,med.name,med.generic_name,med.batch,med.expiry,line.price,sellingPrice,String(after?.vendor_name||'')));}line.medicine_id=String(med.id);pendingMedicines.set(String(line.medicine_name).toLowerCase()+'|'+line.batch,med);}
   else med=await db.prepare('SELECT * FROM medicines WHERE clinic_id=? AND id=?').bind(clinic,line.medicine_id!).first<Record<string,unknown>>();
   if(!med)throw new Error('Medicine batch no longer exists');
   if(after?.state==='Finalized'&&kind==='sales'&&String(med.expiry)<today&&(stockDelta(kind,before,after).get(line.medicine_id!)||0)<0)throw new Error(`${med.name} is expired and cannot be sold`);
   line.description=`${med.name}${med.generic_name?` (${med.generic_name})`:''} · Batch ${med.batch} · Exp ${med.expiry}`;
  }
  const statements:D1PreparedStatement[]=[...newEntities]; const guardId=id();
  if(stored) {
   statements.push(operation==='delete'?db.prepare('DELETE FROM commerce_documents WHERE clinic_id=? AND id=? AND revision=?').bind(clinic,recordId,stored.revision):db.prepare('UPDATE commerce_documents SET body=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE clinic_id=? AND id=? AND revision=?').bind(JSON.stringify(after),clinic,recordId,stored.revision));
   statements.push(db.prepare('INSERT INTO commerce_guards(id,valid) VALUES(?,changes())').bind(guardId));
   statements.push(db.prepare('DELETE FROM commerce_guards WHERE id=?').bind(guardId));
  }else statements.push(db.prepare('INSERT INTO commerce_documents(id,clinic_id,kind,body) VALUES(?,?,?,?)').bind(recordId,clinic,kind,JSON.stringify(after)));
  for(const [medicineId,delta] of stockDelta(kind,before,after)) {
   statements.push(db.prepare('UPDATE medicines SET quantity=quantity+?,updated_at=CURRENT_TIMESTAMP WHERE clinic_id=? AND id=?').bind(delta,clinic,medicineId));
   statements.push(db.prepare('INSERT INTO commerce_guards(id,valid) VALUES(?,changes())').bind(guardId));
   statements.push(db.prepare('DELETE FROM commerce_guards WHERE id=?').bind(guardId));
   statements.push(db.prepare('INSERT INTO stock_movements(id,clinic_id,medicine_id,document_id,quantity,reason) VALUES(?,?,?,?,?,?)').bind(id(),clinic,medicineId,recordId,delta,`${kind}: ${operation}${after?` (${after.state})`:''}`));
  }
  if(kind==='invoices'&&after?.appointment_id){statements.push(db.prepare('UPDATE appointments SET payment_status=?,updated_at=CURRENT_TIMESTAMP WHERE clinic_id=? AND id=?').bind(after.state==='Finalized'?after.status:'Unpaid',clinic,String(after.appointment_id)));}
  statements.push(db.prepare('INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?,?,?)').bind(id(),clinic,user.userId,operation.toUpperCase(),kind,recordId,JSON.stringify({before,after})));
  await db.batch(statements);
  return Response.json({ok:true,id:recordId,record:after?{...after,revision:(stored?.revision||0)+1}:null});
 }catch(e){let message=e instanceof Error?e.message:'Unable to save record';if(message.includes('commerce_appointment_invoice')||message.includes('UNIQUE constraint failed: index'))message='An invoice already exists for this appointment. Open it from Clinical Invoices.';if(message.includes('CHECK constraint'))message='The record changed or stock is insufficient. Refresh and try again.';return Response.json({error:message},{status:400});}
}
