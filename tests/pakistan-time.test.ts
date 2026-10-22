import test from "node:test";
import assert from "node:assert/strict";
import {pakistanParts,resolveBookingMessage} from "../lib/pakistan-time.ts";
const now=new Date("2026-10-22T10:00:00Z");
test("uses Pakistan timezone",()=>assert.equal(pakistanParts(now).date,"2026-10-22"));
test("resolves Roman Urdu tomorrow booking",()=>assert.deepEqual(resolveBookingMessage("Kal 5 baje skin treatment ki appointment",now),{date:"2026-10-23",time:"17:00",service:"Skin Consultation",complete:true,timezone:"Asia/Karachi"}));
test("asks for missing time",()=>assert.equal(resolveBookingMessage("Kal HydraFacial chahiye",now).complete,false));
