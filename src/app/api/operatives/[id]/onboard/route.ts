import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { triggerWorkflow } from '@/lib/workflows/engine'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: operativeId } = await params

  // Auth check
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = process.env.NEXT_PUBLIC_ORG_ID!
  const supabase = createServiceClient() as any // eslint-disable-line @typescript-eslint/no-explicit-any

  // Get the public user ID
  const { data: publicUser } = await supabase
    .from('users')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!publicUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Get operative
  const { data: operative, error: opError } = await supabase
    .from('operatives')
    .select('id, first_name, last_name, phone, status')
    .eq('id', operativeId)
    .eq('organization_id', orgId)
    .single()

  if (opError || !operative) {
    return NextResponse.json({ error: 'Operative not found' }, { status: 404 })
  }

  // Validate minimum data
  if (!operative.first_name || !operative.phone) {
    return NextResponse.json(
      { error: 'Operative must have at least a name and phone number to start onboarding' },
      { status: 422 }
    )
  }

  // Check for existing active smart_onboarding workflow
  const { data: existingRuns } = await supabase
    .from('workflow_runs')
    .select('id')
    .eq('organization_id', orgId)
    .eq('workflow_type', 'smart_onboarding')
    .eq('status', 'active')

  if (existingRuns?.length) {
    // Check if any target this operative
    const runIds = existingRuns.map((r: any) => r.id) // eslint-disable-line @typescript-eslint/no-explicit-any
    const { data: existingTargets } = await supabase
      .from('workflow_targets')
      .select('id')
      .in('workflow_run_id', runIds)
      .eq('operative_id', operativeId)
      .in('status', ['pending', 'contacted', 'responded'])

    if (existingTargets?.length) {
      return NextResponse.json(
        { error: 'Onboarding is already in progress for this operative' },
        { status: 409 }
      )
    }
  }

  // Trigger the smart_onboarding workflow
  try {
    const result = await triggerWorkflow({
      type: 'smart_onboarding',
      config: { operative_ids: [operativeId] },
      userId: publicUser.id,
      conversationId: null,
    })

    return NextResponse.json({
      success: true,
      run_id: result.run_id,
      summary: result.summary,
    })
  } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.error('[onboard] Failed to trigger workflow:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to start onboarding' },
      { status: 500 }
    )
  }
}
