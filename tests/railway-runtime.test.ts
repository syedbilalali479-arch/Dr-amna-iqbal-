import test from 'node:test';import assert from 'node:assert/strict';
import {SQLiteD1} from '../lib/sqlite-d1.ts';
import {createSession,validSession,constantEqual} from '../lib/railway-session.ts';
test('Railway SQLite migrations run once and D1 stock batches roll back atomically',async()=>{
 const db=new SQLiteD1(':memory:','drizzle');db.migrate('drizzle');
 await db.prepare("INSERT INTO medicines(id,clinic_id,name,batch,expiry,quantity) VALUES('test','skinuvia','Test','B1','2030-01-01',10)").run();
 await db.batch([db.prepare('UPDATE medicines SET quantity=quantity-? WHERE id=?').bind(3,'test'),db.prepare('INSERT INTO commerce_guards(id,valid) VALUES(?,changes())').bind('g1')]);
 assert.equal((await db.prepare('SELECT quantity FROM medicines WHERE id=?').bind('test').first<{quantity:number}>())?.quantity,7);
 await assert.rejects(db.batch([db.prepare("INSERT INTO commerce_documents(id,clinic_id,kind,body) VALUES('sale','skinuvia','sales','{}')"),db.prepare('UPDATE medicines SET quantity=quantity-? WHERE id=?').bind(100,'test')]),/Insufficient medicine stock/);
 assert.equal(await db.prepare("SELECT id FROM commerce_documents WHERE id='sale'").first(),null);assert.equal(await db.prepare("SELECT quantity FROM medicines WHERE id='test'").first<number>('quantity'),7);
 const raw=await db.prepare('SELECT id,quantity FROM medicines').raw({columnNames:true});assert.deepEqual(raw,[['id','quantity'],['test',7]]);db.close();
});
test('signed sessions reject forged, expired, malformed and missing credentials',()=>{
 const secret='a'.repeat(48),now=Date.now(),token=createSession(secret,now);assert.ok(validSession(token,secret,now));assert.equal(validSession(token,secret+'x',now),false);assert.equal(validSession(token,secret,now+43201000),false);assert.equal(validSession(token+'x',secret,now),false);assert.equal(validSession('',secret),false);assert.equal(validSession(token,''),false);assert.ok(constantEqual('password','password'));assert.equal(constantEqual('password','other'),false);
});
