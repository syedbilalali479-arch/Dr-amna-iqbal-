import { requireChatGPTUser } from "./chatgpt-auth";
import ClinicConsole from "./clinic-console";
export const dynamic="force-dynamic";
export default async function Page(){const user=await requireChatGPTUser("/");return <ClinicConsole user={{name:user.fullName??"Dr. Amna Iqbal",email:user.email}}/>}
