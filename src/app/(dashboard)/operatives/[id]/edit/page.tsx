import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/page-header'
import { OperativeForm } from '@/components/operatives/operative-form'

export default async function EditOperativePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const orgId = process.env.NEXT_PUBLIC_ORG_ID!

  const [{ data: operative }, { data: tradeCategories }] = await Promise.all([
    supabase
      .from('operatives')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single(),

    supabase
      .from('trade_categories')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('is_active', true)
      .order('name'),
  ])

  if (!operative) notFound()

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <PageHeader
        title={`Edit — ${operative.first_name} ${operative.last_name}`}
        description={operative.reference_number ?? undefined}
      />
      <OperativeForm
        mode="edit"
        operativeId={id}
        tradeCategories={tradeCategories ?? []}
        defaultValues={{
          first_name: operative.first_name,
          last_name: operative.last_name,
          phone: operative.phone ?? '',
          email: operative.email ?? '',
          status: operative.status ?? 'prospect',
          labour_type: operative.labour_type ?? 'blue_collar',
          date_of_birth: operative.date_of_birth ?? '',
          ni_number: operative.ni_number ?? '',
          nationality: operative.nationality ?? '',
          preferred_language: operative.preferred_language ?? '',
          address_line1: operative.address_line1 ?? '',
          address_line2: operative.address_line2 ?? '',
          city: operative.city ?? '',
          county: operative.county ?? '',
          postcode: operative.postcode ?? '',
          trade_category_id: operative.trade_category_id ?? '',
          day_rate: operative.day_rate != null ? String(operative.day_rate) : '',
          charge_rate: (operative as Record<string, unknown>).charge_rate != null ? String((operative as Record<string, unknown>).charge_rate) : '',
          experience_years: operative.experience_years != null ? String(operative.experience_years) : '',
          source: operative.source ?? '',
          rtw_type: operative.rtw_type ?? '',
          rtw_verified: operative.rtw_verified ?? false,
          rtw_expiry: operative.rtw_expiry ?? '',
          rtw_share_code: operative.rtw_share_code ?? '',
          cscs_card_type: operative.cscs_card_type ?? '',
          cscs_card_number: operative.cscs_card_number ?? '',
          cscs_expiry: operative.cscs_expiry ?? '',
          next_of_kin_name: operative.next_of_kin_name ?? '',
          next_of_kin_phone: operative.next_of_kin_phone ?? '',
          wtd_opt_out: operative.wtd_opt_out ?? false,
          medical_notes: operative.medical_notes ?? '',
          other_certifications: operative.other_certifications ?? '',
          notes: operative.notes ?? '',
          grade: operative.grade ?? '',
          hourly_rate: operative.hourly_rate != null ? String(operative.hourly_rate) : '',
          start_date: operative.start_date ?? '',
          bank_sort_code: operative.bank_sort_code ?? '',
          bank_account_number: operative.bank_account_number ?? '',
          utr_number: operative.utr_number ?? '',
          cscs_card_title: operative.cscs_card_title ?? '',
          cscs_card_description: operative.cscs_card_description ?? '',
          gender: operative.gender ?? '',
          machine_operator: operative.machine_operator ?? false,
          engagement_method: operative.engagement_method ?? '',
          agency_name: operative.agency_name ?? '',
          trading_name: operative.trading_name ?? '',
          min_acceptable_rate: operative.min_acceptable_rate != null ? String(operative.min_acceptable_rate) : '',
          gov_rtw_checked: operative.gov_rtw_checked ?? false,
        }}
      />
    </div>
  )
}
