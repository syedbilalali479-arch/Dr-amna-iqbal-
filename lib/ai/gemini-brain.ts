import type {Classification,Intent} from "./types";

const intents:Intent[]=["booking","price","cancel","reschedule","promotion","clinic_info","human","greeting","other"];
type GeminiResult={intent?:unknown;confidence?:unknown;reason?:unknown};

export async function classifyWithGemini(input:{apiKey?:string;message:string;model?:string;timeoutMs?:number;fetcher?:typeof fetch}):Promise<Classification|null>{
 if(!input.apiKey)return null;
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),input.timeoutMs??2500);
 try{
  const model=input.model||"gemini-2.5-flash-lite";
  const response=await (input.fetcher||fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
   method:"POST",signal:controller.signal,headers:{"content-type":"application/json","x-goog-api-key":input.apiKey},
   body:JSON.stringify({
    systemInstruction:{parts:[{text:"Classify one Skinuvia clinic patient message. Understand Roman Urdu, Urdu and English. Return intent only; never answer, diagnose, prescribe, invent a price, or execute an action. Use other when uncertain."}]},
    contents:[{role:"user",parts:[{text:input.message.slice(0,500)}]}],
    generationConfig:{temperature:0,maxOutputTokens:80,responseMimeType:"application/json",responseSchema:{type:"OBJECT",properties:{intent:{type:"STRING",enum:intents},confidence:{type:"NUMBER"},reason:{type:"STRING"}},required:["intent","confidence"]}}
   })
  });
  if(!response.ok)return null;
  const payload=await response.json() as {candidates?:Array<{content?:{parts?:Array<{text?:string}>}}>};
  const text=payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if(!text)return null;
  const parsed=JSON.parse(text) as GeminiResult;
  const intent=String(parsed.intent||"") as Intent;
  const confidence=Math.max(0,Math.min(1,Number(parsed.confidence)||0));
  if(!intents.includes(intent)||confidence<.62)return null;
  return {intent,confidence,route:"gemini",matched:[String(parsed.reason||"Gemini language fallback").slice(0,120)]};
 }catch{return null}finally{clearTimeout(timer)}
}
