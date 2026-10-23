import {resolveBookingMessage} from "../pakistan-time.ts";
import {normalizeMessage} from "./ai-brain.ts";
import type {Classification,Intent,KnownFields,Treatment} from "./types";
const intentRules:{intent:Intent;terms:RegExp[]}[]=[
 {intent:"human",terms:[/\b(human|staff|receptionist|agent|insaan|insan)\b/i]},
 {intent:"cancel",terms:[/\b(cancel|cansel|mansookh|nahi aa (sakta|sakti))\b/i]},
 {intent:"reschedule",terms:[/\b(reschedule|time change|date change|badal|shift)\b/i]},
 {intent:"price",terms:[/\b(price|charges|fees?|rate|cost|kitn[aei])\b/i]},
 {intent:"promotion",terms:[/\b(offer|discount|promotion|deal)\b/i]},
 {intent:"booking",terms:[/\b(appointment|apoin?tment|booking|book|slot|token)\b/i]},
 {intent:"greeting",terms:[/^(hi|hello|hey|salam|aoa|assalam)/i]}
];
export function deterministicClassify(message:string):Classification{for(const rule of intentRules)if(rule.terms.some(r=>r.test(message)))return {intent:rule.intent,confidence:.98,route:"deterministic",matched:rule.terms.filter(r=>r.test(message)).map(String)};return {intent:"other",confidence:0,route:"clarify",matched:[]}}
export function findTreatment(message:string,treatments:Treatment[]){const words=new Set(normalizeMessage(message).split(" "));let best:{item:Treatment;score:number}|null=null;for(const item of treatments){const parts=normalizeMessage(item.name).split(" ").filter(w=>w.length>2);const overlap=parts.filter(w=>words.has(w)).length;const score=parts.length?overlap/parts.length:0;if(overlap&&(!best||score>best.score))best={item,score}}return best&&best.score>=.45?best.item:undefined}
export function extractFields(message:string,name:string|undefined,treatments:Treatment[],now=new Date()):KnownFields{const parsed=resolveBookingMessage(message,now);const treatment=findTreatment(message,treatments);const hasDate=/\b(aaj|aj|kal|parson|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jumma|peer|mangal|budh|jumerat|hafta|\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?|\d{4}-\d{2}-\d{2})\b/i.test(message);return {patientName:name?.trim()||undefined,date:hasDate?parsed.date:undefined,time:parsed.time||undefined,service:treatment?.name||parsed.service||undefined}}
export function missingBookingFields(fields:KnownFields){return ["patientName","date","time","service"].filter(k=>!fields[k as keyof KnownFields])}
export function nextQuestion(missing:string[]){const first=missing[0];return first==="patientName"?"Appointment kis patient ke naam par chahiye?":first==="date"?"Appointment kis date ko chahiye?":first==="time"?"Kis time appointment chahiye?":first==="service"?"Kaunsa treatment ya service book karni hai?":""}
export function hashMessage(message:string){let h=2166136261;for(const c of message.toLowerCase().trim()){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
