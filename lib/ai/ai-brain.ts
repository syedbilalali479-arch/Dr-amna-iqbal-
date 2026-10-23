import type {Classification,Intent,Pattern} from "./types";
const aliases:Record<string,string>={
 "apoinment":"appointment","appointmentt":"appointment","apointment":"appointment","bok":"book","buk":"book","bookingg":"booking",
 "kitna":"kitne","kitni":"kitne","charges":"price","fees":"price","fee":"price","rate":"price","cost":"price",
 "cansel":"cancel","cancelled":"cancel","mansookh":"cancel","badalna":"reschedule","shift":"reschedule",
 "insan":"human","insaan":"human","agent":"human","representative":"human","offer":"promotion","discount":"promotion",
 "salam":"hello","assalamualaikum":"hello","aoa":"hello","hy":"hello","hey":"hello"
};
export function normalizeMessage(value:string){return value.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).filter(Boolean).map(w=>aliases[w]??w).join(" ")}
const builtins:Pattern[]=[
 {intent:"booking",phrase:"appointment book karni hai",weight:1.2},{intent:"booking",phrase:"time lena hai",weight:1},{intent:"booking",phrase:"kal ana hai",weight:.8},{intent:"booking",phrase:"slot chahiye",weight:1},
 {intent:"price",phrase:"kitne price hai",weight:1.2},{intent:"price",phrase:"price bata dein",weight:1.1},{intent:"price",phrase:"kitne paise",weight:1},{intent:"price",phrase:"treatment price",weight:1},
 {intent:"cancel",phrase:"appointment cancel kar do",weight:1.3},{intent:"cancel",phrase:"nahi aa sakti",weight:.9},{intent:"reschedule",phrase:"time change kar do",weight:1.2},{intent:"reschedule",phrase:"date badal dein",weight:1.2},
 {intent:"human",phrase:"staff se baat",weight:1.3},{intent:"human",phrase:"doctor se baat",weight:1},{intent:"promotion",phrase:"koi offer chal raha",weight:1.2},{intent:"greeting",phrase:"hello",weight:1}
];
function tokens(s:string){return new Set(normalizeMessage(s).split(" ").filter(Boolean))}
function similarity(a:string,b:string){const x=tokens(a),y=tokens(b);if(!x.size||!y.size)return 0;let overlap=0;for(const t of x)if(y.has(t))overlap++;return (2*overlap)/(x.size+y.size)}
export function classifyWithBrain(message:string,learned:Pattern[]=[]):Classification{
 const all=[...builtins,...learned.filter(p=>!p.status||p.status==="Approved")];const scores=new Map<Intent,{score:number;matches:string[]}>();
 for(const p of all){const score=similarity(message,p.phrase)*Math.max(.2,p.weight);const prev=scores.get(p.intent)??{score:0,matches:[]};if(score>0){prev.score+=Math.min(1.4,score);prev.matches.push(p.phrase)}scores.set(p.intent,prev)}
 const ranked=[...scores.entries()].sort((a,b)=>b[1].score-a[1].score);const top=ranked[0];if(!top||top[1].score<.42)return {intent:"other",confidence:.2,route:"clarify",matched:[]};const second=ranked[1]?.[1].score??0;const confidence=Math.min(.96,.48+top[1].score*.28+Math.max(0,top[1].score-second)*.12);return {intent:top[0],confidence,route:"brain",matched:top[1].matches.slice(0,3)}
}
export function learningCandidate(message:string){const normalized=normalizeMessage(message);return normalized.length>=5&&normalized.length<=120?normalized:null}
