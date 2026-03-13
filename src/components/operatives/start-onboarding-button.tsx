'use client'

import { useState } from 'react'
import { Rocket, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface StartOnboardingButtonProps {
  operativeId: string
  operativeName: string
  hasPhone: boolean
  status: string
}

const ELIGIBLE_STATUSES = ['prospect', 'qualifying', 'pending_docs']

export function StartOnboardingButton({
  operativeId,
  operativeName,
  hasPhone,
  status,
}: StartOnboardingButtonProps) {
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)

  if (!hasPhone || !ELIGIBLE_STATUSES.includes(status)) return null

  async function handleStart() {
    setLoading(true)
    try {
      const res = await fetch(`/api/operatives/${operativeId}/onboard`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to start onboarding')
        return
      }

      setStarted(true)
      toast.success(`Onboarding started for ${operativeName}. Amber will reach out via WhatsApp.`)
    } catch {
      toast.error('Failed to start onboarding')
    } finally {
      setLoading(false)
    }
  }

  if (started) {
    return (
      <button
        disabled
        className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold bg-forest-700/20 text-forest-400 border border-forest-600/30 cursor-default"
      >
        <CheckCircle className="h-4 w-4" />
        Onboarding Started
      </button>
    )
  }

  return (
    <button
      onClick={handleStart}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold bg-copper-500 text-white hover:bg-copper-600 transition-colors disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Rocket className="h-4 w-4" />
      )}
      {loading ? 'Starting...' : 'Start Onboarding'}
    </button>
  )
}
