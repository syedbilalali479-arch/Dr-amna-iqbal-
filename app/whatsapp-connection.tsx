"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {CheckCircle2,Power,QrCode,RefreshCw,RotateCcw,Smartphone,XCircle} from 'lucide-react';

type Status={configured?:boolean;status:string;phone?:string|null;name?:string|null;error?:string;config?:{apiToken:boolean;sessionId:boolean;gemini:boolean};webhook?:{ok?:boolean;reason?:string}};
const label:Record<string,string>={CONNECTED:'Connected',NEED_SCAN:'Waiting for QR scan',CONNECTING:'Connecting…',DISCONNECTED:'Disconnected',LOGGED_OUT:'Logged out',EXPIRED:'Session expired',NOT_CONFIGURED:'Not set up',ERROR:'Cannot reach WhatsApp',CHECKING:'Checking…'};

export function WhatsAppConnectionTab({show}:{show:(m:string)=>void}){
 const [info,setInfo]=useState<Status>({status:'CHECKING'}),[qr,setQr]=useState(''),[busy,setBusy]=useState(''),[confirmOff,setConfirmOff]=useState(false);
 const qrAt=useRef(0);
 const check=useCallback(async()=>{try{const r=await fetch('/api/whatsapp',{cache:'no-store'});const j=await r.json() as Status;setInfo(j);if(j.status==='CONNECTED')setQr('');return j}catch{setInfo({status:'ERROR',error:'Network error'});return null}},[]);
 const act=async(action:'connect'|'qr'|'disconnect'|'restart',quiet=false)=>{if(!quiet)setBusy(action);try{const r=await fetch('/api/whatsapp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})});const j=await r.json() as {status?:string;qr?:string;error?:string};if(!r.ok)throw new Error(j.error||'Request failed');
   if(j.qr){setQr(j.qr);qrAt.current=Date.now();setInfo(i=>({...i,status:'NEED_SCAN'}));if(!quiet)show('QR code ready: WhatsApp → Linked Devices → Link a device')}
   else{setQr('');if(action==='disconnect')show('WhatsApp disconnected');if(action==='restart')show('WhatsApp session restarting');await check()}}
  catch(e){if(!quiet)show(e instanceof Error?e.message:'Request failed')}finally{if(!quiet)setBusy('')}};
 useEffect(()=>{const t=setTimeout(()=>void check(),0);return()=>clearTimeout(t)},[check]);
 // While a QR is on screen: check every 3 s for the scan, and refresh the QR before it expires.
 useEffect(()=>{if(!qr)return;const poll=setInterval(()=>{void check().then(j=>{if(j?.status==='CONNECTED')show('WhatsApp connected ✅')})},3000);const refresh=setInterval(()=>{if(Date.now()-qrAt.current>25000)void act('qr',true)},5000);return()=>{clearInterval(poll);clearInterval(refresh)}},[qr]);// eslint-disable-line react-hooks/exhaustive-deps
 const connected=info.status==='CONNECTED',notSetUp=info.status==='NOT_CONFIGURED';
 const item=(ok:boolean|undefined,text:string,hint?:string)=><li className={ok?'ok':'bad'}>{ok?<CheckCircle2 size={15}/>:<XCircle size={15}/>} <span>{text}{!ok&&hint?<small> — {hint}</small>:null}</span></li>;
 return <>
  <div className="pageTitle"><div><span>DOCTOR ONLY · WHATSAPP</span><h1>WhatsApp Connection</h1><p>Link the clinic WhatsApp number to the AI receptionist (WaSender).</p></div><button className="secondary" onClick={()=>void check()} disabled={Boolean(busy)}><RefreshCw size={14}/> Refresh status</button></div>
  <section className="panel connectPanel">
   <div className="connectInfo"><span className={connected?'connectIcon live':'connectIcon'}><Smartphone/></span><div><span>STATUS</span><h2>{label[info.status]||info.status}</h2><p>{connected?`Connected${info.phone?` as ${info.phone}`:''}. Patients' messages are answered automatically.`:notSetUp?'Add WHATSAPP_API_TOKEN and WHATSAPP_SESSION_ID in Railway variables, then refresh.':info.status==='NEED_SCAN'?'Scan the QR code below with the clinic phone.':'Press Connect WhatsApp and scan the QR code with the clinic phone.'}</p>{info.error&&!notSetUp&&<p className="dangerText"><small>{info.error}</small></p>}</div></div>
   <div className="connectActions"><i className={`connectionState ${connected?'online':''}`}>{label[info.status]||info.status}</i>
    {!connected&&!notSetUp&&<button className="primary" disabled={Boolean(busy)} onClick={()=>void act('connect')}>{busy==='connect'?<RefreshCw className="spin" size={14}/>:<QrCode size={14}/>} {busy==='connect'?'Preparing QR…':qr?'New QR code':'Connect WhatsApp'}</button>}
    {!notSetUp&&<button className="secondary" disabled={Boolean(busy)} onClick={()=>void act('restart')} title="Restart the WhatsApp session"><RotateCcw size={14}/> Restart</button>}
    {connected&&<button className="secondary waDisconnect" disabled={Boolean(busy)} onClick={()=>setConfirmOff(true)}><Power size={14}/> Disconnect</button>}
   </div>
   {qr&&!connected&&<div className="qrArea"><img src={qr} alt="WhatsApp linking QR code"/><div><h3>Scan this code</h3><ol><li>Open WhatsApp on the clinic phone</li><li>Tap ⋮ / Settings → <b>Linked devices</b></li><li>Tap <b>Link a device</b> and scan this QR</li></ol><p><small>The code refreshes by itself. This page turns green as soon as the phone is linked.</small></p></div></div>}
   {confirmOff&&<div className="notice" role="alertdialog"><b>Disconnect WhatsApp?</b> The AI receptionist will stop replying until you scan a new QR code. <button className="danger" onClick={()=>{setConfirmOff(false);void act('disconnect')}}>Yes, disconnect</button> <button onClick={()=>setConfirmOff(false)}>Cancel</button></div>}
  </section>
  <section className="panel waChecklist"><div className="panelTitle"><div><span>SETUP CHECK</span><h2>Everything the AI receptionist needs</h2></div></div><ul>
   {item(info.config?.apiToken,'WaSender API token (WHATSAPP_API_TOKEN)','add it in Railway variables')}
   {item(info.config?.sessionId,'WaSender session ID (WHATSAPP_SESSION_ID)','add it in Railway variables')}
   {item(connected,'Clinic phone linked','press Connect WhatsApp and scan the QR')}
   {item(Boolean(info.webhook?.ok),'Incoming messages webhook registered',info.webhook?.reason||'refresh after connecting')}
   {item(info.config?.gemini,'Smart AI replies (Gemini)','without it a simpler built-in engine replies')}
  </ul></section>
 </>;
}
