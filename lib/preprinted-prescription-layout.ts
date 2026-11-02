import type {MedicineRow} from './prescription-medicines';

export const PREPRINTED_PAGE={width:1240,height:1754,left:345,right:1120,top:340,bottom:1515} as const;
export const PREPRINTED_COLUMNS=[
 {key:'frequency',label:'Frequency',x:345,width:190},
 {key:'dose',label:'Dose',x:535,width:165},
 {key:'duration',label:'Duration',x:700,width:140},
 {key:'instructions',label:'Directions',x:840,width:280},
] as const;
export type PreprintedColumnKey=(typeof PREPRINTED_COLUMNS)[number]['key'];
export type TextMeasure=(text:string,font:string)=>number;
export type PreprintedMedicineBlock={medicineIndex:number;continued:boolean;y:number;height:number;titleLines:string[];cells:Record<PreprintedColumnKey,string[]>;separatorAfter:boolean;separatorY?:number};
export type PreprintedPage={blocks:PreprintedMedicineBlock[]};

const digitMap:Record<string,string>={'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
export function englishDisplayDigits(value:unknown){return String(value??'').replace(/[٠-٩۰-۹]/g,d=>digitMap[d]);}

function estimatedMeasure(text:string,font:string){const size=Number(font.match(/(\d+)px/)?.[1]||24);return [...text].reduce((sum,char)=>sum+size*(/[\u0600-\u06ff]/.test(char)?.63:/[A-Z0-9]/.test(char)?.62:.5),0)}
export function wrapPreprintedText(value:unknown,maxWidth:number,font:string,measure:TextMeasure=estimatedMeasure){
 const paragraphs=englishDisplayDigits(value).split(/\r?\n/),result:string[]=[];
 for(const paragraph of paragraphs){
  const words=paragraph.trim().split(/\s+/).filter(Boolean);if(!words.length){result.push('');continue}
  let line='';
  for(const word of words){
   const candidate=line?`${line} ${word}`:word;
   if(line&&measure(candidate,font)>maxWidth){result.push(line);line=''}
   if(measure(word,font)<=maxWidth){line=line?`${line} ${word}`:word;continue}
   let piece='';for(const char of word){const next=piece+char;if(piece&&measure(next,font)>maxWidth){result.push(piece);piece=char}else piece=next}line=piece;
  }
  if(line)result.push(line);
 }
 return result.length?result:[''];
}

const TITLE_FONT='bold 34px "Noto Naskh Arabic", Arial';
const CELL_FONT='29px "Noto Naskh Arabic", Arial';
const TITLE_LINE=46,CELL_LINE=46,TABLE_HEADER=38,BLOCK_PADDING=34,SEPARATOR_SPACE=38;
function titleFor(row:MedicineRow,index:number,continued:boolean){const full=`${index+1}. ${row.name}${row.strength?` (${row.strength})`:''}`;return continued?`${full} — continued`:full}

export function planPreprintedLayout(rows:MedicineRow[],measure:TextMeasure=estimatedMeasure):PreprintedPage[]{
 const medicines=rows.filter(row=>row.name.trim()),pages:PreprintedPage[]=[{blocks:[]}];let page=pages[0],y=PREPRINTED_PAGE.top;
 const nextPage=()=>{page={blocks:[]};pages.push(page);y=PREPRINTED_PAGE.top};
 medicines.forEach((row,medicineIndex)=>{
  const allCells=Object.fromEntries(PREPRINTED_COLUMNS.map(column=>[column.key,wrapPreprintedText(row[column.key]||'—',column.width-24,CELL_FONT,measure)])) as Record<PreprintedColumnKey,string[]>;
  const totalCellLines=Math.max(1,...Object.values(allCells).map(lines=>lines.length));let offset=0,continued=false;
  while(offset<totalCellLines){
   const titleLines=wrapPreprintedText(titleFor(row,medicineIndex,continued),PREPRINTED_PAGE.right-PREPRINTED_PAGE.left-20,TITLE_FONT,measure);
   const base=BLOCK_PADDING+titleLines.length*TITLE_LINE+TABLE_HEADER;let available=PREPRINTED_PAGE.bottom-y;
   if(available<base+CELL_LINE+20){nextPage();available=PREPRINTED_PAGE.bottom-y}
   if(base+CELL_LINE+20>available)throw new Error(`Medicine ${medicineIndex+1} name is too long for the preprinted page`);
   let capacity=Math.max(1,Math.floor((available-base-20)/CELL_LINE));let take=Math.min(capacity,totalCellLines-offset);
   let finalSegment=offset+take>=totalCellLines,separatorAfter=finalSegment&&medicineIndex<medicines.length-1;
   if(separatorAfter&&base+take*CELL_LINE+20+SEPARATOR_SPACE>available){
    if(take>1)take--;else{nextPage();available=PREPRINTED_PAGE.bottom-y;capacity=Math.max(1,Math.floor((available-base-20-SEPARATOR_SPACE)/CELL_LINE));take=Math.min(capacity,totalCellLines-offset)}
    finalSegment=offset+take>=totalCellLines;separatorAfter=finalSegment&&medicineIndex<medicines.length-1;
   }
   const height=base+take*CELL_LINE+20,cells=Object.fromEntries(PREPRINTED_COLUMNS.map(column=>[column.key,allCells[column.key].slice(offset,offset+take)])) as Record<PreprintedColumnKey,string[]>;
   const block:PreprintedMedicineBlock={medicineIndex,continued,y,height,titleLines,cells,separatorAfter};
   if(separatorAfter)block.separatorY=y+height+12;
   page.blocks.push(block);y+=height+(separatorAfter?SEPARATOR_SPACE:12);offset+=take;continued=true;
   if(offset<totalCellLines)nextPage();
  }
 });
 return pages;
}
