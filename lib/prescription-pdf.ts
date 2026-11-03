import {clinicProfile} from './clinic-profile';
import QRCode from 'qrcode';
import {parseMedicineRows,type MedicineRow} from './prescription-medicines';
import {englishDisplayDigits,planPreprintedLayout,PREPRINTED_COLUMNS,PREPRINTED_PAGE} from './preprinted-prescription-layout';
export type Stroke={points:{x:number;y:number}[]};
export type PrescriptionPdfMode='digital'|'preprinted';
export type Prescription=Record<string,unknown>&{id?:string;patient_name?:string;patient_id?:string;patient_age?:string;phone?:string;prescription_date?:string;doctor?:string;diagnosis?:string;medicines?:string;medicine_items?:unknown;medicine_notes?:string;instructions?:string;handwriting?:string;status?:string;version?:number};
export const wing='M0 0 C-35 -90 -150 -135 -135 -75 C-130 -45 -100 -20 -120 0 C-80 10 -75 45 -105 65 C-130 85 -135 115 -135 140 C-65 120 -5 70 0 0 Z';
export function parseStrokes(raw:unknown):Stroke[]{try{const s=JSON.parse(String(raw||'[]'));return Array.isArray(s)?s.filter(x=>Array.isArray(x.points)&&x.points.every((p:{x:number;y:number})=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)):[]}catch{return []}}
function butterfly(ctx:CanvasRenderingContext2D,x:number,y:number,scale:number,opacity=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.globalAlpha=opacity;ctx.fillStyle='#00a9d6';ctx.fill(new Path2D(wing));ctx.scale(-1,1);ctx.fillStyle='#3d3c3b';ctx.fill(new Path2D(wing));ctx.restore();}
function lines(ctx:CanvasRenderingContext2D,text:string,width:number){const out:string[]=[];for(const paragraph of text.split('\n')){let current='';for(const word of paragraph.split(/\s+/)){const candidate=current?current+' '+word:word;if(ctx.measureText(candidate).width>width&&current){out.push(current);current=word}else current=candidate;}out.push(current)}return out;}
function drawLine(ctx:CanvasRenderingContext2D,text:string,left:number,right:number,y:number){ctx.save();const rtl=/[\u0600-\u06ff]/.test(text);ctx.direction=rtl?'rtl':'ltr';ctx.textAlign=rtl?'right':'left';ctx.fillText(text,rtl?right:left,y);ctx.restore();}
type PrintMedicine={name:string;strength:string;dose:string;frequency:string;duration:string;instructions:string};
function medicineRows(value:unknown):PrintMedicine[]{try{const data=typeof value==='string'?JSON.parse(value):value;return Array.isArray(data)?data.filter((m:PrintMedicine)=>m&&m.name?.trim()):[]}catch{return []}}
function urduAmount(value:string){let v=value.trim();v=v.replace(/\b(tsp|ts|teaspoons?|tea spoons?)\b/gi,'چائے کا چمچ').replace(/\b(tbsp|tablespoons?)\b/gi,'کھانے کا چمچ').replace(/\b(tablets?|tabs?)\b/gi,'گولی').replace(/\b(capsules?|caps?)\b/gi,'کیپسول').replace(/\b(drops?)\b/gi,'قطرے').replace(/\b(ml)\b/gi,'ملی لیٹر');return v.replace(/\b\d+\b/g,n=>n.replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]));}
function urduFrequency(value:string){const v=value.trim().toLowerCase().replace(/[-_]/g,' ').replace(/\s+/g,' ');const map:Record<string,string>={'once daily':'روزانہ ایک بار','twice daily':'روزانہ دو بار','thrice daily':'روزانہ تین بار','three times daily':'روزانہ تین بار','four times daily':'روزانہ چار بار','daily':'روزانہ','once a day':'روزانہ ایک بار','twice a day':'روزانہ دو بار','morning':'صبح','night':'رات کو','at night':'رات کو','morning and night':'صبح اور رات','morning and afternoon':'صبح دوپہر','morning and evening':'صبح شام','every other day':'ایک دن چھوڑ کر','weekly':'ہفتے میں ایک بار','once weekly':'ہفتے میں ایک بار','twice weekly':'ہفتے میں دو بار','as needed':'ضرورت کے مطابق','after meals':'کھانے کے بعد','before meals':'کھانے سے پہلے'};return map[v]||value;}
function urduDuration(value:string){return urduAmount(value).replace(/\b(months?)\b/gi,'ماہ').replace(/\b(years?)\b/gi,'سال').replace(/\b(weeks?)\b/gi,'ہفتے').replace(/\b(days?)\b/gi,'دن').replace(/\b(hours?)\b/gi,'گھنٹے');}
function urduDirections(value:string){const v=value.trim().toLowerCase();const map:Record<string,string>={'apply on wet hairs':'گیلے بالوں پر استعمال کریں','apply on wet hair':'گیلے بالوں پر استعمال کریں','apply to affected area':'متاثرہ جگہ پر لگائیں','take after food':'کھانے کے بعد استعمال کریں','take after meals':'کھانے کے بعد استعمال کریں','take before meals':'کھانے سے پہلے استعمال کریں','use as directed':'ڈاکٹر کی ہدایت کے مطابق استعمال کریں'};return map[v]||value;}
// Translate only recognized prescription choices. Unknown free text is preserved
// verbatim rather than guessing medical instructions or altering numeric strength.
const urduChoiceMap:Record<string,string>={
 'cream':'کریم','gel':'جیل','ointment':'مرہم','lotion':'لوشن','solution':'محلول','shampoo':'شیمپو','tablet':'گولی','capsule':'کیپسول','syrup':'شربت','drops':'قطرے','spray':'اسپرے',
 '1 tablet':'۱ گولی','2 tablets':'۲ گولیاں','½ tablet':'آدھی گولی','1 capsule':'۱ کیپسول','2 capsules':'۲ کیپسول','5 ml':'۵ ملی لیٹر','10 ml':'۱۰ ملی لیٹر','1 teaspoon':'۱ چائے کا چمچ','2 teaspoons':'۲ چائے کے چمچ','1 tablespoon':'۱ کھانے کا چمچ','1 drop':'۱ قطرہ','2 drops':'۲ قطرے','2 sprays':'۲ اسپرے','thin layer':'باریک تہہ','pea-sized amount':'مٹر کے دانے جتنی مقدار','as prescribed':'ڈاکٹر کی ہدایت کے مطابق',
 'once daily':'روزانہ ایک بار','twice daily':'روزانہ دو بار','three times daily':'روزانہ تین بار','four times daily':'روزانہ چار بار','every other day':'ایک دن چھوڑ کر','once weekly':'ہفتے میں ایک بار','twice weekly':'ہفتے میں دو بار','every morning':'ہر صبح','at night':'رات کو','morning and night':'صبح اور رات','every 6 hours':'ہر ۶ گھنٹے بعد','every 8 hours':'ہر ۸ گھنٹے بعد','every 12 hours':'ہر ۱۲ گھنٹے بعد','before meals':'کھانے سے پہلے','after meals':'کھانے کے بعد','as needed':'ضرورت کے مطابق','as directed':'ڈاکٹر کی ہدایت کے مطابق',
 '1 day':'۱ دن','3 days':'۳ دن','5 days':'۵ دن','7 days':'۷ دن','10 days':'۱۰ دن','14 days':'۱۴ دن','2 weeks':'۲ ہفتے','3 weeks':'۳ ہفتے','4 weeks':'۴ ہفتے','1 month':'۱ ماہ','2 months':'۲ ماہ','3 months':'۳ ماہ','6 months':'۶ ماہ','until review':'دوبارہ معائنے تک',
 'apply to affected area':'متاثرہ جگہ پر لگائیں','apply a thin layer':'باریک تہہ لگائیں','apply at night':'رات کو لگائیں','apply in the morning':'صبح لگائیں','apply on wet hair':'گیلے بالوں پر لگائیں','wash off after use':'استعمال کے بعد دھو لیں','take after meals':'کھانے کے بعد لیں','take before meals':'کھانے سے پہلے لیں','take with water':'پانی کے ساتھ لیں','avoid contact with eyes':'آنکھوں سے بچائیں','use as directed':'ڈاکٹر کی ہدایت کے مطابق استعمال کریں'
};
function asciiDigits(value:string){return value.replace(/[۰-۹٠-٩]/g,c=>{const n='۰۱۲۳۴۵۶۷۸۹'.indexOf(c);return String(n>=0?n:'٠١٢٣٤٥٦٧٨٩'.indexOf(c));});}
function urduChoice(value:string){const normalized=asciiDigits(value.trim());const key=normalized.toLowerCase();return asciiDigits(urduChoiceMap[key]||normalized);}
function urduStrength(value:string){return asciiDigits(urduChoice(value));}
function printMedicineLines(r:Prescription):string[]{
 const rows=medicineRows(r.medicine_items);if(!rows.length)return linesFromLegacy(String(r.medicines||''));
 const out:string[]=[];for(const [i,m] of rows.entries()){out.push((i+1)+'. '+m.name+(m.strength?' ('+urduStrength(m.strength)+')':''));if(m.frequency)out.push(urduChoice(m.frequency));if(m.dose)out.push(urduChoice(m.dose));if(m.duration)out.push(urduChoice(m.duration));if(m.instructions)out.push(urduChoice(m.instructions));out.push('');}
 const notes=String(r.medicine_notes||'').trim();if(notes)out.push(...notes.split('\n'));return out;
}
function linesFromLegacy(text:string){return text.split('\n');}
function drawPreprintedMedicines(ctx:CanvasRenderingContext2D,r:Prescription){
 const meds=medicineRows(r.medicine_items);
 const notes=String(r.medicine_notes||'').trim();
 const advice=String(r.instructions||'').trim();
 const legacy=meds.length?[]:linesFromLegacy(String(r.medicines||'')).filter(Boolean);
 const startY=340, bottomY=1515, leftX=345, rightX=1120, available=bottomY-startY;
 // Measure actual wrapped text at each candidate font size. Never clip or spill onto another page.
 for(const fontSize of [35,32,29,27,25,23,21,19]){
  const nameFont='bold '+fontSize+'px Arial';
  const detailFont=fontSize+'px "Noto Naskh Arabic", Arial';
  const lineHeight=Math.ceil(fontSize*1.75);
  const padding=Math.ceil(fontSize*.85);
  const blocks:{name:string[];details:string[];directions:string[]}[]=[];
  let total=0;
  for(const m of meds){
   ctx.font=nameFont;
   const name=lines(ctx,(blocks.length+1)+'. '+m.name+(m.strength?' ('+urduStrength(m.strength)+')':''),rightX-leftX-12);
   ctx.font=detailFont;
   const details=[m.frequency?urduChoice(m.frequency):'',m.dose?urduChoice(m.dose):'',m.duration?urduChoice(m.duration):''];
   const directions=m.instructions?lines(ctx,urduChoice(m.instructions),rightX-leftX-12):[];
   blocks.push({name,details,directions});
   total+=(name.length+(details.some(Boolean)?1:0)+directions.length)*lineHeight+padding*2;
  }
  ctx.font=detailFont;
  const extra=notes?lines(ctx,asciiDigits(notes),rightX-leftX-12):legacy.flatMap(t=>lines(ctx,asciiDigits(t),rightX-leftX-12));
  total+=extra.length*lineHeight+(extra.length?padding:0);
  ctx.font=fontSize+'px Arial';
  const adviceLines=advice?lines(ctx,advice,rightX-leftX-12):[];
  total+=adviceLines.length*lineHeight+(adviceLines.length?lineHeight+padding*2:0);
  if(total>available)continue;
  let y=startY;
  ctx.fillStyle='#242424';ctx.strokeStyle='#a5a5a5';ctx.lineWidth=1;
  for(const [blockIndex,block] of blocks.entries()){
   ctx.font=nameFont;
   for(const nameLine of block.name){y+=lineHeight;drawLine(ctx,nameLine,leftX,rightX,y);}
   if(block.details.some(Boolean)){
    y+=lineHeight;ctx.font=detailFont;
    // Three evenly spaced Urdu values: frequency, dose, duration, without headings.
    const xs=[leftX+135,leftX+390,rightX-100];
    for(let i=0;i<block.details.length;i++){
     const detail=block.details[i];if(!detail)continue;const column=i;
     ctx.save();ctx.direction=/[\u0600-\u06ff]/.test(detail)?'rtl':'ltr';ctx.textAlign='center';
     ctx.fillText(detail,xs[column],y, column===0?240:column===1?245:185);ctx.restore();
    }
   }
   ctx.font=detailFont;
   for(const direction of block.directions){y+=lineHeight;drawLine(ctx,direction,leftX+20,rightX,y);}
   y+=padding;
   // Separate medicines on both preprinted and digital PDFs, but do not
   // draw an extra divider after the final medicine.
   if(blockIndex<blocks.length-1){ctx.save();ctx.strokeStyle='#555555';ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(leftX,y);ctx.lineTo(rightX,y);ctx.stroke();ctx.restore();}
   y+=padding;
  }
  ctx.font=detailFont;
  for(const extraLine of extra){y+=lineHeight;drawLine(ctx,extraLine,leftX,rightX,y);}
  if(extra.length)y+=padding;
  if(adviceLines.length){
   y+=lineHeight;ctx.font='bold '+fontSize+'px Arial';ctx.fillText('Advice / Instructions:',leftX,y);
   ctx.font=fontSize+'px Arial';
   for(const line of adviceLines){y+=lineHeight;drawLine(ctx,line,leftX+12,rightX,y);}
  }
  return;
 }
 throw new Error('Too much prescription text for one A4 sheet. Please shorten medicine directions or advice.');
}


function printableDate(value:unknown){const raw=String(value||'');return /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw.split('-').reverse().join('/'):raw}
function structuredRows(r:Prescription):MedicineRow[]{const rows=parseMedicineRows(r.medicine_items);if(rows.length)return rows;const legacy=String(r.medicines||'').trim();return legacy?[{name:legacy,strength:'',frequency:'',dose:'',duration:'',instructions:''}]:[]}
export async function renderPreprintedPrescriptionImages(r:Prescription){
 await document.fonts.load('29px "Noto Naskh Arabic"');await document.fonts.load('bold 34px "Noto Naskh Arabic"');await document.fonts.ready;
 const measuringCanvas=document.createElement('canvas'),measuringContext=measuringCanvas.getContext('2d');if(!measuringContext)throw new Error('This browser cannot create a prescription PDF');
 const pages=planPreprintedLayout(structuredRows(r),(text,font)=>{measuringContext.font=font;return measuringContext.measureText(text).width},String(r.instructions||''));measuringContext.font='25px "Noto Naskh Arabic", Arial';const clinicalLines=lines(measuringContext,String(r.diagnosis||''),210),clinicalPerPage=32;while(pages.length<Math.max(1,Math.ceil(clinicalLines.length/clinicalPerPage)))pages.push({blocks:[],advice:[]});if(pages.length>12)throw new Error('Prescription is too long. Reduce the clinical notes, medicine directions or advice before exporting.');
 const images:Uint8Array[]=[];
 for(const [pageIndex,page] of pages.entries()){
  const canvas=document.createElement('canvas');canvas.width=PREPRINTED_PAGE.width;canvas.height=PREPRINTED_PAGE.height;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('This browser cannot create a prescription PDF');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#242424';ctx.font='bold 26px Arial';
  ctx.fillText(englishDisplayDigits(r.patient_name||''),190,268);ctx.fillText(englishDisplayDigits(r.patient_age||''),845,268);ctx.fillText(englishDisplayDigits(printableDate(r.prescription_date)),1040,268);
  ctx.font='25px "Noto Naskh Arabic", Arial';const pageClinicalLines=clinicalLines.slice(pageIndex*clinicalPerPage,(pageIndex+1)*clinicalPerPage);for(let index=0;index<pageClinicalLines.length;index++)drawLine(ctx,pageClinicalLines[index],65,275,365+index*35);
  for(const block of page.blocks){
   let titleY=block.y+39;ctx.fillStyle='#111';ctx.font='bold 34px "Noto Naskh Arabic", Arial';for(const title of block.titleLines){drawLine(ctx,title,PREPRINTED_PAGE.left,PREPRINTED_PAGE.right,titleY);titleY+=46}
   const detailTop=block.y+28+block.titleLines.length*46;
   ctx.font='29px "Noto Naskh Arabic", Arial';ctx.fillStyle='#111';for(const column of PREPRINTED_COLUMNS){block.cells[column.key].forEach((line,index)=>{const baseline=detailTop+38+index*46,rtl=/[\u0600-\u06ff]/.test(line);ctx.save();ctx.direction=rtl?'rtl':'ltr';ctx.textAlign=rtl?'right':'left';ctx.fillText(line,rtl?column.x+column.width-8:column.x+4,baseline);ctx.restore()})}
   if(block.separatorAfter){ctx.strokeStyle='#252525';ctx.lineWidth=block.finalSeparator?3.4:2.8;ctx.beginPath();ctx.moveTo(PREPRINTED_PAGE.left,block.separatorY);ctx.lineTo(PREPRINTED_PAGE.right,block.separatorY);ctx.stroke()}
  }
  for(const advice of page.advice){ctx.fillStyle='#171717';ctx.font='bold 28px Arial';ctx.textAlign='left';ctx.fillText(advice.heading,PREPRINTED_PAGE.left,advice.y+30);ctx.font='27px "Noto Naskh Arabic", Arial';advice.lines.forEach((line,index)=>drawLine(ctx,line,PREPRINTED_PAGE.left,PREPRINTED_PAGE.right,advice.y+74+index*40))}
  const binary=atob(canvas.toDataURL('image/jpeg',.98).split(',')[1]);images.push(Uint8Array.from(binary,c=>c.charCodeAt(0)));
 }
 return images;
}
async function preprintedPrescriptionFile(r:Prescription){const images=await renderPreprintedPrescriptionImages(r),pdf=jpegPagesPdf(images,PREPRINTED_PAGE.width,PREPRINTED_PAGE.height);return new File([pdf.buffer as ArrayBuffer],`Skinuvia-preprinted-${String(r.number||'prescription').replace(/[^\w-]/g,'')}.pdf`,{type:'application/pdf'});}
export async function prescriptionFile(r:Prescription,mode:PrescriptionPdfMode='digital'){
 if(mode==='preprinted')return preprintedPrescriptionFile(r);
 const preprinted=false;await Promise.all([document.fonts.load('23px "Noto Naskh Arabic"'),document.fonts.load('27px "Noto Naskh Arabic"')]);await document.fonts.ready;const canvas=document.createElement('canvas');canvas.width=1240;canvas.height=1754;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('This browser cannot create a prescription PDF');
 const qrImage=async(value:string)=>{const image=new Image();image.src=await QRCode.toDataURL(value,{margin:1,width:120,color:{dark:'#222222',light:'#ffffff'}});await image.decode();return image};
 const [facebookQr,instagramQr]=preprinted?[null,null]:await Promise.all([qrImage('https://www.facebook.com/skinuvia'),qrImage('https://www.instagram.com/skinuvia')]);
 ctx.font='23px "Noto Naskh Arabic", Arial';const left=lines(ctx,['Clinical notes',r.diagnosis||''].join('\n\n'),190),right=lines(ctx,['Rx',r.medicines||'',r.instructions?'Advice / instructions\n'+r.instructions:''].join('\n\n'),770);const perPage=36,structured=medicineRows(r.medicine_items).length>0,medicineLines=preprinted?printMedicineLines(r):lines(ctx,String(r.medicines||''),770),adviceLines=lines(ctx,String(r.instructions||''),770),pages=(preprinted||structured)?1:Math.max(1,Math.ceil(left.length/perPage),Math.ceil(right.length/perPage)),images:Uint8Array[]=[];
 if(pages>8)throw new Error('Prescription is too long. Shorten the notes before exporting.');
 for(let page=0;page<pages;page++){
  ctx.fillStyle='#fff';ctx.fillRect(0,0,1240,1754);if(!preprinted){ctx.fillStyle='#242424';ctx.font='bold 49px Georgia';ctx.fillText(clinicProfile.doctor,95,100);ctx.font='bold 24px Georgia';ctx.fillText(clinicProfile.qualifications,125,138);ctx.font='bold 24px Georgia';ctx.fillText(clinicProfile.designation,95,172);
  ctx.save();ctx.direction='rtl';ctx.textAlign='right';ctx.font='bold 51px "Noto Naskh Arabic", serif';ctx.fillText(clinicProfile.urduName,1150,105);ctx.font='21px "Noto Naskh Arabic", serif';ctx.fillText(clinicProfile.urduQualifications,1150,140);ctx.fillText(clinicProfile.urduDesignation,1150,171);ctx.restore();}
  const rawDate=String(r.prescription_date||''),displayDate=/^\d{4}-\d{2}-\d{2}$/.test(rawDate)?rawDate.split('-').reverse().join('/'):rawDate;
  if(preprinted){ctx.font='bold 26px Arial';ctx.fillStyle='#242424';ctx.fillText(String(r.patient_name||''),190,268);ctx.fillText(String(r.patient_age||''),845,268);ctx.fillText(displayDate,1040,268);}else{ctx.font='23px Georgia';ctx.fillText('Name: '+String(r.patient_name||''),95,238);ctx.fillText('MR No: '+String(r.patient_number||'—'),625,238);ctx.fillText('Age: '+String(r.patient_age||'—'),825,238);ctx.fillText('Date: '+displayDate,965,238);ctx.strokeStyle='#555';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(95,255);ctx.lineTo(1150,255);ctx.moveTo(320,255);ctx.lineTo(320,1585);ctx.stroke();}
  if(preprinted){ctx.fillStyle='#242424';ctx.font='25px Arial';for(let i=0;i<34;i++){const note=left[i];if(note&&i!==0)drawLine(ctx,note,105,295,330+i*35);}drawPreprintedMedicines(ctx,r);}else{butterfly(ctx,750,970,1.5,.12);ctx.fillStyle='#153b57';ctx.font='23px Arial';const start=page*perPage;for(let i=0;i<perPage;i++){if(left[start+i])drawLine(ctx,left[start+i],105,295,303+i*34);if(!structured&&right[start+i])drawLine(ctx,right[start+i],345,1120,303+i*34);}}
  if(!preprinted&&structured)drawPreprintedMedicines(ctx,r);
  if(page===0){ctx.strokeStyle='#153b57';ctx.lineWidth=2.6;ctx.lineCap='round';ctx.lineJoin='round';for(const stroke of parseStrokes(r.handwriting)){ctx.beginPath();stroke.points.forEach((p,i)=>{const x=95+p.x*1055,y=270+p.y*1300;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();if(stroke.points.length===1){const p=stroke.points[0];ctx.beginPath();ctx.arc(95+p.x*1055,270+p.y*1300,1.3,0,Math.PI*2);ctx.fill();}}}
  if(!preprinted){ctx.strokeStyle='#555';ctx.beginPath();ctx.moveTo(95,1595);ctx.lineTo(1150,1595);ctx.stroke();butterfly(ctx,120,1650,.23);ctx.fillStyle='#00a9d6';ctx.font='bold 40px Arial';ctx.fillText('SKINUVIA',165,1645);ctx.fillStyle='#222';ctx.font='bold 19px Arial';ctx.fillText('THE SKIN CLINIC',168,1673);if(facebookQr&&instagramQr){ctx.drawImage(facebookQr,325,1610,72,72);ctx.drawImage(instagramQr,410,1610,72,72);}ctx.font='11px Arial';ctx.fillText('Facebook',330,1697);ctx.fillText('Instagram',412,1697);ctx.textAlign='right';ctx.font='bold 19px Georgia';ctx.fillText(`For Appointment Call: ${clinicProfile.phone} · Ph: ${clinicProfile.landline}`,1150,1627);ctx.fillText('Timing: '+clinicProfile.hours,1150,1660);ctx.fillText(clinicProfile.address,1150,1693);ctx.textAlign='left';ctx.font='15px Arial';ctx.fillText('Not valid for any court of law',515,1720);ctx.fillText(`${String(r.number||'Prescription')}${r.patient_number?' · '+String(r.patient_number):''} · v${Number(r.version||1)} · ${page+1}/${pages}`,95,1720);}
  if(!preprinted&&r.status!=='Approved'){ctx.save();ctx.translate(670,800);ctx.rotate(-.35);ctx.globalAlpha=.14;ctx.font='bold 95px Arial';ctx.fillText(String(r.status||'Draft').toUpperCase(),-240,0);ctx.restore();}
  const binary=atob(canvas.toDataURL('image/jpeg',.94).split(',')[1]);images.push(Uint8Array.from(binary,c=>c.charCodeAt(0)));
 }
 const pdf=jpegPagesPdf(images,1240,1754);return new File([pdf.buffer as ArrayBuffer],`Skinuvia-${preprinted?'preprinted-':''}${String(r.number||'prescription').replace(/[^\w-]/g,'')}.pdf`,{type:'application/pdf'});
}
export function jpegPagesPdf(images:Uint8Array[],width:number,height:number){
 const chunks:Uint8Array[]=[],offsets=[0];let length=0;const encoder=new TextEncoder();const add=(v:string|Uint8Array)=>{const b=typeof v==='string'?encoder.encode(v):v;chunks.push(b);length+=b.length};const object=(id:number,parts:(string|Uint8Array)[])=>{offsets[id]=length;add(`${id} 0 obj\n`);parts.forEach(add);add('\nendobj\n')};
 add('%PDF-1.4\n');object(1,['<< /Type /Catalog /Pages 2 0 R >>']);object(2,[`<< /Type /Pages /Count ${images.length} /Kids [${images.map((_,i)=>(3+i*3)+' 0 R').join(' ')}] >>`]);
 images.forEach((jpeg,i)=>{const page=3+i*3,image=page+1,content=page+2;object(page,[`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>`]);object(image,[`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,jpeg,'\nendstream']);const draw='q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';object(content,[`<< /Length ${encoder.encode(draw).length} >>\nstream\n${draw}endstream`]);});
 const start=length;add(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);for(let i=1;i<offsets.length;i++)add(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);add(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`);const result=new Uint8Array(length);let cursor=0;for(const chunk of chunks){result.set(chunk,cursor);cursor+=chunk.length}return result;
}
export function downloadPrescription(file:File){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
