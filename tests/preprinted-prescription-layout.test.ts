import test from 'node:test';
import assert from 'node:assert/strict';
import {englishDisplayDigits,planPreprintedLayout,PREPRINTED_PAGE} from '../lib/preprinted-prescription-layout.ts';
import type {MedicineRow} from '../lib/prescription-medicines.ts';

const row=(name:string,patch:Partial<MedicineRow>={}):MedicineRow=>({name,strength:'10 mg',frequency:'Twice daily',dose:'1 tablet',duration:'5 days',instructions:'After food',...patch});
const separators=(rows:MedicineRow[])=>planPreprintedLayout(rows).flatMap(page=>page.blocks).filter(block=>block.separatorAfter);

test('one medicine has no separator',()=>{assert.equal(separators([row('Medicine A')]).length,0)});
test('two medicines have exactly one separator',()=>{assert.equal(separators([row('Medicine A'),row('Medicine B')]).length,1)});
test('three medicines have exactly two separators',()=>{assert.equal(separators([row('Medicine A'),row('Medicine B'),row('Medicine C')]).length,2)});
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
test('many medicines flow to additional pages with one separator between every pair',()=>{
 const rows=Array.from({length:24},(_,i)=>row(`Medicine ${i+1}`)),pages=planPreprintedLayout(rows);assert.ok(pages.length>1);assert.equal(separators(rows).length,rows.length-1);for(const page of pages)for(const block of page.blocks)assert.ok(block.y+block.height<=PREPRINTED_PAGE.bottom);
});
