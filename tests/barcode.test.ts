import test from 'node:test';
import assert from 'node:assert/strict';
import {addScannedMedicine,barcodeDetails,findBarcodeMedicine} from '../lib/barcode.ts';

const medicine={id:'med-1',name:'Skinuvia Test Cream',barcode:'8964000000011',batch:'BATCH-01',purchase_rate:275,selling_price:350,expiry:'2028-12-31',minimum_stock:5};

test('plain barcode finds inventory and fills medicine name and unit prices',()=>{
 const parsed=barcodeDetails('8964000000011');
 const found=findBarcodeMedicine([medicine],parsed)!;
 const purchase=addScannedMedicine([],found,'purchases',parsed)[0];
 const sale=addScannedMedicine([],found,'sales',parsed)[0];
 assert.equal(purchase.medicine_name,'Skinuvia Test Cream');
 assert.equal(purchase.price,275);
 assert.equal(purchase.selling_price,350);
 assert.equal(sale.price,350);
});

test('repeat scan hydrates stale row fields while increasing quantity',()=>{
 const parsed=barcodeDetails('8964000000011');
 const items=addScannedMedicine([{medicine_id:'med-1',medicine_name:'',description:'',quantity:1,price:0}],medicine,'sales',parsed);
 assert.deepEqual({quantity:items[0].quantity,name:items[0].medicine_name,price:items[0].price},{quantity:2,name:'Skinuvia Test Cream',price:350});
});

test('GS1 scan supports GTIN, batch and expiry data',()=>{
 const parsed=barcodeDetails(']C1010896400000001110BATCH-01\x1d17281231');
 assert.equal(parsed.gtin,'08964000000011');
 assert.equal(parsed.batch,'BATCH-01');
 assert.equal(parsed.expiry,'2028-12-31');
 assert.equal(findBarcodeMedicine([{...medicine,barcode:'08964000000011'}],parsed)?.id,'med-1');
});
