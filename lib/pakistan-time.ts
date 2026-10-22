const ZONE="Asia/Karachi";
export function pakistanParts(now=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit",weekday:"long",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(now).map(x=>[x.type,x.value]));
 return {date:`${p.year}-${p.month}-${p.day}`,weekday:p.weekday,time:`${p.hour}:${p.minute}`};
}
export function resolveBookingMessage(message:string,now=new Date()){
 const text=message.toLowerCase();const base=pakistanParts(now);const date=new Date(`${base.date}T12:00:00+05:00`);
 let offset=0;if(/\b(kal|tomorrow)\b/.test(text))offset=1;if(/\b(parson|day after tomorrow)\b/.test(text))offset=2;date.setUTCDate(date.getUTCDate()+offset);
 const dateOut=new Intl.DateTimeFormat("en-CA",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
 const raw=text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm|baje)?\b/);let hour=raw?Number(raw[1]):NaN;const minute=raw?.[2]??"00";const context=raw?.[3]||(/shaam|raat/.test(text)?"pm":/subah/.test(text)?"am":"");if(context==="pm"&&hour<12)hour+=12;if(context==="am"&&hour===12)hour=0;if(raw?.[3]==="baje"&&!/subah/.test(text)&&hour<8)hour+=12;
 const service=["HydraFacial","Acne Treatment","Laser Hair Reduction","PRP Therapy","Skin Consultation"].find(s=>text.includes(s.toLowerCase().split(" ")[0]))??(/skin/.test(text)?"Skin Consultation":null);
 return {date:dateOut,time:Number.isNaN(hour)?null:`${String(hour).padStart(2,"0")}:${minute}`,service,complete:Boolean(raw&&service),timezone:ZONE};
}
