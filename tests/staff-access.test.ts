import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {SQLiteD1} from '../lib/sqlite-d1.ts';
import {canAccessModule,homeModule,receptionistModules} from '../lib/access-control.ts';
import {createSession,readSession} from '../lib/railway-session.ts';
import {authenticateStaff,hashPassword,listStaff,manageStaff,staffForSession,verifyPassword} from '../lib/staff-accounts.ts';
const secret='role-test-secret-'.repeat(4);
const password='Reception-test-password-2026!';
const signed=(payload:Record<string,unknown>)=>{const body=Buffer.from(JSON.stringify(payload)).toString('base64url');return body+'.'+createHmac('sha256',secret).update(body).digest('base64url')};

test('receptionist workspace permits daily operations and denies management and AI data',()=>{
 assert.equal(homeModule('receptionist'),'appointments');assert.equal(homeModule('admin'),'overview');
 for(const moduleKey of receptionistModules){assert.ok(canAccessModule('receptionist',moduleKey),moduleKey);assert.ok(canAccessModule('admin',moduleKey),moduleKey)}
 for(const moduleKey of ['overview','analytics','settings','patterns','conversations','learning','states','audit','staff']){assert.equal(canAccessModule('receptionist',moduleKey),false,moduleKey);assert.ok(canAccessModule('admin',moduleKey),moduleKey)}
 assert.equal(canAccessModule('admin','unknown'),false);
 assert.equal(canAccessModule('unknown' as 'admin','patients'),false);
});

test('signed sessions preserve roles, accept existing doctor sessions, and reject role escalation',()=>{
 const now=Date.now(),identity={sub:'STAFF-test',role:'receptionist' as const,version:2};
 assert.deepEqual(readSession(createSession(secret,now,identity),secret,now),identity);
 const legacy=signed({sub:'clinic-admin',exp:Math.floor(now/1000)+300});assert.deepEqual(readSession(legacy,secret,now),{sub:'clinic-admin',role:'admin'});
 for(const payload of [{sub:'STAFF-test',role:'admin',version:2},{sub:'clinic-admin',role:'receptionist',version:1},{sub:'STAFF-test',role:'receptionist'},{sub:'STAFF-test',role:'owner',version:1}])assert.equal(readSession(signed({...payload,exp:Math.floor(now/1000)+300}),secret,now),null);
 const token=createSession(secret,now,identity),[body,signature]=token.split('.');
 const forged=Buffer.from(JSON.stringify({sub:'clinic-admin',role:'admin',exp:Math.floor(now/1000)+300})).toString('base64url');
 assert.equal(readSession(forged+'.'+signature,secret,now),null);assert.equal(readSession(body+'.'+signature,secret,now+43201000),null);
});

test('password hashes use unique salts and reject incorrect or invalid credentials',async()=>{
 const first=await hashPassword(password),second=await hashPassword(password);assert.notEqual(first,second);assert.ok(!first.includes(password));
 assert.ok(await verifyPassword(password,first));assert.equal(await verifyPassword('incorrect password',first),false);
 assert.equal(await verifyPassword(password,'invalid hash'),false);assert.equal(await verifyPassword('x'.repeat(257),first),false);
 await assert.rejects(hashPassword('short'),/12 and 256/);
});

test('staff lifecycle revokes sessions on reset, disable and re-enable without exposing hashes',async()=>{
 const db=new SQLiteD1(':memory:','drizzle'),d1=db as unknown as D1Database;
 try{
  const {id}=await manageStaff(d1,'clinic-admin',{operation:'create',username:' Reception.One ',display_name:'Reception One',password,role:'admin'},'admin');
  const accounts=await listStaff(d1);assert.equal(accounts.length,1);assert.equal(accounts[0].username,'reception.one');assert.equal(accounts[0].role,'receptionist');assert.equal('password_hash' in accounts[0],false);
  const identity=await authenticateStaff(d1,'RECEPTION.ONE',password);assert.ok(identity);assert.equal(identity.sub,id);assert.ok(await staffForSession(d1,identity));
  assert.equal(await authenticateStaff(d1,'reception.one','wrong password'),null);assert.equal(await authenticateStaff(d1,'missing',password),null);
  await manageStaff(d1,'clinic-admin',{operation:'reset_password',id,password:password+'new'},'admin');
  assert.equal(await staffForSession(d1,identity),null);assert.equal(await authenticateStaff(d1,'reception.one',password),null);
  const resetIdentity=await authenticateStaff(d1,'reception.one',password+'new');assert.ok(resetIdentity);
  await manageStaff(d1,'clinic-admin',{operation:'set_active',id,active:false},'admin');
  assert.equal(await staffForSession(d1,resetIdentity),null);assert.equal(await authenticateStaff(d1,'reception.one',password+'new'),null);
  await manageStaff(d1,'clinic-admin',{operation:'set_active',id,active:true},'admin');
  assert.equal(await staffForSession(d1,resetIdentity),null);assert.ok(await authenticateStaff(d1,'reception.one',password+'new'));
  const audit=JSON.stringify((await db.prepare("SELECT detail FROM audit_logs WHERE entity_type='staff_accounts'").all()).results);
  assert.ok(!audit.includes(password));assert.ok(!audit.includes('scrypt$'));assert.ok(audit.includes('password_reset'));
 }finally{db.close()}
});

test('staff creation validates reserved and duplicate usernames, password policy and invalid operations',async()=>{
 const db=new SQLiteD1(':memory:','drizzle'),d1=db as unknown as D1Database;
 const create=(extra:Record<string,unknown>)=>manageStaff(d1,'clinic-admin',{operation:'create',username:'reception',display_name:'Reception',password,...extra},'admin');
 try{
  await assert.rejects(create({username:'ADMIN'}),/reserved/);await assert.rejects(create({username:'bad user'}),/Username/);
  await assert.rejects(create({display_name:''}),/staff name/);await assert.rejects(create({password:'short'}),/12 and 256/);
  assert.equal((await listStaff(d1)).length,0);await create({});await assert.rejects(create({username:'RECEPTION'}),/already in use/);
  await assert.rejects(manageStaff(d1,'clinic-admin',{operation:'reset_password',id:'missing',password},'admin'),/no longer exists/);
  assert.equal((await listStaff(d1)).length,1);
 }finally{db.close()}
});
