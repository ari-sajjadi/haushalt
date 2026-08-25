export async function GET() {
  return Response.json({ status: "ok", service: "haushalt", timestamp: new Date().toISOString() });
}
