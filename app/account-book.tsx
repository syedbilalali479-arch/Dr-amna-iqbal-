"use client";
import {useState} from 'react';
import {CalendarDays,ReceiptText,TrendingDown,TrendingUp,WalletCards} from 'lucide-react';
import {vendorBalance} from '../lib/commerce';
import {auditPeriodLabel,clinicDate,dateInAuditPeriod,type AuditMode} from '../lib/account-book-audit';

type Row=Record<string,unknown>;
type Data=Record<string,Row[]>;
const money=(value:unknown)=>`PKR ${Number(value||0).toLocaleString('en-PK',{maximumFractionDigits:2})}`;
const rowDate=(row:Row)=>String(row.date||row.created_at||'').slice(0,10);
const modes:{value:AuditMode;label:string}[]=[{value:'day',label:'Daily'},{value:'month',label:'Monthly'},{value:'range',label:'Custom dates'},{value:'all',label:'All time'}];

export function AccountBook({data}:{data:Data}){
 const today=clinicDate(),[mode,setMode]=useState<AuditMode>('day'),[day,setDay]=useState(today),[month,setMonth]=useState(today.slice(0,7)),[from,setFrom]=useState(today),[to,setTo]=useState(today);
 const period={mode,day,month,from,to},within=(row:Row)=>dateInAuditPeriod(rowDate(row),period);
 // Appointment money belongs to the day of the appointment, so the book matches that day's bookings.
 const visitDate=(row:Row)=>String(row.appointment_date||rowDate(row)).slice(0,10),withinVisit=(row:Row)=>dateInAuditPeriod(visitDate(row),period);
 const appointments=(data.invoices||[]).filter(row=>row.state==='Finalized'&&Boolean(row.appointment_id)&&!row.appointment_deleted&&!row.appointment_missing&&withinVisit(row));
 const appointmentById=new Map((data.appointments||[]).map(row=>[String(row.id),row]));
 const visitOf=(bill:Row)=>{const visit=appointmentById.get(String(bill.appointment_id||''));if(bill.appointment_deleted||bill.appointment_missing)return {text:'Deleted appointment',odd:'deleted'};if(!visit)return {text:'Older appointment',odd:''};const date=String(visit.appointment_date||''),status=String(visit.status||'');const odd=['Cancelled','No-show'].includes(status)?status.toLowerCase():'';return {text:`${String(visit.number||visit.id)} · ${date} · ${status}`,odd};};
 const listedVisits=(data.appointments||[]).filter(row=>dateInAuditPeriod(String(row.appointment_date||''),period));
 const unusualBills=appointments.map(row=>({row,visit:visitOf(row)})).filter(item=>item.visit.odd);
 const billedVisitIds=new Set((data.invoices||[]).filter(row=>row.state==='Finalized').map(row=>String(row.appointment_id||'')));
 const unbilledVisits=listedVisits.filter(row=>!billedVisitIds.has(String(row.id)));
 const sales=(data.sales||[]).filter(row=>row.state==='Finalized'&&within(row));
 const purchases=(data.purchases||[]).filter(row=>row.state==='Finalized'&&within(row));
 const expenses=(data.expenses||[]).filter(row=>within(row));
 const vendorPayments=(data.vendor_payments||[]).filter(row=>within(row));
 const appointmentIncome=appointments.reduce((sum,row)=>sum+Number(row.paid||0),0);
 const medicineIncome=sales.reduce((sum,row)=>sum+Number(row.paid||0),0);
 const purchaseOutflow=purchases.reduce((sum,row)=>sum+Number(row.paid||0),0);
 const generalExpenses=expenses.reduce((sum,row)=>sum+Number(row.total_amount||0),0);
 const vendorPaid=vendorPayments.reduce((sum,row)=>sum+Number(row.amount||0),0);
 const moneyIn=appointmentIncome+medicineIncome,moneyOut=purchaseOutflow+vendorPaid+generalExpenses,netCash=moneyIn-moneyOut;
 const customerOutstanding=[...appointments,...sales].reduce((sum,row)=>sum+Number(row.balance||0),0);
 const companyOutstanding=(data.vendors||[]).map(vendor=>({vendor,balance:vendorBalance(vendor,data.purchases||[],data.vendor_payments||[])})).filter(item=>item.balance>0).sort((a,b)=>b.balance-a.balance);
 const vendorOutstanding=companyOutstanding.reduce((sum,item)=>sum+item.balance,0);
 const entries=([...appointments.map(row=>({...row,date:visitDate(row),bookType:'Appointment revenue',accountName:row.patient_name,visit:visitOf(row).text,income:Number(row.paid||0),outflow:0})),...sales.map(row=>({...row,bookType:'Medicine sale',accountName:row.patient_name,income:Number(row.paid||0),outflow:0})),...purchases.map(row=>({...row,bookType:'Medicine purchase',accountName:row.vendor_name,income:0,outflow:Number(row.paid||0)})),...vendorPayments.map(row=>({...row,bookType:'Vendor payment',accountName:row.vendor_name,income:0,outflow:Number(row.amount||0)})),...expenses.map(row=>({...row,bookType:'General expense',accountName:row.expense_name,income:0,outflow:Number(row.total_amount||0)}))] as Row[]).sort((a,b)=>rowDate(b).localeCompare(rowDate(a))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
 const breakdown=[
  {label:'Appointments',count:appointments.length,income:appointmentIncome,outflow:0},
  {label:'Medicine sales',count:sales.length,income:medicineIncome,outflow:0},
  {label:'Medicine purchases paid',count:purchases.length,income:0,outflow:purchaseOutflow},
  {label:'Vendor payments',count:vendorPayments.length,income:0,outflow:vendorPaid},
  {label:'General expenses',count:expenses.length,income:0,outflow:generalExpenses},
 ];
 const label=auditPeriodLabel(period);
 return <>
  <div className="pageTitle"><div><span>DOCTOR ONLY · FINANCIAL AUDIT</span><h1>Account Book</h1><p>See exactly where money came from and where it went.</p></div><button className="primary" onClick={()=>window.print()}><ReceiptText/> Print financial audit</button></div>
  <section className="accountFilters panel" aria-label="Audit period">
   <div className="accountModeTabs" role="group" aria-label="Choose audit period">{modes.map(option=><button type="button" className={mode===option.value?'active':''} aria-pressed={mode===option.value} key={option.value} onClick={()=>setMode(option.value)}>{option.label}</button>)}</div>
   {mode==='day'&&<label><span>Audit date</span><input type="date" value={day} onChange={event=>setDay(event.target.value)}/></label>}
   {mode==='month'&&<label><span>Audit month</span><input type="month" value={month} onChange={event=>setMonth(event.target.value)}/></label>}
   {mode==='range'&&<><label><span>From date</span><input type="date" value={from} max={to||undefined} onChange={event=>setFrom(event.target.value)}/></label><label><span>To date</span><input type="date" value={to} min={from||undefined} onChange={event=>setTo(event.target.value)}/></label></>}
   <button type="button" className="todayAudit" onClick={()=>{setMode('day');setDay(clinicDate())}}><CalendarDays/> Today</button>
  </section>
  <section className="auditOverview panel">
   <div className="auditPeriodTitle"><span>FINANCIAL AUDIT PERIOD</span><h2>{label}</h2><p>{entries.length} recorded transaction{entries.length===1?'':'s'} in this period</p></div>
   <div className="auditTotals">
    <article className="moneyIn"><TrendingUp/><div><small>Total money in</small><b>{money(moneyIn)}</b><span>Appointments + medicine sales</span></div></article>
    <article className="moneyOut"><TrendingDown/><div><small>Total money out</small><b>{money(moneyOut)}</b><span>Purchases + vendor payments + general expenses</span></div></article>
    <article className={netCash<0?'moneyOut':'netCash'}><WalletCards/><div><small>Net cash</small><b>{money(netCash)}</b><span>Money in minus money out</span></div></article>
   </div>
  </section>
  <section className="panel auditBreakdown">
   <div className="panelTitle"><div><span>SOURCE BREAKDOWN</span><h2>Where the money came from and went</h2></div></div>
   <div className="tableWrap"><table><thead><tr><th>Source</th><th>Transactions</th><th>Money in</th><th>Money out</th></tr></thead><tbody>{breakdown.map(row=><tr key={row.label}><td><b>{row.label}</b></td><td>{row.count}</td><td className="bookIncome">{row.income?money(row.income):'—'}</td><td className="bookOutflow">{row.outflow?money(row.outflow):'—'}</td></tr>)}</tbody><tfoot><tr><td><b>Period total</b></td><td>{entries.length}</td><td className="bookIncome"><b>{money(moneyIn)}</b></td><td className="bookOutflow"><b>{money(moneyOut)}</b></td></tr></tfoot></table></div>
  </section>
  <section className="panel auditBreakdown appointmentReconcile"><div className="panelTitle"><div><span>APPOINTMENT CHECK</span><h2>Appointments list vs Account Book</h2><p>{listedVisits.length} appointment{listedVisits.length===1?'':'s'} in the Appointments list for {label} (including cancelled) · {appointments.length} paid/billed appointment{appointments.length===1?'':'s'} counted here · {unbilledVisits.length} without a bill.</p></div></div>
   {unusualBills.length?<div className="tableWrap"><table><thead><tr><th>Bill</th><th>Patient</th><th>Appointment</th><th>Why it differs</th><th>Paid</th></tr></thead><tbody>{unusualBills.map(({row,visit})=><tr key={String(row.id)}><td>{String(row.number||row.id)}</td><td>{String(row.patient_name||'—')}</td><td>{visit.text}</td><td>{`Appointment is ${visit.odd} but its bill is still active`}</td><td className="bookIncome">{money(row.paid)}</td></tr>)}</tbody></table></div>:<p className="empty"><span>Every bill counted here belongs to an active appointment in this period.</span></p>}
   {unbilledVisits.length>0&&<p><b>Appointments without a bill:</b> {unbilledVisits.map(row=>`${String(row.number||row.id)} ${String(row.patient_name||'')} (${String(row.status||'')})`).join(', ')}</p>}
  </section>
  <div className="accountCards accountOutstandingCards"><article><small>Customer outstanding (period)</small><b>{money(customerOutstanding)}</b></article><article className="outflow"><small>Vendor outstanding (current)</small><b>{money(vendorOutstanding)}</b></article></div>
  <section className="panel tablePanel auditLedger"><div className="panelTitle"><div><span>COMPLETE AUDIT TRAIL</span><h2>Transactions · {label}</h2></div></div><div className="tableWrap"><table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Patient / Vendor / Expense</th><th>Appointment</th><th>Status</th><th>Income</th><th>Outflow</th></tr></thead><tbody>{entries.map(row=><tr key={`${String(row.bookType)}-${String(row.id)}`}><td>{rowDate(row)}</td><td><i className="pill">{String(row.bookType)}</i></td><td>{String(row.number||row.id||'—')}</td><td>{String(row.accountName||'—')}</td><td>{String(row.visit||'—')}</td><td>{String(row.status||row.state||'Recorded')}</td><td className="bookIncome">{row.income?money(row.income):'—'}</td><td className="bookOutflow">{row.outflow?money(row.outflow):'—'}</td></tr>)}</tbody></table>{!entries.length&&<div className="empty"><b>No account entries for {label}</b><span>Choose another day, month or custom date range.</span></div>}</div></section>
  <section className="panel tablePanel vendorOutstandingPanel"><div className="panelTitle"><div><span>CURRENT BALANCES</span><h2>Company-wise outstanding</h2><p>Current vendor balance snapshot; it is not limited by the audit period.</p></div></div><div className="tableWrap"><table><thead><tr><th>Company</th><th>Outstanding</th></tr></thead><tbody>{companyOutstanding.map(({vendor,balance})=><tr key={String(vendor.id)}><td>{String(vendor.company_name||vendor.name||'—')}</td><td className="bookOutflow">{money(balance)}</td></tr>)}</tbody></table>{!companyOutstanding.length&&<div className="empty"><b>No vendor outstanding</b><span>All company balances are clear.</span></div>}</div></section>
 </>;
}
