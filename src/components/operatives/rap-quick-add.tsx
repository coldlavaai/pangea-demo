'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Loader2, Star, X, Search } from 'lucide-react'

const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID ?? ''

interface OperativeMatch {
  id: string
  first_name: string
  last_name: string
  reference_number: string | null
  phone: string | null
  status: string | null
  cscs_card_type: string | null
  day_rate: number | null
  trade_category: { name: string } | null
  allocations: Array<{ site: { name: string } | null }> | null
}

function ScoreButton({ value, selected, onClick }: { value: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 w-9 rounded-md text-sm font-semibold transition-colors ${
        selected
          ? 'bg-forest-600 text-white'
          : 'bg-card text-muted-foreground hover:bg-[#444444] hover:text-muted-foreground'
      }`}
    >
      {value}
    </button>
  )
}

function ScoreRow({ label, shortLabel, value, onChange }: { label: string; shortLabel: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-20 shrink-0" title={label}>{shortLabel}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(v => (
          <ScoreButton key={v} value={v} selected={value === v} onClick={() => onChange(v)} />
        ))}
      </div>
    </div>
  )
}

export function RapQuickAdd() {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<OperativeMatch[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedOp, setSelectedOp] = useState<OperativeMatch | null>(null)

  // Score state
  const [reliability, setReliability] = useState(3)
  const [attitude, setAttitude] = useState(3)
  const [performance, setPerformance] = useState(3)
  const [safety, setSafety] = useState(3)
  const [comment, setComment] = useState('')
  const [siteManagerName, setSiteManagerName] = useState('')
  const [dayRate, setDayRate] = useState('')
  const [chargeRate, setChargeRate] = useState('')

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) { setSearchResults([]); return }

    setSearching(true)
    const { data } = await supabase
      .from('operatives')
      .select(`id, first_name, last_name, reference_number, phone, status, cscs_card_type, day_rate,
        trade_category:trade_categories!operatives_trade_category_id_fkey(name),
        allocations!allocations_operative_id_fkey(site:sites!allocations_site_id_fkey(name))`)
      .eq('organization_id', ORG_ID)
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,reference_number.ilike.%${query}%,phone.ilike.%${query}%`)
      .neq('status', 'prospect')
      .order('last_name')
      .limit(12)

    setSearchResults((data ?? []) as unknown as OperativeMatch[])
    setSearching(false)
  }, [supabase])

  const selectOperative = (op: OperativeMatch) => {
    setSelectedOp(op)
    setSearchQuery('')
    setSearchResults([])
  }

  const reset = () => {
    setSelectedOp(null)
    setReliability(3)
    setAttitude(3)
    setPerformance(3)
    setSafety(3)
    setComment('')
    setSiteManagerName('')
    setDayRate('')
    setChargeRate('')
    setError(null)
    setSuccess(null)
  }

  const handleSubmit = async () => {
    if (!selectedOp) return
    setError(null)
    setSuccess(null)

    if ([reliability, attitude, performance, safety].some(s => s <= 2) && !comment.trim()) {
      setError('Comment required when any score is 1 or 2.')
      return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Look up public.users.id from auth UUID (FK points to public.users, not auth.users)
    let reviewerId: string | null = null
    if (user?.id) {
      const { data: pubUser } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      reviewerId = pubUser?.id ?? null
    }

    // Insert RAP review
    const { error: err } = await supabase.from('performance_reviews').insert({
      organization_id: ORG_ID,
      operative_id: selectedOp.id,
      reliability_score: reliability,
      attitude_score: attitude,
      performance_score: performance,
      safety_score: safety,
      comment: comment.trim() || null,
      site_manager_name: siteManagerName.trim() || null,
      reviewer_id: reviewerId,
      submitted_via: 'web',
    })

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    // Log to activity feed
    const avg = ((reliability + attitude + performance + safety) / 4).toFixed(1)
    const rag = Number(avg) >= 4.0 ? 'green' : Number(avg) >= 3.0 ? 'amber' : 'red'
    await supabase.from('notifications').insert({
      organization_id: ORG_ID,
      type: 'rap',
      title: `RAP: ${selectedOp.first_name} ${selectedOp.last_name} — ${avg}/5`,
      body: `R:${reliability} A:${attitude} P:${performance} S:${safety} · ${rag}${siteManagerName.trim() ? ` · by ${siteManagerName.trim()}` : ''}`,
      severity: 'info',
      operative_id: selectedOp.id,
      link_url: `/operatives/${selectedOp.id}?tab=rap`,
      read: false,
    })

    // Update rates on operative if provided
    const rateUpdates: Record<string, number> = {}
    if (dayRate.trim()) {
      const parsed = parseFloat(dayRate.trim().replace('£', ''))
      if (!isNaN(parsed) && parsed > 0) rateUpdates.day_rate = parsed
    }
    if (chargeRate.trim()) {
      const parsed = parseFloat(chargeRate.trim().replace('£', ''))
      if (!isNaN(parsed) && parsed > 0) rateUpdates.charge_rate = parsed
    }
    if (Object.keys(rateUpdates).length > 0) {
      await supabase.from('operatives').update(rateUpdates).eq('id', selectedOp.id)
    }

    setSaving(false)

    const rateInfo = Object.keys(rateUpdates).length > 0 ? ' + rates updated' : ''
    const successMsg = `${selectedOp.first_name} ${selectedOp.last_name} — ${avg}/5 ✓${rateInfo}`

    // Reset form fields but preserve success message
    setSelectedOp(null)
    setReliability(3)
    setAttitude(3)
    setPerformance(3)
    setSafety(3)
    setComment('')
    setSiteManagerName('')
    setDayRate('')
    setChargeRate('')
    setError(null)
    setSuccess(successMsg)

    router.refresh()
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        className="w-full justify-start gap-2 border-border text-muted-foreground hover:bg-card hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Star className="h-4 w-4" />
        Quick RAP Score
      </Button>
    )
  }

  return (
    <>
    {/* Backdrop */}
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => { setOpen(false); reset() }} />

    {/* Modal */}
    <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-lg border border-forest-800/50 bg-background shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-forest-950/30 sticky top-0 z-10">
        <h3 className="text-sm font-semibold text-forest-400">Quick RAP Score</h3>
        <button onClick={() => { setOpen(false); reset() }} className="text-muted-foreground hover:text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="text-xs text-forest-400 bg-forest-900/20 border border-forest-800 rounded px-3 py-2">{success}</p>
        )}

        {/* Operative search */}
        {!selectedOp ? (
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search operative by name or ref..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                className="pl-9 h-9"
                autoFocus
              />
            </div>
            {searchResults.length > 0 && (
              <div className="w-full mt-1 rounded-md border border-border bg-card max-h-64 overflow-y-auto">
                {searchResults.map(op => {
                  const currentSite = op.allocations?.[0]?.site?.name ?? null
                  const phoneLast4 = op.phone ? `···${op.phone.slice(-4)}` : null
                  return (
                    <button
                      key={op.id}
                      onClick={() => selectOperative(op)}
                      className="w-full text-left px-3 py-2.5 hover:bg-card transition-colors border-b border-border/50 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">{op.first_name} {op.last_name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{op.reference_number ?? '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                        {op.trade_category?.name && <span>{op.trade_category.name}</span>}
                        {currentSite && <span>· {currentSite}</span>}
                        {phoneLast4 && <span>· {phoneLast4}</span>}
                        {op.day_rate != null && <span>· £{Number(op.day_rate).toFixed(0)}/d</span>}
                        {op.cscs_card_type && (
                          <span className="capitalize">· {op.cscs_card_type} CSCS</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {searching && <p className="text-xs text-muted-foreground mt-1">Searching...</p>}
          </div>
        ) : (
          <div className="flex items-center justify-between bg-card/50 rounded-md px-3 py-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">{selectedOp.first_name} {selectedOp.last_name}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{selectedOp.reference_number}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                {selectedOp.trade_category?.name && <span>{selectedOp.trade_category.name}</span>}
                {selectedOp.allocations?.[0]?.site?.name && <span>· {selectedOp.allocations[0].site.name}</span>}
                {selectedOp.phone && <span>· ···{selectedOp.phone.slice(-4)}</span>}
              </div>
            </div>
            <button onClick={() => setSelectedOp(null)} className="text-muted-foreground hover:text-muted-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Scores */}
        {selectedOp && (
          <>
            <div className="space-y-2.5">
              <ScoreRow label="Reliability" shortLabel="Reliability" value={reliability} onChange={setReliability} />
              <ScoreRow label="Attitude" shortLabel="Attitude" value={attitude} onChange={setAttitude} />
              <ScoreRow label="Performance" shortLabel="Performance" value={performance} onChange={setPerformance} />
              <ScoreRow label="Safety / H&S" shortLabel="Safety" value={safety} onChange={setSafety} />
            </div>

            {/* Rates + Site manager */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="rap-day" className="text-xs text-muted-foreground">Pay Rate £</Label>
                <Input
                  id="rap-day"
                  value={dayRate}
                  onChange={e => setDayRate(e.target.value)}
                  className="mt-1 h-8"
                  placeholder="e.g. 150"
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label htmlFor="rap-charge" className="text-xs text-muted-foreground">Charge Rate £</Label>
                <Input
                  id="rap-charge"
                  value={chargeRate}
                  onChange={e => setChargeRate(e.target.value)}
                  className="mt-1 h-8"
                  placeholder="e.g. 180"
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label htmlFor="rap-sm" className="text-xs text-muted-foreground">Completed By</Label>
                <Input
                  id="rap-sm"
                  value={siteManagerName}
                  onChange={e => setSiteManagerName(e.target.value)}
                  className="mt-1 h-8"
                  placeholder="Name"
                />
              </div>
            </div>

            {/* Margin preview */}
            {dayRate && chargeRate && (() => {
              const d = parseFloat(dayRate.replace('£', ''))
              const c = parseFloat(chargeRate.replace('£', ''))
              if (isNaN(d) || isNaN(c) || c <= 0) return null
              const margin = ((c - d) / c * 100)
              const colour = margin >= 20 ? 'text-forest-400' : margin >= 10 ? 'text-amber-400' : margin > 0 ? 'text-orange-400' : 'text-red-400'
              return (
                <div className="text-center text-xs text-muted-foreground">
                  Margin: <span className={`font-bold ${colour}`}>{margin.toFixed(1)}%</span>
                  <span className="text-muted-foreground ml-1">(£{(c - d).toFixed(2)}/day)</span>
                </div>
              )
            })()}

            {/* Comment */}
            <div>
              <Label htmlFor="rap-comment" className="text-xs text-muted-foreground">
                Comment {[reliability, attitude, performance, safety].some(s => s <= 2) && <span className="text-red-400">*</span>}
              </Label>
              <Textarea
                id="rap-comment"
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={2}
                className="mt-1"
                placeholder="Notes..."
              />
            </div>

            {/* Score preview — matches spreadsheet format */}
            {(() => {
              const total = reliability + attitude + performance + safety
              const avg = total / 4
              const rag = avg >= 4.0 ? 'Green' : avg >= 3.0 ? 'Amber' : 'Red'
              const ragColour = avg >= 4.0 ? 'text-forest-400' : avg >= 3.0 ? 'text-amber-400' : 'text-red-400'
              return (
                <div className="flex items-center justify-center gap-4 text-sm">
                  <span className="text-muted-foreground">Total: <span className="font-bold text-muted-foreground">{total}</span>/20</span>
                  <span className="text-muted-foreground">Avg: <span className="font-bold text-muted-foreground">{avg.toFixed(1)}</span>/5</span>
                  <span className={`font-bold ${ragColour}`}>{rag}</span>
                </div>
              )
            })()}

            {/* Submit */}
            <Button onClick={handleSubmit} disabled={saving} className="w-full" size="sm">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit RAP Score
            </Button>
          </>
        )}
      </div>
    </div>
    </>
  )
}
