import {env} from "@/lib/runtime-env";
import QRCode from "qrcode";
import {ensureWebhook,publicWebhookUrl} from "../../../lib/wasender";
import {getChatGPTUser} from "../../chatgpt-auth";
const base="https://www.wasenderapi.com/api";
type Runtime=typeof env&{GEMINI_API_KEY?:string};
type WaBody={success?:boolean;message?:string;error?:string;qrCode?:string;data?:Record<string,unknown>};
async function admin(){const user=await getChatGPTUser();if(!user)return Response.json({error:"Authentication required"},{status:401});if(user.role!=="admin")return Response.json({error:"Doctor / Admin access required"},{status:403});return null}
function credentials(){if(!env.WHATSAPP_API_TOKEN||!env.WHATSAPP_SESSION_ID)throw new Error("WhatsApp is not set up yet: add WHATSAPP_API_TOKEN and WHATSAPP_SESSION_ID in Railway variables.");return {token:env.WHATSAPP_API_TOKEN,session:env.WHATSAPP_SESSION_ID}}
async function call(path:string,init?:RequestInit){const {token}=credentials();const response=await fetch(`${base}${path}`,{...init,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...(init?.headers||{})},signal:AbortSignal.timeout(20_000)});const body=await response.json().catch(()=>({})) as WaBody;if(!response.ok||body.success===false)throw new Error(String(body.message||body.error||`WhatsApp request failed (${response.status})`));return body}
const normal=(value:unknown)=>{const s=String(value||"UNKNOWN").toUpperCase().replace(/[\s-]+/g,"_");return ["CONNECTED","WORKING","READY","OPEN","ONLINE"].includes(s)?"CONNECTED":s};
async function qrImage(session:string){const qrResult=await call(`/whatsapp-sessions/${session}/qrcode`);const value=qrResult.data?.qrCode||qrResult.data?.qr||qrResult.qrCode;if(!value)throw new Error("QR code is not ready yet. Try again in a few seconds.");return QRCode.toDataURL(String(value),{width:320,margin:2,errorCorrectionLevel:"M"})}
export async function GET(request:Request){
 const denied=await admin();if(denied)return denied;
 const runtime=env as Runtime;const config={apiToken:Boolean(env.WHATSAPP_API_TOKEN),sessionId:Boolean(env.WHATSAPP_SESSION_ID),gemini:Boolean(runtime.GEMINI_API_KEY)};
 try{const {session}=credentials();const result=await call(`/whatsapp-sessions/${session}`);const d=result.data||{};
  const webhook=await ensureWebhook(env.WHATSAPP_API_TOKEN!,session,publicWebhookUrl(request)).catch(e=>({ok:false,reason:String(e)}));
  return Response.json({configured:true,config,webhook,status:normal(d.status||d.sessionStatus),name:d.name||null,phone:d.phone_number||d.phone||null})}
 catch(error){return Response.json({configured:config.apiToken&&config.sessionId,config,status:config.apiToken&&config.sessionId?"ERROR":"NOT_CONFIGURED",error:error instanceof Error?error.message:"Connection unavailable"})}
}
export async function POST(request:Request){
 const denied=await admin();if(denied)return denied;
 const {action="connect"}=await request.json().catch(()=>({})) as {action?:string};
 try{const {session}=credentials();
  if(action==="disconnect"){await call(`/whatsapp-sessions/${session}/disconnect`,{method:"POST"});return Response.json({status:"DISCONNECTED"})}
  if(action==="restart"){await call(`/whatsapp-sessions/${session}/restart`,{method:"POST"});return Response.json({status:"CONNECTING"})}
  if(action==="connect"){const started=await call(`/whatsapp-sessions/${session}/connect`,{method:"POST",body:JSON.stringify({linkMethod:"qr"})});if(normal(started.data?.status)==="CONNECTED")return Response.json({status:"CONNECTED"})}
  else if(action!=="qr")return Response.json({error:"Unknown action"},{status:400});
  return Response.json({status:"NEED_SCAN",qr:await qrImage(session)})}
 catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to update WhatsApp connection"},{status:400})}
}
