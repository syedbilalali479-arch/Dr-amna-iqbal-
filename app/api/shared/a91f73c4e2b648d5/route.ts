import {readFile} from 'node:fs/promises';
import path from 'node:path';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(){
 const file=await readFile(path.join(process.cwd(),'public','shared','appointment-audit-3-nov-2026-a91f73c4e2b648d5.pdf'));
 return new Response(file,{headers:{
  'Content-Type':'application/pdf',
  'Content-Disposition':'inline; filename="Skinuvia-Appointment-Audit-3-Nov-2026.pdf"',
  'Cache-Control':'private, no-store',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
 }});
}
