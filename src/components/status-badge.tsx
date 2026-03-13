import { cn } from '@/lib/utils'

/** Dot colour per status (the small circle indicator) */
const dotColours: Record<string, string> = {
  // Green family
  verified:     'bg-[#2D6A4F]',
  available:    'bg-[#2D6A4F]',
  fulfilled:    'bg-[#2D6A4F]',
  active:       'bg-[#2D6A4F]',
  arrived:      'bg-[#2D6A4F]',
  green:        'bg-[#2D6A4F]',
  // Amber family
  qualifying:   'bg-[#E09F3E]',
  pending_docs: 'bg-[#E09F3E]',
  pending:      'bg-[#E09F3E]',
  amber:        'bg-[#E09F3E]',
  // Blue family
  searching:    'bg-[#457B9D]',
  working:      'bg-[#457B9D]',
  offered:      'bg-[#457B9D]',
  // Red family
  blocked:      'bg-[#D62828]',
  no_show:      'bg-[#D62828]',
  rejected:     'bg-[#D62828]',
  red:          'bg-[#D62828]',
  expired:      'bg-[#9B2226]',
  // Neutral
  prospect:     'bg-slate-400',
  unavailable:  'bg-slate-400',
  completed:    'bg-slate-400',
  cancelled:    'bg-slate-400',
  expected:     'bg-slate-400',
  confirmed:    'bg-[#2D6A4F]',
  partial:      'bg-[#E09F3E]',
}

/** Pill background + text colour per status */
const pillColours: Record<string, string> = {
  // Green family — light green bg, forest text
  verified:     'bg-[#E8F5E9] text-[#2D6A4F] dark:bg-[#2D6A4F]/20 dark:text-[#74C69D]',
  available:    'bg-[#E8F5E9] text-[#2D6A4F] dark:bg-[#2D6A4F]/20 dark:text-[#74C69D]',
  fulfilled:    'bg-[#E8F5E9] text-[#2D6A4F] dark:bg-[#2D6A4F]/20 dark:text-[#74C69D]',
  active:       'bg-[#E8F5E9] text-[#2D6A4F] dark:bg-[#2D6A4F]/20 dark:text-[#74C69D]',
  arrived:      'bg-[#E8F5E9] text-[#2D6A4F] dark:bg-[#2D6A4F]/20 dark:text-[#74C69D]',
  confirmed:    'bg-[#E8F5E9] text-[#2D6A4F] dark:bg-[#2D6A4F]/20 dark:text-[#74C69D]',
  green:        'bg-[#E8F5E9] text-[#2D6A4F] dark:bg-[#2D6A4F]/20 dark:text-[#74C69D]',
  // Amber family — light amber bg, dark amber text
  qualifying:   'bg-[#FFF8E1] text-[#7A6200] dark:bg-[#E09F3E]/15 dark:text-[#E09F3E]',
  pending_docs: 'bg-[#FFF8E1] text-[#7A6200] dark:bg-[#E09F3E]/15 dark:text-[#E09F3E]',
  pending:      'bg-[#FFF8E1] text-[#7A6200] dark:bg-[#E09F3E]/15 dark:text-[#E09F3E]',
  partial:      'bg-[#FFF8E1] text-[#7A6200] dark:bg-[#E09F3E]/15 dark:text-[#E09F3E]',
  amber:        'bg-[#FFF8E1] text-[#7A6200] dark:bg-[#E09F3E]/15 dark:text-[#E09F3E]',
  // Blue family — light blue bg, blue text
  searching:    'bg-[#E3F2FD] text-[#1565C0] dark:bg-[#457B9D]/15 dark:text-[#457B9D]',
  working:      'bg-[#E3F2FD] text-[#1565C0] dark:bg-[#457B9D]/15 dark:text-[#457B9D]',
  offered:      'bg-[#E3F2FD] text-[#1565C0] dark:bg-[#457B9D]/15 dark:text-[#457B9D]',
  // Red family — light red bg, dark red text
  blocked:      'bg-[#FFEBEE] text-[#9B2226] dark:bg-[#D62828]/15 dark:text-[#D62828]',
  no_show:      'bg-[#FFEBEE] text-[#9B2226] dark:bg-[#D62828]/15 dark:text-[#D62828]',
  rejected:     'bg-[#FFEBEE] text-[#9B2226] dark:bg-[#D62828]/15 dark:text-[#D62828]',
  red:          'bg-[#FFEBEE] text-[#9B2226] dark:bg-[#D62828]/15 dark:text-[#D62828]',
  expired:      'bg-[#FFEBEE] text-[#9B2226] dark:bg-[#9B2226]/15 dark:text-[#D62828]',
  // Neutral — grey
  prospect:     'bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-400',
  unavailable:  'bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-400',
  completed:    'bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-400',
  cancelled:    'bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-400',
  expected:     'bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-400',
}

const displayLabels: Record<string, string> = {
  prospect: 'Prospect',
  qualifying: 'Qualifying',
  pending_docs: 'Docs Pending',
  verified: 'Verified',
  available: 'Available',
  working: 'Working',
  unavailable: 'Unavailable',
  blocked: 'Blocked',
  pending: 'Pending',
  searching: 'Searching',
  partial: 'Partial',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  offered: 'Offered',
  confirmed: 'Confirmed',
  active: 'Active',
  completed: 'Completed',
  no_show: 'No Show',
  rejected: 'Rejected',
  expired: 'Expired',
  expected: 'Expected',
  arrived: 'Arrived',
  green: 'Green',
  amber: 'Amber',
  red: 'Red',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const pill = pillColours[status] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-400'
  const dot = dotColours[status] ?? 'bg-slate-400'
  const label = displayLabels[status] ?? status.replace(/_/g, ' ')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.05em]',
        pill,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dot)} />
      {label}
    </span>
  )
}
