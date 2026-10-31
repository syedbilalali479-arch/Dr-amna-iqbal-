"use client";
import {useEffect,useState} from 'react';
type Campaign={id:string;title:string;message:string;audience:string;treatment:string;channels:string;status:string;recipients:number;has_image:number;created_at:string};
type Row=Record<string,unknown>;
export function PromotionalMessages({conversations,treatments}:{conversations:Row[];treatments:Row[]}){
 const [campaigns,setCampaigns]=useState<Campaign[]>([]),[title,setTitle]=useState(''),[message,setMessage]=useState(''),[image,setImage]=useState(''),[audience,setAudience]=useState('all'),[treatment,setTreatment]=useState(''),[channels,setChannels]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const reload=async()=>{try{const r=await fetch('/api/promotional-messages',{cache:'no-store'});const j=await r.json() as {error?:string;campaigns?:Campaign[]};if(!r.ok)throw new Error(j.error||'Unable to load campaigns');setCampaigns(j.campaigns||[])}catch(e){setNotice(e instanceof Error?e.message:'Unable to load campaigns')}};
 useEffect(()=>{void reload()},[]);
 const phones=new Set(conversations.map(c=>String(c.phone||'').replace(/\D/g,'')).filter(Boolean));
 const save=async()=>{setBusy(true);setNotice('');try{const r=await fetch('/api/promotional-messages',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,message,image,audience,treatment,channels})});const j=await r.json() as {error?:string};if(!r.ok)throw new Error(j.error||'Unable to save');setNotice('Campaign draft saved. No messages sent.');await reload()}catch(e){setNotice(e instanceof Error?e.message:'Unable to save')}finally{setBusy(false)}};
 return <section style={{maxWidth:900,display:'grid',gap:16}}>
  <div><h2>Promotional Messages</h2><p>Create image-based WhatsApp promotions for patients who have chatted with the clinic AI. Campaigns stay in Draft until compliant delivery and scheduling are configured.</p></div>
  <div className="card" style={{padding:18,display:'grid',gap:12}}>
   <label>Campaign name (optional)<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Skin treatment special"/></label>
   <label>Promotional message (optional)<textarea rows={5} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Assalamualaikum! Skinuvia mein is week special discount hai…"/></label>
   <label>Promotional image (optional)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const f=e.target.files?.[0];if(!f){setImage('');return}if(f.size>330000){setNotice('Please use an image smaller than 330 KB.');return}const reader=new FileReader();reader.onload=()=>setImage(String(reader.result||''));reader.readAsDataURL(f)}}/></label>
   {image&&<img src={image} alt="Promotional preview" style={{maxWidth:280,maxHeight:280,objectFit:'contain'}}/>}
   <label>Audience (optional)<select value={audience} onChange={e=>setAudience(e.target.value)}><option value="all">All WhatsApp AI conversation contacts</option><option value="interested">Interested in selected treatment</option><option value="received">Received selected treatment</option></select></label>
   {audience!=='all'&&<label>Related treatment (optional)<select value={treatment} onChange={e=>setTreatment(e.target.value)}><option value="">Choose later</option>{treatments.map(t=><option key={String(t.id)} value={String(t.name||'')}>{String(t.name||'')}</option>)}</select></label>}
   <p>WhatsApp AI conversation contacts found in loaded records: <b>{phones.size}</b>. Actual eligible recipients must be checked at sending time.</p>
   <fieldset><legend>Posted on other channels? (optional)</legend>{['WhatsApp Status','Instagram Ad','Facebook Ad'].map(c=><label key={c} style={{display:'block',margin:8}}>{c} <select value={channels[c]||''} onChange={e=>setChannels(p=>({...p,[c]:e.target.value}))}><option value="">Not specified</option><option value="yes">Yes</option><option value="no">No</option><option value="planned">Planned</option></select></label>)}</fieldset>
   <p>Delivery preference: spread across up to 48 hours, subject to WhatsApp provider rules and marketing permissions. Sending is not yet enabled.</p>
   <button className="primary" type="button" disabled={busy} onClick={save}>{busy?'Saving…':'Save Campaign Draft'}</button>
   {notice&&<p role="status">{notice}</p>}
  </div>
  <div><h3>Saved campaigns</h3>{campaigns.length===0?<p>No campaigns yet.</p>:campaigns.map(c=><article key={c.id} style={{padding:12,borderBottom:'1px solid #ccc'}}><b>{c.title||'Untitled promotion'}</b> · {c.status}<p>{c.message}</p><small>{c.recipients} conversation contacts (unfiltered estimate) · {c.created_at}{c.has_image?' · Image attached':''}</small></article>)}</div>
 </section>;
}
