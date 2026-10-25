export type MedicineRow={name:string;strength:string;dose:string;frequency:string;duration:string;instructions:string};
export const blankMedicine=():MedicineRow=>({name:'',strength:'',dose:'',frequency:'',duration:'',instructions:''});
const fields=['name','strength','dose','frequency','duration','instructions'] as const;
export function parseMedicineRows(value:unknown):MedicineRow[]{
 let rows:unknown=value;if(typeof rows==='string'){try{rows=JSON.parse(rows||'[]')}catch{throw new Error('Invalid medicine rows')}}
 if(rows===undefined||rows===null)return [];if(!Array.isArray(rows)||rows.length>50)throw new Error('A prescription supports up to 50 medicine rows');
 const result:MedicineRow[]=[];for(const [i,raw] of rows.entries()){if(!raw||typeof raw!=='object')throw new Error('Invalid medicine row');const row=Object.fromEntries(fields.map(k=>[k,String((raw as Record<string,unknown>)[k]||'').trim()])) as MedicineRow;if(fields.some(k=>row[k].length>500))throw new Error(`Medicine row ${i+1} is too long`);if(!fields.some(k=>row[k]))continue;if(!row.name)throw new Error(`Enter a medicine name on row ${i+1}`);result.push(row);}return result;
}
export function formatMedicineRows(rows:MedicineRow[],notes=''){
 return [...rows.filter(r=>r.name.trim()).map((r,i)=>[`${i+1}. ${r.name}${r.strength?' ('+r.strength+')':''}`,[r.dose&&(/[\u0600-\u06ff]/.test(r.dose)?'مقدار: ':'Dose: ')+r.dose,r.frequency&&(/[\u0600-\u06ff]/.test(r.frequency)?'اوقات: ':'Frequency: ')+r.frequency,r.duration&&(/[\u0600-\u06ff]/.test(r.duration)?'مدت: ':'Duration: ')+r.duration].filter(Boolean).join(' · '),r.instructions].filter(Boolean).join('\n')),notes.trim()].filter(Boolean).join('\n\n');
}
