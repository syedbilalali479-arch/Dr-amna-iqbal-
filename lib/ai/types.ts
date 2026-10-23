export type Intent="booking"|"price"|"cancel"|"reschedule"|"promotion"|"clinic_info"|"human"|"greeting"|"other";
export type KnownFields={patientName?:string;date?:string;time?:string;service?:string;appointmentId?:string};
export type ConversationState={currentIntent:Intent|null;pendingIntent:Intent|null;known:KnownFields;missing:string[];lastQuestion:string|null;lastAction:string|null;lastMessageHash:string|null;loopCount:number;turnCount:number;handoff:boolean};
export type Pattern={intent:Intent;phrase:string;weight:number;status?:string};
export type Classification={intent:Intent;confidence:number;route:"deterministic"|"brain"|"clarify";matched:string[]};
export type Treatment={name:string;price:number;duration?:number;booking_instructions?:string|null};
