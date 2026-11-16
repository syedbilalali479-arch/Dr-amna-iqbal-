"use client";
import {useCallback,useEffect,useState} from 'react';
import {CheckCircle2,FileText,Image as ImageIcon,RefreshCw} from 'lucide-react';

type Doc={id:string;phone:string;patient_name:string;kind:string;mime_type:string;file_name:string;caption:string;size:number;status:string;error:string|null;reviewed_at:string|null;reviewed_by:string|null;created_at:string};
const when=(v:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Karachi',day:'2-digit',month:'2-digit',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(v.replace(' ','T')+(v.includes('Z')?'':'Z')));
const size=(n:number)=>n>1048576?`${(n/1048576).toFixed(1)} MB`:n?`${Math.max(1,Math.round(n/1024))} KB`:'—';

export function PatientDocuments(){
 const [docs,setDocs]=useState<Doc[]>([]),[filter,setFilter]=useState<'New'|'all'>('New'),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{try{const r=await fetch('/api/patient-documents',{cache:'no-store'});const j=await r.json() as {documents?:Doc[];error?:string};if(!r.ok)throw new Error(j.error||'Unable to load');setDocs(j.documents||[]);setError('')}catch(e){setError(e instanceof Error?e.message:'Unable to load')}finally{setLoading(false)}},[]);
 useEffect(()=>{const t=setTimeout(()=>void load(),0);return()=>clearTimeout(t)},[load]);
 const mark=async(doc:Doc,status:'New'|'Reviewed')=>{const r=await fetch('/api/patient-documents',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:doc.id,status})});if(r.ok)await load();else setError(((await r.json()) as {error?:string}).error||'Update failed')};
 const shown=docs.filter(d=>filter==='all'||d.status==='New'),pending=docs.filter(d=>d.status==='New').length;
 return <>
  <div className="pageTitle"><div><span>WHATSAPP · FOR THE DOCTOR</span><h1>Reports & Prescriptions</h1><p>Reports, prescriptions and photos patients send on WhatsApp. {pending} waiting for review.</p></div><button className="secondary" onClick={()=>{setLoading(true);void load()}} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
  <div className="accountModeTabs" role="group" aria-label="Filter documents"><button type="button" className={filter==='New'?'active':''} onClick={()=>setFilter('New')}>New ({pending})</button><button type="button" className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>All ({docs.length})</button></div>
  {error&&<div className="notice" role="alert">{error}</div>}
  <section className="panel tablePanel"><div className="tableWrap"><table><thead><tr><th>Received</th><th>Patient</th><th>Mobile</th><th>File</th><th>Patient&apos;s message</th><th>Status</th><th>Actions</th></tr></thead><tbody>
   {shown.map(d=><tr key={d.id}><td>{when(d.created_at)}</td><td><b>{d.patient_name}</b></td><td>{d.phone||'—'}</td>
    <td>{d.kind==='image'?<ImageIcon size={14}/>:<FileText size={14}/>} {d.file_name} <small>({size(d.size)})</small>{d.error&&<div className="dangerText"><small>Not downloaded: {d.error}</small></div>}</td>
    <td>{d.caption||'—'}</td>
    <td><i className="pill">{d.status==='Reviewed'?`Reviewed${d.reviewed_by?' · '+d.reviewed_by:''}`:'New'}</i></td>
    <td><div className="rowActions">{d.size>0&&<a className="docOpen" href={`/api/patient-documents/${encodeURIComponent(d.id)}`} target="_blank" rel="noopener noreferrer">Open</a>}{d.status==='New'?<button type="button" className="primary" onClick={()=>void mark(d,'Reviewed')}><CheckCircle2 size={13}/> Mark reviewed</button>:<button type="button" onClick={()=>void mark(d,'New')}>Mark new</button>}</div></td></tr>)}
  </tbody></table>{!shown.length&&<div className="empty"><FileText/><b>{loading?'Loading…':filter==='New'?'No new reports or prescriptions':'Nothing received yet'}</b><span>When a patient sends a report, prescription or photo on WhatsApp, it appears here.</span></div>}</div></section>
 </>;
}
