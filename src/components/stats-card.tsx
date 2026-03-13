import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: number | string
  secondary?: string
  icon?: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

export function StatsCard({ title, value, secondary, icon: Icon, className }: StatsCardProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl border border-border bg-card px-4 py-3 overflow-hidden transition-shadow hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)]',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-none">{title}</p>
          <p className="mt-1 text-xl font-mono font-bold text-foreground leading-none tabular-nums">{value}</p>
          {secondary && (
            <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">{secondary}</p>
          )}
        </div>
        {Icon && (
          <div className="rounded-md bg-forest-700/10 dark:bg-forest-700/20 border border-forest-700/20 p-1.5 shrink-0">
            <Icon className="h-3.5 w-3.5 text-forest-600 dark:text-forest-400" />
          </div>
        )}
      </div>
    </div>
  )
}
