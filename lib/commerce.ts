export type Line = {medicine_id?:string;medicine_name?:string;batch?:string;expiry?:string;generic_name?:string;selling_price?:number;minimum_stock?:number; description:string; quantity:number; price:number};
export type CommerceRecord = Record<string, unknown> & {id?:string; revision?:number; items?:Line[]};
export const commerceKinds = ['vendors','purchases','sales','vendor_payments','invoices'] as const;
export function amount(value:unknown, label:string) {
 const n=Number(value ?? 0); if(!Number.isFinite(n)||n<0||n>1e10)throw new Error(`${label} must be a valid non-negative amount`);
 return Math.round(n*100)/100;
}
export function normalizeDocument(kind:string, input:CommerceRecord):CommerceRecord {
 const r={...input};
 if(kind==='vendors') {
  if(!String(r.name||'').trim())throw new Error('Vendor name is required');
  r.opening_balance=amount(r.opening_balance,'Opening balance');
  if(!['Payable','Advance credit'].includes(String(r.balance_type)))throw new Error('Select an opening balance type');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(r.opening_date||'')))throw new Error('Opening balance date is required');
 } else if(kind==='vendor_payments') {
  if(!r.vendor_id&&!r.vendor_name)throw new Error('Select or enter a vendor');
  r.amount=amount(r.amount,'Payment'); if(!r.amount)throw new Error('Payment must be greater than zero');
 } else {
  if(!['Draft','Finalized','Voided'].includes(String(r.state)))throw new Error('Select a document state');
  if(kind==='purchases'&&!r.vendor_id&&!r.vendor_name)throw new Error('Select or enter a vendor');
  if(kind!=='purchases'&&!String(r.patient_name||'').trim())throw new Error('Select or enter a patient name');
  if(!Array.isArray(r.items)||!r.items.length)throw new Error('Add at least one item');
  if(r.items.length>100)throw new Error('Maximum 100 items per document');
  r.items=r.items.map(l=>{
   const quantity=Number(l.quantity); if(!Number.isInteger(quantity)||quantity<=0)throw new Error('Item quantities must be positive whole numbers');
   if(kind==='sales'&&!l.medicine_id)throw new Error('Choose an existing medicine batch to sell. New batches can be added through purchases.');
   if(kind==='purchases'&&!l.medicine_id&&(!l.medicine_name||!l.batch||!/^\d{4}-\d{2}-\d{2}$/.test(String(l.expiry))))throw new Error('Enter a name, batch number and expiry for the new medicine');
   if(!String(l.description||'').trim())throw new Error('Every item needs a description');
   return {...l,quantity,price:amount(l.price,'Unit price')};
  });
  r.total=Math.round(r.items.reduce((n,l)=>n+l.quantity*l.price,0)*100)/100;
  r.discount=amount(r.discount,'Discount'); if(Number(r.discount)>Number(r.total))throw new Error('Discount cannot exceed the subtotal');
  r.net=Math.round((Number(r.total)-Number(r.discount))*100)/100;
  r.paid=amount(r.paid,'Amount paid'); if(Number(r.paid)>Number(r.net))throw new Error('Amount paid cannot exceed the total');
  r.balance=Math.round((Number(r.net)-Number(r.paid))*100)/100;
  if(r.state==='Voided')r.balance=0;
  r.status=r.state==='Voided'?'Voided':Number(r.balance)===0?'Paid':Number(r.paid)>0?'Partially Paid':'Unpaid';
 }
 if(kind!=='vendors'&&!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date||'')))throw new Error('A document date is required');
 return r;
}
export function stockEffect(kind:string,r:CommerceRecord|null) {
 const result=new Map<string,number>();
 if(!r||r.state!=='Finalized'||!['purchases','sales'].includes(kind))return result;
 for(const line of r.items||[]) {const id=String(line.medicine_id);result.set(id,(result.get(id)||0)+line.quantity*(kind==='sales'?-1:1));}
 return result;
}
export function stockDelta(kind:string,before:CommerceRecord|null,after:CommerceRecord|null) {
 const old=stockEffect(kind,before), next=stockEffect(kind,after);
 return new Map([...new Set([...old.keys(),...next.keys()])].map(id=>[id,(next.get(id)||0)-(old.get(id)||0)]).filter(([,n])=>n!==0) as [string,number][]);
}
export function vendorBalance(vendor:CommerceRecord,purchases:CommerceRecord[],payments:CommerceRecord[]) {
 return Math.round((Number(vendor.opening_balance||0)*(vendor.balance_type==='Advance credit'?-1:1)+purchases.filter(p=>p.vendor_id===vendor.id&&p.state==='Finalized').reduce((n,p)=>n+Number(p.net||0)-Number(p.paid||0),0)-payments.filter(p=>p.vendor_id===vendor.id).reduce((n,p)=>n+Number(p.amount||0),0))*100)/100;
}
