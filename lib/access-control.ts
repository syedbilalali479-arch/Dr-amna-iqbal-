export type ClinicRole='admin'|'receptionist';
export const receptionistModules=['appointments','patients','treatments','prescriptions','medicines','sales','vendors','purchases','vendor_payments','invoices','leads','followups','plans','promotions'] as const;
const adminModules=['overview','analytics','settings','conversations','patterns','learning','states','audit','staff'] as const;
export function canAccessModule(role:ClinicRole,module:string){
 if(role!=='admin'&&role!=='receptionist')return false;
 return receptionistModules.some(key=>key===module)||role==='admin'&&adminModules.some(key=>key===module);
}
export function homeModule(role:ClinicRole){return role==='admin'?'overview':'appointments';}
export function roleLabel(role:ClinicRole){return role==='admin'?'Doctor / Admin':'Receptionist';}
