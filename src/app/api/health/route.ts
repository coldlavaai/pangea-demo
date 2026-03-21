export const runtime = 'edge'
export async function GET() { return Response.json({ ok: true, org: process.env.NEXT_PUBLIC_ORG_ID }) }
