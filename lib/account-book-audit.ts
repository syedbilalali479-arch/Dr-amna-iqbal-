export type AuditMode='day'|'month'|'range'|'all';

export type AuditPeriod={mode:AuditMode;day:string;month:string;from:string;to:string};

export function clinicDate(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const value=(type:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===type)?.value||'';
 return `${value('year')}-${value('month')}-${value('day')}`;
}

export function dateInAuditPeriod(date:string,period:AuditPeriod){
 if(!date)return false;
 if(period.mode==='day')return date===period.day;
 if(period.mode==='month')return Boolean(period.month)&&date.startsWith(period.month);
 if(period.mode==='range')return (!period.from||date>=period.from)&&(!period.to||date<=period.to);
 return true;
}

const readableDate=(value:string)=>value?new Intl.DateTimeFormat('en-PK',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${value}T12:00:00`)):'Not selected';

export function auditPeriodLabel(period:AuditPeriod){
 if(period.mode==='day')return readableDate(period.day);
 if(period.mode==='month')return period.month?new Intl.DateTimeFormat('en-PK',{month:'long',year:'numeric'}).format(new Date(`${period.month}-01T12:00:00`)):'Month not selected';
 if(period.mode==='range')return `${readableDate(period.from)} to ${readableDate(period.to)}`;
 return 'All recorded dates';
}
