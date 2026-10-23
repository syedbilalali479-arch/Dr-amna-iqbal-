import test from "node:test";
import assert from "node:assert/strict";
import {classifyWithBrain,normalizeMessage} from "../lib/ai/ai-brain.ts";
import {deterministicClassify,extractFields,findTreatment,missingBookingFields,nextQuestion} from "../lib/ai/deterministic-engine.ts";

test("deterministic route wins for explicit booking",()=>assert.equal(deterministicClassify("appointment book karni hai").intent,"booking"));
test("brain understands spelling and phrase variants",()=>assert.equal(classifyWithBrain("apoinment ka time lena hy").intent,"booking"));
test("brain learns an approved clinic phrase",()=>assert.equal(classifyWithBrain("face ka kharcha",[{intent:"price",phrase:"face ka kharcha",weight:1.3,status:"Approved"}]).intent,"price"));
test("unapproved learning cannot drive routing",()=>assert.notEqual(classifyWithBrain("secret phrase",[{intent:"booking",phrase:"secret phrase",weight:2,status:"Pending"}]).intent,"booking"));
test("field extraction stays deterministic",()=>{const f=extractFields("kal shaam 5 baje glow facial", "Ayesha",[{name:"Glow Facial",price:9000}],new Date("2026-10-23T08:00:00Z"));assert.equal(f.time,"17:00");assert.equal(f.service,"Glow Facial");assert.deepEqual(missingBookingFields(f),[])});
test("loop questions are stable",()=>assert.equal(nextQuestion(["time"]),"Kis time appointment chahiye?"));
test("normalizer maps common variants",()=>assert.equal(normalizeMessage("Apointment ki fees?"),"appointment ki price"));
test("partial treatment wording maps to configured treatment",()=>assert.equal(findTreatment("glow facial ki price",[{name:"QA Glow Facial",price:9000}])?.name,"QA Glow Facial"));
