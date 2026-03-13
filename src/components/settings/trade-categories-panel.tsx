'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'

interface TradeCategory {
  id: string
  name: string
  labour_type: string
  typical_day_rate: number | null
  job_description: string | null
  is_active: boolean | null
  sort_order: number | null
}

interface TradeCategoriesPanelProps {
  orgId: string
  categories: TradeCategory[]
}

const DEFAULT_TRADES = [
  { name: 'General Operative', labour_type: 'blue_collar' },
  { name: 'CPCS Plant Operator', labour_type: 'blue_collar' },
  { name: 'Groundworker', labour_type: 'blue_collar' },
  { name: 'Labourer', labour_type: 'blue_collar' },
  { name: 'Scaffolder', labour_type: 'blue_collar' },
  { name: 'Steel Fixer', labour_type: 'blue_collar' },
  { name: 'Bricklayer', labour_type: 'blue_collar' },
  { name: 'Carpenter / Joiner', labour_type: 'blue_collar' },
  { name: 'Electrician', labour_type: 'blue_collar' },
  { name: 'Plumber', labour_type: 'blue_collar' },
  { name: 'Painter / Decorator', labour_type: 'blue_collar' },
  { name: 'Highway Operative (NRSWA)', labour_type: 'blue_collar' },
  { name: 'Site Manager', labour_type: 'white_collar' },
  { name: 'Quantity Surveyor', labour_type: 'white_collar' },
  { name: 'Project Manager', labour_type: 'white_collar' },
]

function EditRow({
  cat,
  onDone,
}: {
  cat: TradeCategory
  onDone: (updated: TradeCategory) => void
}) {
  const supabase = createClient()
  const [name, setName] = useState(cat.name)
  const [rate, setRate] = useState(cat.typical_day_rate != null ? String(cat.typical_day_rate) : '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const updated: TradeCategory = {
      ...cat,
      name,
      typical_day_rate: rate ? parseFloat(rate) : null,
    }
    const { error } = await supabase
      .from('trade_categories')
      .update({ name, typical_day_rate: rate ? parseFloat(rate) : null })
      .eq('id', cat.id)

    if (error) {
      toast.error('Failed to save trade')
      setSaving(false)
      return
    }
    toast.success('Trade updated')
    onDone(updated)
  }

  return (
    <tr className="border-b border-border bg-background/60">
      <td className="px-4 py-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-7 text-xs bg-card border-border text-foreground"
          autoFocus
        />
      </td>
      <td className="px-4 py-2 text-xs text-muted-foreground capitalize">
        {cat.labour_type.replace('_', ' ')}
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="—"
          className="h-7 text-xs bg-card border-border text-foreground w-24"
        />
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex gap-1 justify-end">
          <Button
            size="sm"
            className="h-6 px-2 text-xs bg-forest-600 hover:bg-forest-700 text-white"
            onClick={save}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => onDone(cat)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

export function TradeCategoriesPanel({ orgId, categories: initialCategories }: TradeCategoriesPanelProps) {
  const supabase = createClient()
  const [categories, setCategories] = useState(initialCategories)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLabourType, setNewLabourType] = useState('blue_collar')
  const [newRate, setNewRate] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  const fieldClass =
    'bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-forest-500'

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) {
      setAddError('Name required')
      return
    }
    setAdding(true)
    setAddError(null)

    const { data, error } = await supabase
      .from('trade_categories')
      .insert([
        {
          organization_id: orgId,
          name: newName.trim(),
          labour_type: newLabourType as 'blue_collar' | 'white_collar',
          typical_day_rate: newRate ? parseFloat(newRate) : null,
          is_active: true,
          sort_order: categories.length + 1,
        },
      ])
      .select()
      .single()

    setAdding(false)

    if (error) {
      setAddError(error.message)
      return
    }

    setCategories((prev) => [...prev, data as TradeCategory])
    setNewName('')
    setNewRate('')
    setShowAdd(false)
    toast.success(`${newName.trim()} added`)
  }

  const toggleActive = async (id: string, current: boolean | null) => {
    const prev = [...categories]
    const next = !current
    // Optimistic update
    setCategories((c) => c.map((x) => (x.id === id ? { ...x, is_active: next } : x)))
    setToggling(id)

    const { error } = await supabase
      .from('trade_categories')
      .update({ is_active: next })
      .eq('id', id)

    setToggling(null)
    if (error) {
      setCategories(prev)
      toast.error('Failed to update trade')
    } else {
      toast.success(current ? 'Trade disabled' : 'Trade enabled')
    }
  }

  const seedDefaultTrades = async () => {
    setSeeding(true)
    const existingNames = new Set(categories.map((c) => c.name.toLowerCase()))
    const toInsert = DEFAULT_TRADES.filter((t) => !existingNames.has(t.name.toLowerCase())).map(
      (t, i) => ({
        organization_id: orgId,
        name: t.name,
        labour_type: t.labour_type as 'blue_collar' | 'white_collar',
        is_active: true,
        sort_order: categories.length + i + 1,
      })
    )

    if (toInsert.length === 0) {
      toast.info('All standard trades already added')
      setSeeding(false)
      return
    }

    const { data, error } = await supabase
      .from('trade_categories')
      .insert(toInsert)
      .select()

    setSeeding(false)

    if (error) {
      toast.error('Failed to seed trades')
      return
    }

    setCategories((prev) => [...prev, ...(data as TradeCategory[])])
    toast.success(`${toInsert.length} trade${toInsert.length !== 1 ? 's' : ''} added`)
  }

  const hasMissingTrades = DEFAULT_TRADES.some(
    (t) => !categories.map((c) => c.name.toLowerCase()).includes(t.name.toLowerCase())
  )

  const active = categories.filter((c) => c.is_active !== false)
  const inactive = categories.filter((c) => c.is_active === false)

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {active.length} active trade{active.length !== 1 ? 's' : ''}
          {inactive.length > 0 && `, ${inactive.length} inactive`}
        </p>
        <div className="flex gap-2">
          {hasMissingTrades && (
            <Button
              size="sm"
              variant="outline"
              className="border-border text-muted-foreground hover:bg-card text-xs"
              onClick={seedDefaultTrades}
              disabled={seeding}
            >
              {seeding && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Seed Default Trades
            </Button>
          )}
          <Button
            size="sm"
            className="bg-forest-600 hover:bg-forest-700 text-white"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Trade
          </Button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="rounded-lg border border-border bg-background/60 p-4 space-y-3"
        >
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            New Trade Category
          </h3>
          {addError && <p className="text-xs text-red-400">{addError}</p>}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. CPCS Plant Operator"
                className={`h-8 text-xs ${fieldClass}`}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Typical Day Rate (£)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder="—"
                className={`h-8 text-xs ${fieldClass}`}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Labour Type</Label>
            <Select value={newLabourType} onValueChange={setNewLabourType}>
              <SelectTrigger className={`h-8 text-xs ${fieldClass}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="blue_collar" className="text-xs text-muted-foreground">
                  Blue Collar
                </SelectItem>
                <SelectItem value="white_collar" className="text-xs text-muted-foreground">
                  White Collar
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              className="h-7 text-xs bg-forest-600 hover:bg-forest-700 text-white"
              disabled={adding}
            >
              {adding && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setShowAdd(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Table */}
      {categories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground mb-3">No trade categories yet</p>
          <Button
            size="sm"
            variant="outline"
            className="border-border text-muted-foreground hover:bg-card"
            onClick={seedDefaultTrades}
            disabled={seeding}
          >
            {seeding && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Seed Default Standard Trades
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/80">
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Trade</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Type</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Day Rate</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((cat) => {
                if (editingId === cat.id) {
                  return (
                    <EditRow
                      key={cat.id}
                      cat={cat}
                      onDone={(updated) => {
                        setCategories((prev) =>
                          prev.map((c) => (c.id === updated.id ? updated : c))
                        )
                        setEditingId(null)
                      }}
                    />
                  )
                }
                return (
                  <tr
                    key={cat.id}
                    className={`transition-opacity hover:bg-background/50 ${cat.is_active === false ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-2.5 text-muted-foreground">{cat.name}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground capitalize">
                      {cat.labour_type.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                      {cat.typical_day_rate != null
                        ? `£${Number(cat.typical_day_rate).toFixed(0)}/day`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-muted-foreground"
                          onClick={() => setEditingId(cat.id)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`h-6 px-2 text-xs transition-colors ${cat.is_active === false ? 'text-forest-400' : 'text-muted-foreground'}`}
                          onClick={() => toggleActive(cat.id, cat.is_active)}
                          disabled={toggling === cat.id}
                        >
                          {toggling === cat.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : cat.is_active === false ? (
                            'Enable'
                          ) : (
                            'Disable'
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
