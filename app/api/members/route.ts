import { addMember, identityFrom } from "@/lib/data";
import { z } from "zod";
const schema=z.object({name:z.string().trim().min(2).max(80),email:z.string().email().max(160)});
export async function POST(request:Request){const parsed=schema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return Response.json({error:"Name oder E-Mail ist ungültig."},{status:400});try{await addMember(identityFrom(request),parsed.data);return Response.json({ok:true},{status:201});}catch{return Response.json({error:"Mitglied konnte nicht hinzugefügt werden."},{status:409});}}
