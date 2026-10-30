import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const consoleSource=readFileSync(new URL('../app/clinic-console.tsx',import.meta.url),'utf8');
const editorSource=readFileSync(new URL('../app/finance-editor.tsx',import.meta.url),'utf8');
const accountSource=readFileSync(new URL('../app/account-book.tsx',import.meta.url),'utf8');
const pharmacySource=readFileSync(new URL('../app/pharmacy-workspace.tsx',import.meta.url),'utf8');

test('expense form only asks reception for name and total amount',()=>{
 assert.match(consoleSource,/\["Expenses",WalletCards,"expenses"\]/);
 assert.match(editorSource,/kind==='expenses'.*expense_name','Expense name'.*total_amount','Total amount'/);
 assert.match(accountSource,/generalExpenses.*total_amount/);
 assert.match(accountSource,/appointmentIncome\+medicineIncome-purchaseOutflow-generalExpenses/);
});

test('inventory UI is simplified and purchase barcode is optional',()=>{
 const inventory=consoleSource.match(/medicines:\{title:"Medicine inventory"[^\n]+/)?.[0]||'';
 for(const field of ['name','vendor','purchase_rate','selling_price','quantity','minimum_stock'])assert.match(inventory,new RegExp(`"${field}"`));
 assert.doesNotMatch(inventory,/"batch"|"expiry"/);
 assert.match(editorSource,/Barcode \(optional\)/);
});

test('vendor ledger supports monthly running balances and all-history view',()=>{
 for(const text of ['Statement month','Opening balance','Closing balance','Current outstanding','All history','Print ledger'])assert.ok(pharmacySource.includes(text),text);
 assert.match(pharmacySource,/running:running=/);
});

test('forms only require essential fields and vendor phone is removed',()=>{
 assert.match(consoleSource,/const requiredFields:/);
 assert.match(consoleSource,/medicines:\['name'\]/);
 assert.match(consoleSource,/required=\{required\}/);
 const vendorForm=editorSource.match(/kind==='vendors'&&<div[^\n]+/)?.[0]||'';
 assert.match(vendorForm,/Company name/);
 assert.match(vendorForm,/Representative name \(optional\)/);
 assert.match(vendorForm,/Opening outstanding \(optional\)/);
 assert.doesNotMatch(vendorForm,/Phone number/);
});

test('medicine sale discount uses a percentage input with a fixed percent symbol',()=>{
 assert.match(editorSource,/aria-label="Discount percentage"/);
 assert.match(editorSource,/<b aria-hidden="true">%<\/b>/);
 assert.match(editorSource,/kind==='sales'.*discount:discountAmount/);
 const salesForm=editorSource.match(/kind==='sales'&&<[^\n]+/)?.[0]||'';
 assert.doesNotMatch(salesForm,/Discount \(PKR\)/);
});
