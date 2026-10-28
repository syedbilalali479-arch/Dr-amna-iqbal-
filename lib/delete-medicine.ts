import {normalizeDocument,type CommerceRecord,type Line} from './commerce';

const clinic='skinuvia';
type Stored={id:string;kind:string;body:string;revision:number};

export async function deleteMedicineAndReverseHistory(db:D1Database,actor:string,medicineId:string){
 const medicine=await db.prepare('SELECT * FROM medicines WHERE clinic_id=? AND id=?').bind(clinic,medicineId).first<Record<string,unknown>>();
 if(!medicine)return {ok:true,id:medicineId,revertedDocuments:0};
 const linked=(await db.prepare("SELECT DISTINCT d.id,d.kind,d.body,d.revision FROM commerce_documents d,json_each(d.body,'$.items') item WHERE d.clinic_id=? AND json_extract(item.value,'$.medicine_id')=?").bind(clinic,medicineId).all<Stored>()).results;
 const statements:D1PreparedStatement[]=[];const removed:string[]=[];
 for(const document of linked){
  const before=JSON.parse(document.body) as CommerceRecord,items=(before.items||[]).filter((item:Line)=>item.medicine_id!==medicineId);
  if(!items.length){statements.push(db.prepare('DELETE FROM commerce_documents WHERE clinic_id=? AND id=? AND revision=?').bind(clinic,document.id,document.revision),db.prepare('DELETE FROM stock_movements WHERE clinic_id=? AND document_id=?').bind(clinic,document.id),db.prepare('DELETE FROM record_numbers WHERE clinic_id=? AND kind=? AND entity_id=?').bind(clinic,document.kind,document.id));removed.push(document.id);continue;}
  const subtotal=items.reduce((sum,item)=>sum+Number(item.quantity)*Number(item.price),0),discount=Math.min(Number(before.discount||0),subtotal),paid=Math.min(Number(before.paid||0),Math.max(0,subtotal-discount));
  const after=normalizeDocument(document.kind,{...before,items,discount,paid});
  statements.push(db.prepare('UPDATE commerce_documents SET body=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE clinic_id=? AND id=? AND revision=?').bind(JSON.stringify(after),clinic,document.id,document.revision));
 }
 statements.push(db.prepare('DELETE FROM stock_movements WHERE clinic_id=? AND medicine_id=?').bind(clinic,medicineId),db.prepare('DELETE FROM medicines WHERE clinic_id=? AND id=?').bind(clinic,medicineId),db.prepare("DELETE FROM record_numbers WHERE clinic_id=? AND kind='medicines' AND entity_id=?").bind(clinic,medicineId),db.prepare('INSERT INTO audit_logs(id,clinic_id,actor_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),clinic,actor,'DELETE_AND_REVERSE','medicines',medicineId,JSON.stringify({medicine,reverted_documents:linked.map(row=>row.id),removed_documents:removed})));
 await db.batch(statements);return {ok:true,id:medicineId,revertedDocuments:linked.length};
}
