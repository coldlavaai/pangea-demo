import { redirect } from 'next/navigation'
import { ArrowLeft, History } from 'lucide-react'
import Link from 'next/link'
import { checkImportPermission } from '@/lib/export/check-export'
import { ImportWizard } from '@/components/operatives/import-wizard'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'

export default async function ImportOperativesPage() {
  const allowed = await checkImportPermission()
  if (!allowed) redirect('/operatives')

  return (
    <div className="px-4 pt-2 pb-4 space-y-2">
      <PageHeader
        title="Import Operatives"
        description="Bulk upload from CSV — up to 5,000 contacts per file"
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline" className="border-border text-muted-foreground hover:bg-card">
              <Link href="/operatives/import/history">
                <History className="h-4 w-4 mr-2" />
                History
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-border text-muted-foreground hover:bg-card">
              <Link href="/operatives">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
          </div>
        }
      />

      <ImportWizard />
    </div>
  )
}
