import assert from 'node:assert/strict';
import test from 'node:test';
import {purchaseTotalBaseline,purchasesAfterTotalBaseline} from '../lib/purchase-summary';

test('purchase recorded total starts after the preserved historical baseline',()=>{
 const rows=[
  {id:'old',created_at:'2026-11-03 12:28:06',net:100},
  {id:'baseline',created_at:purchaseTotalBaseline,net:200},
  {id:'new',created_at:'2026-11-03 15:45:18',net:300},
 ];
 assert.deepEqual(purchasesAfterTotalBaseline(rows).map(row=>row.id),['new']);
});
