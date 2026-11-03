import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {englishDisplayDigits,planPreprintedLayout,PREPRINTED_PAGE} from '../lib/preprinted-prescription-layout.ts';
import type {MedicineRow} from '../lib/prescription-medicines.ts';

const row=(name:string,patch:Partial<MedicineRow>={}):MedicineRow=>({name,strength:'10 mg',frequency:'Twice daily',dose:'1 tablet',duration:'5 days',instructions:'After food',...patch});
const separators=(rows:MedicineRow[])=>planPreprintedLayout(rows).flatMap(page=>page.blocks).filter(block=>block.separatorAfter);

for(const count of [1,2,3,5])test(`${count} medicines have a separator after every medicine including the final one`,()=>{const rows=Array.from({length:count},(_,i)=>row(`Medicine ${i+1}`)),blocks=planPreprintedLayout(rows).flatMap(page=>page.blocks);assert.equal(blocks.filter(block=>block.separatorAfter).length,count);assert.equal(blocks.filter(block=>block.finalSeparator).length,1);assert.equal(blocks.at(-1)?.finalSeparator,true)});
test('multiline advice follows the final separator and preserves bullets and blank lines',()=>{
 const advice='Use sunscreen daily.\n• Avoid direct sun.\n\n• Follow up after 2 weeks.',pages=planPreprintedLayout([row('Medicine A'),row('Medicine B')],undefined,advice),blocks=pages.flatMap(page=>page.blocks),adviceBlocks=pages.flatMap(page=>page.advice),final=blocks.find(block=>block.finalSeparator);
 assert.ok(final);assert.equal(adviceBlocks[0].heading,'Advice / Instructions:');assert.ok(adviceBlocks[0].y>final.separatorY);assert.deepEqual(adviceBlocks.flatMap(block=>block.lines),advice.split('\n'));
});
test('empty advice does not create an empty advice section',()=>{assert.equal(planPreprintedLayout([row('Medicine A')],undefined,'  ').flatMap(page=>page.advice).length,0)});
test('mixed English names and Urdu instructions remain in structured cells',()=>{
 const pages=planPreprintedLayout([row('Cetirizine',{frequency:'\u0635\u0628\u062d \u0634\u0627\u0645',dose:'2 \u06af\u0648\u0644\u06cc\u0627\u06ba',duration:'5 \u062f\u0646',instructions:'\u0631\u0627\u062a \u06a9\u0648 \u0644\u06af\u0627\u0626\u06cc\u06ba'})]);
 const block=pages[0].blocks[0];assert.match(block.titleLines.join(' '),/Cetirizine/);assert.equal(block.cells.frequency.join(' '),'\u0635\u0628\u062d \u0634\u0627\u0645');assert.equal(block.cells.dose.join(' '),'2 \u06af\u0648\u0644\u06cc\u0627\u06ba');assert.equal(block.cells.instructions.join(' '),'\u0631\u0627\u062a \u06a9\u0648 \u0644\u06af\u0627\u0626\u06cc\u06ba');
});
test('long names and directions wrap or paginate without clipping',()=>{
 const long=row('A very long medicine name with extended release formulation and multiple verified clinical descriptors repeated '.repeat(4),{instructions:'Apply a thin layer to the affected area after washing and drying the skin carefully. '.repeat(28)}),pages=planPreprintedLayout([long]);
 assert.ok(pages.length>=1);assert.ok(pages.flatMap(page=>page.blocks).length>=1);for(const page of pages)for(const block of page.blocks)assert.ok(block.y+block.height<=PREPRINTED_PAGE.bottom);
});
test('missing frequency dose and duration display em dashes',()=>{
 const block=planPreprintedLayout([row('Simple cream',{frequency:'',dose:'',duration:''})])[0].blocks[0];assert.deepEqual(block.cells.frequency,['\u2014']);assert.deepEqual(block.cells.dose,['\u2014']);assert.deepEqual(block.cells.duration,['\u2014']);
});
test('Arabic and Eastern Arabic numerals are display-only normalized to English digits',()=>{
 assert.equal(englishDisplayDigits('\u0661 \u06af\u0648\u0644\u06cc\u060c \u06F2 \u06af\u0648\u0644\u06cc\u0627\u06ba\u060c \u0665 \u062f\u0646'),'1 \u06af\u0648\u0644\u06cc\u060c 2 \u06af\u0648\u0644\u06cc\u0627\u06ba\u060c 5 \u062f\u0646');
});
test('many medicines and multiline advice flow to additional pages without clipping',()=>{
 const rows=Array.from({length:24},(_,i)=>row(`Medicine ${i+1}`)),advice=Array.from({length:60},(_,i)=>`• Advice line ${i+1}`).join('\n'),pages=planPreprintedLayout(rows,undefined,advice);assert.ok(pages.length>1);assert.equal(separators(rows).length,rows.length);assert.equal(pages.flatMap(page=>page.advice).flatMap(block=>block.lines).length,60);for(const page of pages){for(const block of page.blocks)assert.ok(block.y+block.height<=PREPRINTED_PAGE.bottom);for(const block of page.advice)assert.ok(block.y+44+block.lines.length*40<=PREPRINTED_PAGE.bottom)}
});
test('preprinted renderer omits detail headings and dashboard exposes only preprinted output',()=>{
 const pdfSource=readFileSync(new URL('../lib/prescription-pdf.ts',import.meta.url),'utf8'),workspaceSource=readFileSync(new URL('../app/prescription-workspace.tsx',import.meta.url),'utf8');
 assert.equal(pdfSource.includes('ctx.fillText(column.label'),false);
 assert.match(pdfSource,/prescriptionFile\(r:Prescription,mode:PrescriptionPdfMode='preprinted'\)\{[\s\S]*?void mode;return preprintedPrescriptionFile\(r\)/);
 assert.equal(workspaceSource.includes('Digital (with letterhead)'),false);
 assert.equal(workspaceSource.includes('pdfMode'),false);
 assert.equal(workspaceSource.includes("patient_age:String(p.age||'')"),false);
 assert.match(workspaceSource,/patient_age:String\(p\.age\?\?''\)\.trim\(\)\?String\(p\.age\):String\(old\.patient_age\|\|''\)/);
 const pdfCalls=workspaceSource.match(/prescriptionFile\(/g)?.length;
 assert.equal(pdfCalls,5);
 assert.equal(workspaceSource.match(/'preprinted'/g)?.length,pdfCalls);
});
