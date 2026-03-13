import { createServiceClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID!

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServiceClient()

  const body = await req.json().catch(() => ({}))
  const dayRateOverride: number | null = body.day_rate != null ? Number(body.day_rate) : null

  // Fetch current operative state
  const { data: op, error: opErr } = await supabase
    .from('operatives')
    .select('day_rate, hourly_rate, grade, rate_status')
    .eq('id', id)
    .eq('organization_id', ORG_ID)
    .single()

  if (opErr || !op) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const dayRate = dayRateOverride ?? op.day_rate ?? 0
  const hourlyRate = Math.round((dayRate / 8) * 100) / 100

  // Get quartile from the latest rate row for the history record
  const { data: latestRate } = await supabase
    .from('operative_pay_rates')
    .select('quartile')
    .eq('operative_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const rationale = dayRateOverride
    ? `Rate confirmed at £${dayRate}/day (adjusted from £${op.day_rate}/day)`
    : `Rate confirmed at £${dayRate}/day`

  // Insert confirmed rate history row
  const { error: insertErr } = await supabase.from('operative_pay_rates').insert({
    organization_id: ORG_ID,
    operative_id: id,
    day_rate: dayRate,
    hourly_rate: hourlyRate,
    grade: op.grade,
    quartile: latestRate?.quartile ?? null,
    rate_type: 'confirmed',
    rationale,
  })

  if (insertErr) {
    console.error('[confirm-rate] insert error', insertErr)
    return NextResponse.json({ error: 'Failed to save rate' }, { status: 500 })
  }

  // Update operative
  await supabase
    .from('operatives')
    .update({ day_rate: dayRate, hourly_rate: hourlyRate, rate_status: 'confirmed' })
    .eq('id', id)

  return NextResponse.json({ success: true })
}
