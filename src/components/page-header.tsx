import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between py-2 border-b border-border', className)}>
      <div className="flex items-baseline gap-3 min-w-0">
        <h1 className="text-lg font-bold text-foreground tracking-tight leading-none">{title}</h1>
        {description && (
          <span className="font-mono text-[11px] text-copper-500 uppercase tracking-[0.08em] truncate">{description}</span>
        )}
      </div>
      {action && <div className="ml-4 shrink-0">{action}</div>}
    </div>
  )
}
