import {env} from '@/lib/runtime-env';
export const dynamic='force-dynamic';
export async function GET(){try{await env.DB!.prepare('SELECT 1 AS ready').first();return Response.json({status:'ok',prescriptionPdfLayout:'preprinted-v2'})}catch{return Response.json({status:'unavailable'},{status:503})}}
