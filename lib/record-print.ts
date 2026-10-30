type Row=Record<string,unknown>;

const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]!));
export function formatAppointmentDate(value:unknown) {
 const raw=String(value||'').slice(0,10),parts=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
 return parts?`${parts[2]}/${parts[3]}/${parts[1]}`:raw||'—';
}

export function appointmentPrintEntries(row:Row):[string,unknown][] {
 return [
  ['MR Number',row.patient_number||'—'],
  ['Patient Name',row.patient_name||'—'],
  ['Phone Number',row.phone||'—'],
  ['Service / Treatment',row.service||row.treatment||'—'],
  ['Appointment Date',formatAppointmentDate(row.appointment_date)],
  ['Appointment Time',row.appointment_time||'—'],
  ['Price',`PKR ${Number(row.price||0).toLocaleString('en-PK')}`],
  ['Created At',row.created_at||'—']
 ];
}

export function appointmentPrintHtml(row:Row,printedAt:string) {
 const entries=appointmentPrintEntries(row);
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Skinuvia Appointment</title><style>@page{margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000}body{width:72mm;max-width:72mm;padding:4mm;font:600 11px/1.35 Arial,sans-serif}h1{font:900 21px Georgia;margin:0;text-align:center;letter-spacing:.5px}.sub{text-align:center;border-bottom:2px solid #000;padding:2px 0 8px;margin-bottom:4px;font-size:10px}table{width:100%;border-collapse:collapse}td{padding:5px 1px;border-bottom:1px solid #777;vertical-align:top;overflow-wrap:anywhere}td:first-child{width:43%;font-weight:800}td:last-child{font-weight:700}.foot{text-align:center;margin-top:8px;padding-top:6px;border-top:2px solid #000;font-size:9px}button{width:100%;margin-bottom:8px;padding:8px;background:#000;color:#fff;border:0}@media print{body{width:72mm;max-width:72mm;padding:3mm}button{display:none}}</style></head><body><button onclick="window.print()">Print</button><h1>SKINUVIA</h1><div class="sub">THE SKIN CLINIC</div><table>${entries.map(([label,value])=>`<tr><td>${escape(label)}</td><td>${escape(value)}</td></tr>`).join('')}</table><div class="foot">Printed ${escape(printedAt)}</div></body></html>`;
}
