"use client";
import {useEffect,useState} from 'react';
import {KeyRound,ShieldCheck,UserPlus,UsersRound,X} from 'lucide-react';
type Staff={id:string;username:string;display_name:string;active:number;created_at:string};
async function fetchStaff(signal?:AbortSignal){
 const response=await fetch('/api/staff',{cache:'no-store',signal}),body=await response.json() as {accounts:Staff[];error?:string};
 if(!response.ok)throw new Error(body.error||'Unable to load staff accounts.');return body.accounts;
}
export function StaffAccessSettings(){
 const [accounts,setAccounts]=useState<Staff[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [dialog,setDialog]=useState<'create'|Staff|null>(null),[username,setUsername]=useState(''),[name,setName]=useState(''),[password,setPassword]=useState('');
 const load=async(signal?:AbortSignal)=>{
  try{setAccounts(await fetchStaff(signal));setError('')}
  catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'Unable to load staff accounts.')}
  finally{if(!signal?.aborted)setLoading(false)}
 };
 useEffect(()=>{
  const controller=new AbortController();
  void fetchStaff(controller.signal).then(rows=>{if(!controller.signal.aborted)setAccounts(rows)}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load staff accounts.')}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return()=>controller.abort();
 },[]);
 const open=(account:'create'|Staff)=>{setDialog(account);setPassword('');setUsername('');setName('');setError('');setNotice('')};
 const update=async(payload:Record<string,unknown>,message:string)=>{
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{const response=await fetch('/api/staff',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),body=await response.json() as {accounts:Staff[];error?:string};if(!response.ok)throw new Error(body.error||'Unable to save staff account.');setAccounts(body.accounts);setDialog(null);setPassword('');setNotice(message)}
  catch(e){setError(e instanceof Error?e.message:'Unable to save staff account.')}
  finally{setBusy(false)}
 };
 const submit=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!dialog)return;void update(dialog==='create'?{operation:'create',username,display_name:name,password}:{operation:'reset_password',id:dialog.id,password},dialog==='create'?'Receptionist account created. Share its username and password privately.':'Password updated. Previous sessions have been signed out.')};
 return <section className="panel staffAccess" aria-labelledby="staff-access-title">
  <div className="staffHeading"><div><span className="staffEyebrow"><ShieldCheck size={15}/> DOCTOR / ADMIN ONLY</span><h2 id="staff-access-title">Staff access</h2><p>Separate accounts for your reception team, using the same clinic sign-in.</p></div><button className="primary" onClick={()=>open('create')} disabled={busy}><UserPlus size={15}/> Add receptionist</button></div>
  <div className="staffPermissions"><UsersRound size={19}/><div><b>Reception desk workspace</b><p>Appointments, patient records, prescriptions, billing, inventory and other daily operations.</p><small>Overview, Analytics, Settings, AI Brain and WhatsApp AI Inbox are reserved for Doctor / Admin.</small></div></div>
  {error&&!dialog&&<div className="notice" role="alert">{error}<button type="button" className="secondary" onClick={()=>{setLoading(true);setError('');void load()}}>Retry</button></div>}
  {notice&&<p className="staffSuccess" role="status">{notice}</p>}
  {loading?<p className="staffEmpty" role="status">Loading staff accounts...</p>:accounts.length?<div className="tableWrap"><table className="staffTable"><thead><tr><th>Staff member</th><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>{accounts.map(account=><tr key={account.id}><td><b>{account.display_name}</b></td><td>{account.username}</td><td>Receptionist</td><td><span className="pill">{account.active?'Active':'Disabled'}</span></td><td><div className="staffRowActions"><button disabled={busy} onClick={()=>open(account)}><KeyRound size={13}/> Reset password</button><button disabled={busy} className={account.active?'dangerText':''} onClick={()=>void update({operation:'set_active',id:account.id,active:!account.active},account.active?'Account disabled. Active sessions have been signed out.':'Account enabled. The receptionist can sign in again.')}>{account.active?'Disable access':'Enable access'}</button></div></td></tr>)}</tbody></table></div>:!error&&<div className="staffEmpty"><UsersRound size={25}/><b>No reception accounts yet</b><p>Add a receptionist to give your team their own workspace.</p></div>}
  {dialog&&<div className="backdrop"><section className="modal staffDialog" role="dialog" aria-modal="true" aria-labelledby="staff-dialog-title"><div className="modalHead"><div><span>STAFF ACCESS</span><h2 id="staff-dialog-title">{dialog==='create'?'Add receptionist':'Reset staff password'}</h2></div><button disabled={busy} aria-label="Close staff form" onClick={()=>{setDialog(null);setPassword('');setError('')}}><X/></button></div><form onSubmit={submit}><fieldset disabled={busy}>{dialog==='create'?<><label>Staff name<input required maxLength={100} autoComplete="off" value={name} onChange={e=>setName(e.target.value)} placeholder="Receptionist name" autoFocus/></label><label>Username<input required minLength={3} maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,63}" autoCapitalize="none" autoComplete="off" value={username} onChange={e=>setUsername(e.target.value)} placeholder="e.g. reception"/></label></>:<p>Set a new password for <b>{dialog.display_name}</b> ({dialog.username}). This signs out all their current sessions.</p>}<label>{dialog==='create'?'Password':'New password'}<input type="password" required minLength={12} maxLength={256} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/><small>At least 12 characters. Share credentials privately.</small></label>{error&&<div className="notice" role="alert">{error}</div>}<div className="modalActions"><button type="button" onClick={()=>{setDialog(null);setPassword('');setError('')}}>Cancel</button><button className="primary" type="submit">{busy?'Saving...':dialog==='create'?'Create account':'Update password'}</button></div></fieldset></form></section></div>}
 </section>;
}
