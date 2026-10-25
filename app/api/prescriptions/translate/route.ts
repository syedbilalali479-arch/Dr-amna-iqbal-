import {getChatGPTUser} from '../../../chatgpt-auth';
import {knownUrdu,romanToUrdu,checkTranslation,type SourceLanguage} from '../../../../lib/prescription-language';
const requests=new Map<string,{count:number;until:number}>();
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Authentication required'},{status:401});
 try{
  const input=await request.json() as {text?:unknown;source?:unknown};const text=String(input.text||'').trim(),source=input.source as SourceLanguage;
  if(!['english','roman-urdu'].includes(source)||!text||text.length>2000)return Response.json({error:'Enter up to 2,000 characters and choose English or Roman Urdu.'},{status:400});
  const now=Date.now(),previous=requests.get(user.userId);if(previous&&previous.until>now&&previous.count>=20)return Response.json({error:'Please wait a minute before converting more text.'},{status:429});requests.set(user.userId,{count:previous&&previous.until>now?previous.count+1:1,until:previous&&previous.until>now?previous.until:now+60000});
  if(source==='roman-urdu'){const result=romanToUrdu(text);return Response.json({...result,text:checkTranslation(text,result.text)});}
  const segments=text.split(/(?<=[.!?])\s+|\n+/);
  const converted=await Promise.all(segments.map(async part=>{if(!part.trim())return part;const known=knownUrdu(part,'english');if(known)return known;if(new TextEncoder().encode(part).length>500)throw new Error('Split long text into shorter sentences before converting.');
   const url=new URL('https://api.mymemory.translated.net/get');url.searchParams.set('q',part.trim());url.searchParams.set('langpair','en|ur');
   const response=await fetch(url,{signal:AbortSignal.timeout(12000),cache:'no-store'});if(!response.ok)throw new Error('Translation service is unavailable. Try again or type Urdu directly.');
   const result=await response.json() as {responseStatus?:number;responseDetails?:string;quotaFinished?:boolean;responseData?:{translatedText?:string}};
   if(result.responseStatus!==200||result.quotaFinished)throw new Error('The translation service limit has been reached. Try later or type Urdu directly.');
   const translated=String(result.responseData?.translatedText||'').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').trim();return checkTranslation(part,translated);
  }));
  return Response.json({text:checkTranslation(text,converted.join('\n').replace(/\n{3,}/g,'\n\n')),unconverted:[]});
 }catch(e){return Response.json({error:e instanceof Error&&e.name==='TimeoutError'?'Translation timed out. Try again or type Urdu directly.':e instanceof Error?e.message:'Unable to convert text'},{status:400});}
}
