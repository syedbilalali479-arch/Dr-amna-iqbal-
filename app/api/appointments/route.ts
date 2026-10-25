import {env} from '@/lib/runtime-env';
import {getChatGPTUser} from '../../chatgpt-auth';
import {saveAppointment,type BookingRequest} from '../../../lib/appointment-booking';
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Authentication required'},{status:401});
 try{const input=await request.json() as BookingRequest;return Response.json(await saveAppointment(env.DB!,user.userId,input));}
 catch(e){let message=e instanceof Error?e.message:'Unable to save booking';if(message.includes('appointment_token_unique')||message.includes('appointments.clinic_id, appointments.appointment_date, appointments.token'))message='This token is already assigned on that date. Choose another token or leave it blank.';if(message.includes('commerce_appointment_invoice'))message='This appointment already has an invoice. Refresh and open the existing invoice.';if(message.includes('CHECK constraint'))message='This appointment changed while saving. Refresh and try again.';return Response.json({error:message},{status:400});}
}
