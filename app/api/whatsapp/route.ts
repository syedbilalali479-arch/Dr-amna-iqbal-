import {env} from "@/lib/runtime-env";
import QRCode from "qrcode";
import {ensureWebhook,publicWebhookUrl} from "../../../lib/wasender";
import {getChatGPTUser} from "../../chatgpt-auth";
const base="https://www.wasenderapi.com/api";
type WaBody={success?:boolean;message?:string;error?:string;qrCode?:string;status?:string;data?:Record<string,unknown>|Array<Record<string,unknown>>};
async function admin(){const user=await getChatGPTUser();if(!user)return Response.json({error:"Authentication required"},{status:401});if(user.role!=="admin")return Response.json({error:"Doctor / Admin access required"},{status:403});return null}
function token(){if(!env.WHATSAPP_API_TOKEN)throw new Error("WaSender API token is missing in Railway variables (WHATSAPP_API_TOKEN).");return env.WHATSAPP_API_TOKEN}
async function call(path:string,init?:RequestInit){const response=await fetch(`${base}${path}`,{...init,headers:{Authorization:`Bearer ${token()}`,"Content-Type":"application/json",...(init?.headers||{})},signal:AbortSignal.timeout(20_000)});const body=await response.json().catch(()=>({})) as WaBody;if(!response.ok||body.success===false)throw new Error(String(body.message||body.error||`WhatsApp request failed (${response.status})`));return body}
const record=(v:unknown)=>(v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{});
const normal=(value:unknown)=>{const s=String(value||"UNKNOWN").toUpperCase().replace(/[\s-]+/g,"_");return ["CONNECTED","WORKING","READY","OPEN","ONLINE"].includes(s)?"CONNECTED":s};
let found:{id:string;at:number}|null=null;
/** Session ID from Railway, or found automatically when the token is a WaSender Personal Access Token. */
async function sessionId():Promise<string|null>{
 if(env.WHATSAPP_SESSION_ID)return env.WHATSAPP_SESSION_ID;
 if(found&&Date.now()-found.at<10*60_000)return found.id;
 try{const list=await call("/whatsapp-sessions");const rows=Array.isArray(list.data)?list.data:[];const pick=rows.find(r=>normal(r.status)==="CONNECTED")||rows[0];if(pick?.id){found={id:String(pick.id),at:Date.now()};return found.id}}catch{/* a session API key cannot list sessions */}
 return null;
}
async function qrImage(session:string){const qrResult=await call(`/whatsapp-sessions/${session}/qrcode`);const d=record(qrResult.data);const value=d.qrCode||d.qr||qrResult.qrCode;if(!value)throw new Error("QR code is not ready yet. Try again in a few seconds.");return QRCode.toDataURL(String(value),{width:320,margin:2,errorCorrectionLevel:"M"})}
export async function GET(request:Request){
 const denied=await admin();if(denied)return denied;
 try{token();const session=await sessionId();
  if(session){const d=record((await call(`/whatsapp-sessions/${session}`)).data);const webhook=await ensureWebhook(env.WHATSAPP_API_TOKEN!,session,publicWebhookUrl(request)).catch(e=>({ok:false,reason:String(e)}));return Response.json({configured:true,canLink:true,webhook,status:normal(d.status||d.sessionStatus),name:d.name||null,phone:d.phone_number||d.phone||null})}
  // Session API key: status and number come from the key itself.
  const status=await call("/status");const user=await call("/user").catch(()=>null);const u=record(user?.data);
  const phone=String(u.phone||u.phone_number||u.id||"").split("@")[0].split(":")[0].replace(/^(\d)/,"+$1")||null;
  return Response.json({configured:true,canLink:false,status:normal(status.status||record(status.data).status),phone,name:u.name||null})}
 catch(error){return Response.json({configured:Boolean(env.WHATSAPP_API_TOKEN),status:env.WHATSAPP_API_TOKEN?"ERROR":"NOT_CONFIGURED",error:error instanceof Error?error.message:"Connection unavailable"})}
}
export async function POST(request:Request){
 const denied=await admin();if(denied)return denied;
 const {action="connect"}=await request.json().catch(()=>({})) as {action?:string};
 try{const session=await sessionId();
  if(!session)throw new Error("To show the QR code here, set WHATSAPP_API_TOKEN to your WaSender Personal Access Token (WaSender → Settings → API tokens), or add WHATSAPP_SESSION_ID. You can also scan the QR in the WaSender dashboard.");
  if(action==="disconnect"){await call(`/whatsapp-sessions/${session}/disconnect`,{method:"POST"});return Response.json({status:"DISCONNECTED"})}
  if(action==="restart"){await call(`/whatsapp-sessions/${session}/restart`,{method:"POST"});return Response.json({status:"CONNECTING"})}
  if(action==="connect"){const started=await call(`/whatsapp-sessions/${session}/connect`,{method:"POST",body:JSON.stringify({linkMethod:"qr"})});if(normal(record(started.data).status)==="CONNECTED")return Response.json({status:"CONNECTED"})}
  else if(action!=="qr")return Response.json({error:"Unknown action"},{status:400});
  return Response.json({status:"NEED_SCAN",qr:await qrImage(session)})}
 catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to update WhatsApp connection"},{status:400})}
}
