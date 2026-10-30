import {wing} from './prescription-pdf';
import {clinicProfile} from './clinic-profile';
import type {CommerceRecord as Row} from './commerce';
const currency=(n:unknown)=>`PKR ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:2})}`;
const escape=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function printReadyWindow(w:Window,delay=450){
 const run=()=>{if(!w.closed){w.focus();w.print()}};
 const schedule=()=>{const timer=typeof w.setTimeout==='function'?w.setTimeout.bind(w):setTimeout;timer(run,delay)};
 if(w.document.readyState==='loading'&&typeof w.addEventListener==='function')w.addEventListener('load',schedule,{once:true});
 else schedule();
}
const printPrefix='skinuvia-print:';
export function reservePrintWindow(){
 const key=crypto.randomUUID(),popup=window.open(`/print-document?key=${encodeURIComponent(key)}`,'_blank','width=900,height=850');
 if(popup)popup.name=printPrefix+key;
 return popup;
}
export function openPrintableHtml(html:string,reserved?:Window|null){
 if(typeof window==='undefined'){
  if(!reserved)return;reserved.document.open();reserved.document.write(html);reserved.document.close();printReadyWindow(reserved);return;
 }
 const named=reserved?.name?.startsWith(printPrefix)?reserved.name.slice(printPrefix.length):'',key=named||crypto.randomUUID();
 window.localStorage.setItem(printPrefix+key,html);
 const target=reserved||window.open(`/print-document?key=${encodeURIComponent(key)}`,'_blank','width=900,height=850');
 if(!target){window.localStorage.removeItem(printPrefix+key);alert('Allow pop-ups to print this document.');return;}
 target.name=printPrefix+key;
 if(!named)target.location.replace(`/print-document?key=${encodeURIComponent(key)}`);
}
export function printInvoice(r:Row, reserved?:Window|null, data?:Record<string,Record<string,unknown>[]>) {
 const patient=data?.patients?.find(p=>p.id===r.patient_id), appointment=data?.appointments?.find(a=>a.id===r.appointment_id);
 r={...r,patient_number:r.patient_number||patient?.number,phone:r.phone||patient?.phone,patient_age:r.patient_age??patient?.age,gender:r.gender||patient?.gender,doctor:r.doctor||appointment?.doctor||clinicProfile.doctor};
 const rawDate=String(r.date||r.created_at||'').slice(0,10);const date=/^\d{4}-\d{2}-\d{2}$/.test(rawDate)&&Number.isFinite(Date.parse(rawDate))?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(rawDate+'T12:00:00Z')):rawDate;
 const logo=`<svg width="65" height="65" viewBox="-160 -160 320 320" aria-label="Skinuvia logo"><path d="${wing}" fill="#276b98"/><path d="${wing}" transform="scale(-1 1)" fill="#276b98"/></svg>`;
 const items=r.items||[{description:String(r.service||'Clinical service'),quantity:1,price:Number(r.total||0)}];
 const total=items.reduce((n,l)=>n+l.quantity*l.price,0),net=total-Number(r.discount||0);
 const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(r.number||'New invoice')} | Skinuvia</title><style>@page{size:auto;margin:10mm}*{box-sizing:border-box}html,body{width:auto;min-width:0;background:#fff}body{font:14px Arial;color:#205779;margin:0;padding:12px}header{display:flex;justify-content:space-between;gap:18px;border-bottom:3px solid #276b98;padding-bottom:24px}h1{font:32px Georgia;margin:0}h2{font-size:18px}small{color:#687b73}table{width:100%;table-layout:auto;border-collapse:collapse;margin:28px 0}thead{display:table-header-group}tr{break-inside:avoid}th,td{text-align:left;padding:12px 8px;border-bottom:1px solid #dce5e0;overflow-wrap:anywhere}th{background:#eef5f1}.right{text-align:right}.totals{margin-left:auto;width:min(320px,100%);line-height:2}.totals div{display:flex;justify-content:space-between;gap:16px}.sum{border-top:2px solid #276b98;font-weight:bold}footer{margin-top:50px;border-top:1px solid #ddd;padding-top:18px;color:#687b73;font-size:12px}button{padding:12px;background:#276b98;color:white;border:0;border-radius:8px}@media print{html,body{width:auto!important;min-width:0!important}body{padding:0}button{display:none}header,footer,.totals{break-inside:avoid}}</style></head><body><button onclick="window.print()">Print / Save as PDF</button><header><div><div style="display:flex;align-items:center;gap:10px">${logo}<div><h1>SKINUVIA</h1><b>THE SKIN CLINIC</b></div></div><h2 style="font: bold 25px Georgia;margin-bottom:6px">${escape(r.doctor)}</h2><b>${escape(r.doctor===clinicProfile.doctor||r.doctor==='Dr. Aamina Iqbal'?clinicProfile.qualifications:'')}</b><p style="margin-top:6px">${escape(r.doctor===clinicProfile.doctor||r.doctor==='Dr. Aamina Iqbal'?clinicProfile.designation:'')}</p></div><div><h2>${r.vendor_id?'Purchase invoice':r.kind==='sales'?'Pharmacy receipt':'Clinical invoice'}</h2><small>${escape(r.number||'New invoice')}<br>${escape(date)}<br>${escape(r.state==='Voided'?'Cancelled':r.status||'')}</small></div></header><p><b>${r.vendor_id?'Vendor':'Patient'}:</b> ${escape(r.patient_name||r.vendor_name||'')}</p>${!r.vendor_id?`<p><b>MR No:</b> ${escape(r.patient_number||'Not linked')} &nbsp; <b>Phone:</b> ${escape(r.phone||'—')}</p><p><b>Age:</b> ${escape(r.patient_age??'—')} &nbsp; <b>Gender:</b> ${escape(r.gender||'—')}</p>`:''}${r.reference?`<p>Reference: ${escape(r.reference)}</p>`:''}<table><thead><tr><th>${r.kind==='sales'?'Medicine name':'Description'}</th><th>Quantity</th><th class="right">Unit price</th><th class="right">Amount</th></tr></thead><tbody>${items.map(l=>`<tr><td>${escape(l.medicine_name||l.description)}</td><td>${escape(l.quantity)}</td><td class="right">${currency(l.price)}</td><td class="right">${currency(l.quantity*l.price)}</td></tr>`).join('')}</tbody></table><div class="totals"><div><span>Subtotal</span><b>${currency(total)}</b></div><div><span>Discount</span><b>${currency(r.discount)}</b></div><div class="sum"><span>Total</span><b>${currency(net)}</b></div><div><span>Amount paid</span><b>${currency(r.paid)}</b></div><div><span>Outstanding balance</span><b>${currency(r.state==='Voided'?0:net-Number(r.paid||0))}</b></div></div><p>Payment method: ${escape(r.method||'Cash')}</p>${r.notes?`<p>Notes: ${escape(r.notes)}</p>`:''}<footer>${escape(clinicProfile.address)}<br>Timing: ${escape(clinicProfile.hours)} · ${escape(clinicProfile.phone)}<br>Thank you for choosing Skinuvia.${r.state==='Draft'?' DRAFT — not finalized.':''}${r.state==='Voided'?' VOID — this document has been reversed.':''}</footer></body></html>`;
 const darkHtml=html.replace('color:#205779','color:#111').replaceAll('color:#687b73','color:#222');
 const printableHtml=r.kind==='sales'?darkHtml.replace(/<div><span>Outstanding balance<\/span><b>.*?<\/b><\/div>/,''):darkHtml;
 openPrintableHtml(printableHtml,reserved);
}
