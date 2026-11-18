import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,writeReply,type GeminiConfig} from '../lib/whatsapp/gemini.ts';

const analysis={language:'ROMAN_URDU',intent:'BOOKING_REQUEST',needs_human:false,medical_urgency:false,patient_name:'Sana',service_name:null,date:'2026-11-20',time:'19:00',explicit_confirmation:false};

test('DeepSeek understands and answers text messages',async()=>{
 const calls:string[]=[];const original=globalThis.fetch;
 globalThis.fetch=(async(url:string,init:RequestInit)=>{calls.push(url);const body=JSON.parse(String(init.body));assert.equal((init.headers as Record<string,string>).authorization,'Bearer ds-key');assert.equal(body.model,'deepseek-chat');const json=body.response_format?.type==='json_object';if(json)assert.match(body.messages[0].content,/json/);return new Response(JSON.stringify({choices:[{message:{content:json?JSON.stringify(analysis):'Ji, Sana ki appointment ke liye time note kar liya hai.'}}]}),{status:200})}) as typeof fetch;
 try{
  const ops:string[]=[];const cfg:GeminiConfig={apiKey:'ds-key',model:'deepseek-chat',provider:'deepseek',onCall:op=>{ops.push(op)}};
  const result=await analyze(cfg,'context','Sana ki appointment kal 7 baje');
  assert.equal(result.intent,'BOOKING_REQUEST');assert.equal(result.time,'19:00');assert.equal(result.patient_name,'Sana');
  assert.match(await writeReply(cfg,'Skinuvia','Dr. Aamina Iqbal','context','turn','MISSING service'),/Sana/);
  assert.deepEqual(calls,['https://api.deepseek.com/chat/completions','https://api.deepseek.com/chat/completions']);
  assert.deepEqual(ops,['deepseek:analyze','deepseek:reply']);
 }finally{globalThis.fetch=original}
});

test('a failed DeepSeek call falls back to Gemini',async()=>{
 const calls:string[]=[];const original=globalThis.fetch;
 globalThis.fetch=(async(url:string)=>{calls.push(url);if(url.includes('deepseek'))return new Response(JSON.stringify({error:{message:'Insufficient Balance'}}),{status:402});return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(analysis)}]}}]}),{status:200})}) as typeof fetch;
 try{
  const gemini:GeminiConfig={apiKey:'g-key',model:'gemini-2.5-flash-lite',provider:'gemini'};
  const result=await analyze({apiKey:'ds-key',model:'deepseek-chat',provider:'deepseek',fallback:gemini},'context','turn');
  assert.equal(result.intent,'BOOKING_REQUEST');
  assert.equal(calls.length,2);assert.match(calls[1],/generativelanguage/);
 }finally{globalThis.fetch=original}
});
