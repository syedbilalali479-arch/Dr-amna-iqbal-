import test from "node:test";
import assert from "node:assert/strict";
import {classifyWithGemini} from "../lib/ai/gemini-brain.ts";

test("Gemini fallback is skipped when no key is configured",async()=>{
 let called=false;
 const result=await classifyWithGemini({message:"samajh nahi aa raha",fetcher:async()=>{called=true;return new Response()} });
 assert.equal(result,null);assert.equal(called,false);
});

test("Gemini fallback accepts only structured, confident intent",async()=>{
 const fetcher:typeof fetch=async(_url,init)=>{
  assert.equal((init?.headers as Record<string,string>)["x-goog-api-key"],"secret");
  const body=JSON.parse(String(init?.body));assert.equal(body.generationConfig.maxOutputTokens,80);
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({intent:"booking",confidence:.91,reason:"appointment request"})}]}}]});
 };
 const result=await classifyWithGemini({apiKey:"secret",message:"mera scene kal ka set kar dein",fetcher});
 assert.equal(result?.intent,"booking");assert.equal(result?.route,"gemini");
});

test("Gemini fallback rejects low confidence output",async()=>{
 const fetcher:typeof fetch=async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({intent:"price",confidence:.4})}]}}]});
 assert.equal(await classifyWithGemini({apiKey:"secret",message:"unclear",fetcher}),null);
});
