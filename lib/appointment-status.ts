/** Appointment status follows the bill: Confirmed only once a finalized bill has a payment. */
export const AWAITING_PAYMENT='Awaiting Payment';
/** Statuses that are decided by payment. Anything else (Completed, Cancelled, No-show, Rescheduled) is final and kept. */
export const PAYMENT_DRIVEN_STATUSES=['Pending','Confirmed','Arrived','Waiting','In Consultation',AWAITING_PAYMENT];
export const isPaymentDrivenStatus=(status:unknown)=>!status||PAYMENT_DRIVEN_STATUSES.includes(String(status));
export function statusForPayment(current:unknown,paymentStatus:unknown){
 if(!isPaymentDrivenStatus(current))return String(current);
 return paymentStatus==='Paid'||paymentStatus==='Partially Paid'?'Confirmed':AWAITING_PAYMENT;
}
/** SQL CASE expression keeping final statuses and deriving the rest from the bound payment status (one bind: the payment status). */
export const STATUS_FROM_PAYMENT_SQL=`CASE WHEN status IN (${PAYMENT_DRIVEN_STATUSES.map(s=>`'${s}'`).join(',')}) THEN CASE WHEN ? IN ('Paid','Partially Paid') THEN 'Confirmed' ELSE '${AWAITING_PAYMENT}' END ELSE status END`;
export function statusLabel(status:unknown,hasBill:boolean){
 if(status!==AWAITING_PAYMENT)return String(status??'—');
 return hasBill?'Bill made · Waiting for payment':'Bill not made · Waiting for payment';
}
