import type {CommerceRecord,Line} from './commerce';

export type BarcodeMedicine=CommerceRecord&{barcode?:string;batch?:string;name?:string;purchase_rate?:number;selling_price?:number;expiry?:string;minimum_stock?:number;generic_name?:string};
export type ScannedBarcode={code:string;gtin:string;batch:string;expiry:string;candidates:string[]};

const groupSeparator=String.fromCharCode(29);
const clean=(value:unknown)=>String(value||'').trim().toLowerCase();

export function barcodeDetails(raw:string):ScannedBarcode{
 const source=raw.trim().replace(/^\]C1/,'');
 const code=source.replaceAll(groupSeparator,'');
 const gtin=source.match(/^01(\d{14})/)?.[1]||'';
 const variableAis=gtin?source.slice(16):source;
 const expiry=variableAis.match(/(?:^|\x1d)17(\d{6})/)?.[1]||variableAis.match(/17(\d{6})$/)?.[1]||'';
 const batch=variableAis.match(/(?:^|\x1d)10([^\x1d]+)/)?.[1].replace(/17\d{6}$/,'')||'';
 const expiryDate=expiry?`20${expiry.slice(0,2)}-${expiry.slice(2,4)}-${expiry.slice(4,6)}`:'';
 return {code,gtin,batch:batch||code,expiry:expiryDate,candidates:[code,gtin,batch].map(clean).filter(Boolean)};
}

export function findBarcodeMedicine(medicines:BarcodeMedicine[],parsed:ScannedBarcode){
 return medicines.find(medicine=>[medicine.barcode,medicine.batch].map(clean).some(value=>value&&parsed.candidates.includes(value)));
}

export function scannedMedicineLine(medicine:BarcodeMedicine,kind:'purchases'|'sales',parsed:ScannedBarcode):Line{
 const name=String(medicine.name||'');
 return {medicine_id:String(medicine.id),medicine_name:name,description:name,quantity:1,
  price:Number(kind==='purchases'?medicine.purchase_rate:medicine.selling_price)||0,
  selling_price:Number(medicine.selling_price)||0,generic_name:String(medicine.generic_name||''),
  batch:String(medicine.batch||parsed.batch),expiry:String(medicine.expiry||parsed.expiry),minimum_stock:Number(medicine.minimum_stock??10)};
}

export function addScannedMedicine(items:Line[],medicine:BarcodeMedicine,kind:'purchases'|'sales',parsed:ScannedBarcode){
 const hydrated=scannedMedicineLine(medicine,kind,parsed),found=items.findIndex(item=>item.medicine_id===hydrated.medicine_id);
 if(found<0)return [...items,hydrated];
 return items.map((item,index)=>index===found?{...item,...hydrated,quantity:Number(item.quantity||0)+1}:item);
}
