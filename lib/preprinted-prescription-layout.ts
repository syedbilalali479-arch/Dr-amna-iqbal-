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
export type PreprintedMedicineBlock={medicineIndex:number;continued:boolean;y:number;height:number;titleLines:string[];cells:Record<PreprintedColumnKey,string[]>;separatorAfter:boolean;finalSeparator:boolean;separatorY:number};
export type PreprintedAdviceBlock={y:number;heading:string;lines:string[]};
export type PreprintedPage={blocks:PreprintedMedicineBlock[];advice:PreprintedAdviceBlock[]};

const digitMap:Record<string,string>={'\u0660':'0','\u0661':'1','\u0662':'2','\u0663':'3','\u0664':'4','\u0665':'5','\u0666':'6','\u0667':'7','\u0668':'8','\u0669':'9','\u06F0':'0','\u06F1':'1','\u06F2':'2','\u06F3':'3','\u06F4':'4','\u06F5':'5','\u06F6':'6','\u06F7':'7','\u06F8':'8','\u06F9':'9'};
export function englishDisplayDigits(value:unknown){return String(value??'').replace(/[\u0660-\u0669\u06F0-\u06F9]/g,d=>digitMap[d]);}

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
const ADVICE_FONT='27px "Noto Naskh Arabic", Arial';
const TITLE_LINE=46,CELL_LINE=46,DETAIL_GAP=12,BLOCK_PADDING=28,SEPARATOR_SPACE=38,ADVICE_HEADING=44,ADVICE_LINE=40;
function titleFor(row:MedicineRow,index:number,continued:boolean){const full=`${index+1}. ${row.name}${row.strength?` (${row.strength})`:''}`;return continued?`${full} \u2014 continued`:full}

export function planPreprintedLayout(rows:MedicineRow[],measure:TextMeasure=estimatedMeasure,advice=''):PreprintedPage[]{
 const medicines=rows.filter(row=>row.name.trim()),adviceText=englishDisplayDigits(advice).trim(),pages:PreprintedPage[]=[{blocks:[],advice:[]}];let page=pages[0],y=PREPRINTED_PAGE.top;
 const nextPage=()=>{page={blocks:[],advice:[]};pages.push(page);y=PREPRINTED_PAGE.top};
 medicines.forEach((row,medicineIndex)=>{
  const allCells=Object.fromEntries(PREPRINTED_COLUMNS.map(column=>[column.key,wrapPreprintedText(row[column.key]||'\u2014',column.width-18,CELL_FONT,measure)])) as Record<PreprintedColumnKey,string[]>;
  const totalCellLines=Math.max(1,...Object.values(allCells).map(cellLines=>cellLines.length));let offset=0,continued=false;
  while(offset<totalCellLines){
   const titleLines=wrapPreprintedText(titleFor(row,medicineIndex,continued),PREPRINTED_PAGE.right-PREPRINTED_PAGE.left,TITLE_FONT,measure),base=BLOCK_PADDING+titleLines.length*TITLE_LINE+DETAIL_GAP;let available=PREPRINTED_PAGE.bottom-y;
   if(available<base+CELL_LINE+20+SEPARATOR_SPACE){nextPage();available=PREPRINTED_PAGE.bottom-y}
   if(base+CELL_LINE+20+SEPARATOR_SPACE>available)throw new Error(`Medicine ${medicineIndex+1} name is too long for the preprinted page`);
   let capacity=Math.max(1,Math.floor((available-base-20-SEPARATOR_SPACE)/CELL_LINE)),take=Math.min(capacity,totalCellLines-offset),finalSegment=offset+take>=totalCellLines;
   const finalMedicine=finalSegment&&medicineIndex===medicines.length-1,minAdvice=finalMedicine&&adviceText?ADVICE_HEADING+ADVICE_LINE:0;
   if(finalMedicine&&minAdvice&&base+take*CELL_LINE+20+SEPARATOR_SPACE+minAdvice>available){
    const reservedCapacity=Math.floor((available-base-20-SEPARATOR_SPACE-minAdvice)/CELL_LINE);
    if(reservedCapacity>=1)take=Math.min(reservedCapacity,totalCellLines-offset);else{nextPage();available=PREPRINTED_PAGE.bottom-y;capacity=Math.max(1,Math.floor((available-base-20-SEPARATOR_SPACE-minAdvice)/CELL_LINE));take=Math.min(capacity,totalCellLines-offset)}
    finalSegment=offset+take>=totalCellLines;
   }
   const height=base+take*CELL_LINE+20,cells=Object.fromEntries(PREPRINTED_COLUMNS.map(column=>[column.key,allCells[column.key].slice(offset,offset+take)])) as Record<PreprintedColumnKey,string[]>;
   const separatorAfter=finalSegment,finalSeparator=finalSegment&&medicineIndex===medicines.length-1,separatorY=y+height+10;
   page.blocks.push({medicineIndex,continued,y,height,titleLines,cells,separatorAfter,finalSeparator,separatorY});y+=height+(separatorAfter?SEPARATOR_SPACE:10);offset+=take;continued=true;
   if(offset<totalCellLines)nextPage();
  }
 });
 if(adviceText){
  const adviceLines=wrapPreprintedText(adviceText,PREPRINTED_PAGE.right-PREPRINTED_PAGE.left-8,ADVICE_FONT,measure);let offset=0,continued=false;
  while(offset<adviceLines.length){
   const headingHeight=ADVICE_HEADING,available=PREPRINTED_PAGE.bottom-y;if(available<headingHeight+ADVICE_LINE){nextPage()}
   const capacity=Math.max(1,Math.floor((PREPRINTED_PAGE.bottom-y-headingHeight)/ADVICE_LINE)),take=Math.min(capacity,adviceLines.length-offset);
   page.advice.push({y,heading:continued?'Advice / Instructions (continued):':'Advice / Instructions:',lines:adviceLines.slice(offset,offset+take)});y+=headingHeight+take*ADVICE_LINE;offset+=take;continued=true;if(offset<adviceLines.length)nextPage();
  }
 }
 return pages;
}
