import { dashboard, identityFrom, updateSettings } from "@/lib/data";
import { z } from "zod";
export async function GET(request: Request) { try { return Response.json(await dashboard(identityFrom(request))); } catch (error) { console.error("dashboard_failed", error); return Response.json({ error: "Dashboard konnte nicht geladen werden." }, { status: 500 }); } }
const settingsSchema = z.object({ incomeCents: z.number().int().min(0).max(100_000_000_00), budgetCents: z.number().int().min(0).max(100_000_000_00) });
export async function PATCH(request: Request) { const parsed=settingsSchema.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return Response.json({error:"Ungültige Budgetwerte."},{status:400}); await updateSettings(identityFrom(request),parsed.data); return Response.json({ok:true}); }
