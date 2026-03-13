'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface OrgSettingsFormProps {
  orgId: string
  name: string
  slug: string
  settings: Record<string, unknown>
}

export function OrgSettingsForm({ orgId, name: initName, slug: initSlug, settings }: OrgSettingsFormProps) {
  const supabase = createClient()

  const [orgName, setOrgName] = useState(initName)
  const [managerWhatsapp, setManagerWhatsapp] = useState((settings.manager_whatsapp as string) ?? '')
  const [offerWindow, setOfferWindow] = useState(String(settings.offer_window_minutes ?? 30))
  const [broadcastCount, setBroadcastCount] = useState(String(settings.offer_broadcast_count ?? 3))
  const [reallocRadius, setReallocRadius] = useState(String(settings.reallocation_radius_miles ?? 25))
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const newSettings = {
      ...settings,
      manager_whatsapp: managerWhatsapp || null,
      offer_window_minutes: parseInt(offerWindow, 10) || 30,
      offer_broadcast_count: parseInt(broadcastCount, 10) || 3,
      reallocation_radius_miles: parseInt(reallocRadius, 10) || 25,
    }

    const { error } = await supabase
      .from('organizations')
      .update({ name: orgName, settings: newSettings as unknown as import('@/types/database').Json })
      .eq('id', orgId)

    setSaving(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Settings saved')
    }
  }

  const fieldClass = 'bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-forest-500'
  const labelClass = 'text-muted-foreground text-sm'

  return (
    <form onSubmit={handleSave} className="max-w-xl space-y-6">
      <div className="rounded-lg border border-border bg-background/40 p-5 space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organisation</h3>

        <div className="space-y-1.5">
          <Label className={labelClass}>Organisation Name</Label>
          <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} className={fieldClass} />
          <p className="text-xs text-muted-foreground">Slug: <span className="font-mono">{initSlug}</span></p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/40 p-5 space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">WhatsApp</h3>
        <p className="text-xs text-muted-foreground">The labour manager WhatsApp number used for offer broadcasts and operative messages.</p>

        <div className="space-y-1.5">
          <Label className={labelClass}>Labour Manager WhatsApp</Label>
          <Input
            value={managerWhatsapp}
            onChange={(e) => setManagerWhatsapp(e.target.value)}
            placeholder="+447742201349"
            className={`${fieldClass} font-mono`}
          />
          <p className="text-xs text-muted-foreground">Replace before go-live — currently placeholder (Oliver&apos;s number)</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/40 p-5 space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Offer Settings</h3>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className={labelClass}>Offer window (mins)</Label>
            <Input
              type="number"
              min="5"
              max="1440"
              value={offerWindow}
              onChange={(e) => setOfferWindow(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Broadcast count</Label>
            <Input
              type="number"
              min="1"
              max="10"
              value={broadcastCount}
              onChange={(e) => setBroadcastCount(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass}>Realloc. radius (mi)</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={reallocRadius}
              onChange={(e) => setReallocRadius(e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Broadcast count = how many operatives receive an offer simultaneously. First to accept wins.
        </p>
      </div>

      <Button type="submit" disabled={saving} className="bg-forest-600 hover:bg-forest-700 text-white">
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save Settings
      </Button>
    </form>
  )
}
