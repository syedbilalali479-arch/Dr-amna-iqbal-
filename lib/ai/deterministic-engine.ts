import {pakistanParts} from "../pakistan-time.ts";
import {parseAllDates,parseTime} from "../whatsapp/when.ts";
import {normalizeMessage} from "./ai-brain.ts";
import type {Classification,Intent,KnownFields,Treatment} from "./types";
const intentRules:{intent:Intent;terms:RegExp[]}[]=[
 {intent:"human",terms:[/\b(human|staff|receptionist|agent|insaan|insan)\b/i]},
 {intent:"cancel",terms:[/\b(cancel|cansel|mansookh|nahi aa (sakta|sakti))\b/i]},
 {intent:"reschedule",terms:[/\b(reschedule|time change|date change|badal|shift)\b/i]},
 {intent:"price",terms:[/\b(price|charges|fees?|rate|cost|kitn[aei])\b/i]},
 {intent:"promotion",terms:[/\b(offer|discount|promotion|deal)\b/i]},
 {intent:"booking",terms:[/\b(appointment|apoin?tment|booking|book|slot|token)\b/i]},
 {intent:"clinic_info",terms:[/\b(timing|timings|hours|opening|closing|location|address|pata|kahan|waqt)\b/i]},
 {intent:"greeting",terms:[/^(hi|hello|hey|salam|aoa|assalam)/i]}
];
export function deterministicClassify(message:string):Classification{for(const rule of intentRules)if(rule.terms.some(r=>r.test(message)))return {intent:rule.intent,confidence:.98,route:"deterministic",matched:rule.terms.filter(r=>r.test(message)).map(String)};return {intent:"other",confidence:0,route:"clarify",matched:[]}}
/** Treatments the message fits best; several means the patient must choose (e.g. "hydra facial"). */
export function treatmentMatches(message:string,treatments:Treatment[]){
 const words=new Set(normalizeMessage(message).replace(/hydrafacial/g,"hydra facial").split(" "));
 const scored=treatments.map(item=>{const parts=[...new Set(normalizeMessage(item.name).split(" ").filter(w=>w.length>2))];const hit=parts.filter(w=>words.has(w)).length;return {item,hit,full:parts.length>0&&hit===parts.length}}).filter(x=>x.hit>0);
 if(!scored.length)return [];
 const top=Math.max(...scored.map(x=>x.hit)),best=scored.filter(x=>x.hit===top),full=best.filter(x=>x.full);
 // A name the patient wrote in full wins; otherwise every equally good match is an option.
 if(full.length===1)return [full[0].item];
 return best.map(x=>x.item);
}
export function findTreatment(message:string,treatments:Treatment[]){const list=treatmentMatches(message,treatments);return list.length===1?list[0]:undefined}
export function extractFields(message:string,name:string|undefined,treatments:Treatment[],now=new Date()):KnownFields{
 // Dates are day-first (Pakistan); a past date or a time already gone today is not kept.
 const today=pakistanParts(now);const date=parseAllDates(message,now)[0];let time=parseTime(message)||undefined;
 const validDate=date&&date>=today.date?date:undefined;if(validDate===today.date&&time&&time<=today.time)time=undefined;
 const treatment=findTreatment(message,treatments);
 return {patientName:name?.trim()||undefined,date:validDate,time,service:treatment?.name||undefined}}
export function missingBookingFields(fields:KnownFields){return ["patientName","date","time","service"].filter(k=>!fields[k as keyof KnownFields])}
export function nextQuestion(missing:string[]){const first=missing[0];return first==="patientName"?"Appointment kis patient ke naam par chahiye?":first==="date"?"Appointment kis date ko chahiye?":first==="time"?"Kis time appointment chahiye?":first==="service"?"Kaunsa treatment ya service book karni hai?":""}
export function hashMessage(message:string){let h=2166136261;for(const c of message.toLowerCase().trim()){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
