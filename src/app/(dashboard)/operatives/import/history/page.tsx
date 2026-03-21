import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { checkImportPermission } from '@/lib/export/check-export'
import { createServiceClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { ImportHistory } from '@/components/operatives/import-history'

export interface ImportLog {
  id: string
  filename: string
  created_at: string
  total_rows: number
  created_count: number
  skipped_count: number
  failed_count: number
  errors: Array<{ row: number; error: string }> | null
  skipped_rows: Array<{
    row: number
    name: string
    ni: string | null
    phone: string | null
    errors: string[]
    warnings: string[]
    isDuplicate: boolean
    trade: string | null
  }> | null
  warned_rows: Array<{
    row: number
    name: string
    ni: string | null
    phone: string | null
    warnings: string[]
    trade: string | null
  }> | null
  importer_name: string | null
  importer_email: string | null
}

export default async function ImportHistoryPage() {
  const allowed = await checkImportPermission()
  if (!allowed) redirect('/operatives')

  const orgId = process.env.NEXT_PUBLIC_ORG_ID!
  const service = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: logs } = await (service as any)
    .from('import_logs')
    .select(`
      id, filename, created_at, total_rows, created_count, skipped_count, failed_count,
      errors, skipped_rows, warned_rows,
      users!import_logs_imported_by_fkey (first_name, last_name, email)
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50)

  const importLogs: ImportLog[] = (logs ?? []).map((l: {
    id: string
    filename: string
    created_at: string
    total_rows: number
    created_count: number
    skipped_count: number
    failed_count: number
    errors: ImportLog['errors']
    skipped_rows: ImportLog['skipped_rows']
    warned_rows: ImportLog['warned_rows']
    users: { first_name: string | null; last_name: string | null; email: string | null } | null
  }) => ({
    id: l.id,
    filename: l.filename,
    created_at: l.created_at,
    total_rows: l.total_rows,
    created_count: l.created_count,
    skipped_count: l.skipped_count,
    failed_count: l.failed_count,
    errors: l.errors,
    skipped_rows: l.skipped_rows,
    warned_rows: l.warned_rows,
    importer_name: l.users
      ? [l.users.first_name, l.users.last_name].filter(Boolean).join(' ') || null
      : null,
    importer_email: l.users?.email ?? null,
  }))

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <PageHeader
        title="Import History"
        description={`${importLogs.length} import${importLogs.length !== 1 ? 's' : ''} — full audit trail with skipped and warned rows`}
        action={
          <Button asChild variant="outline" className="border-border text-muted-foreground hover:bg-card">
            <Link href="/operatives">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Operatives
            </Link>
          </Button>
        }
      />
      <ImportHistory logs={importLogs} />
    </div>
  )
}
