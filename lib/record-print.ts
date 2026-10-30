type Row=Record<string,unknown>;

export function appointmentPrintEntries(row:Row):[string,unknown][] {
 return [
  ['MR Number',row.patient_number||'—'],
  ['Patient Name',row.patient_name||'—'],
  ['Phone Number',row.phone||'—'],
  ['Service / Treatment',row.service||row.treatment||'—'],
  ['Appointment Date',row.appointment_date||'—'],
  ['Appointment Time',row.appointment_time||'—'],
  ['Price',`PKR ${Number(row.price||0).toLocaleString('en-PK')}`],
  ['Created At',row.created_at||'—']
 ];
}
