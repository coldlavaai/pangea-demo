'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Users,
  MapPin,
  ClipboardList,
  Link2,
  Calendar,
  Clock,
  FileCheck,
  AlertTriangle,
  MessageCircle,
  Megaphone,
  Settings,
  LogOut,
  BarChart3,
  Shield,
  Send,
  Activity,
  Sparkles,
} from 'lucide-react'
import { AlertsBell } from '@/components/alerts-bell'

const navGroups = [
  {
    label: null,
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'LABOUR',
    items: [
      { href: '/operatives', label: 'Operatives', icon: Users },
      { href: '/sites', label: 'Sites', icon: MapPin },
      { href: '/requests', label: 'Requests', icon: ClipboardList },
      { href: '/allocations', label: 'Allocations', icon: Link2 },
    ],
  },
  {
    label: 'TIME & PAY',
    items: [
      { href: '/shifts', label: 'Shifts', icon: Calendar },
      { href: '/timesheets', label: 'Timesheets', icon: Clock },
    ],
  },
  {
    label: 'COMPLIANCE',
    items: [
      { href: '/documents', label: 'Documents', icon: FileCheck },
      { href: '/ncrs', label: 'NCRs', icon: AlertTriangle },
      { href: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'COMMS',
    items: [
      { href: '/activity', label: 'Activity', icon: Activity },
      { href: '/comms', label: 'WhatsApp', icon: MessageCircle },
      { href: '/telegram-log', label: 'Telegram Log', icon: Send },
    ],
  },
  {
    label: 'RECRUITMENT',
    items: [
      { href: '/adverts', label: 'Adverts', icon: Megaphone },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { href: '/assistant', label: 'Rex', icon: Sparkles },
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/audit-log', label: 'Audit Log', icon: Shield },
    ],
  },
]

// Nav items hidden for site_manager role
const SITE_MANAGER_HIDDEN_HREFS = new Set(['/settings', '/adverts', '/comms', '/audit-log', '/telegram-log', '/activity'])

// Nav items visible for auditor role (allow-list)
const AUDITOR_ALLOWED_HREFS = new Set(['/dashboard', '/documents', '/reports', '/operatives'])

interface SidebarProps {
  userEmail: string | undefined
  userRole: string
}

export function Sidebar({ userEmail, userRole }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex flex-col w-40 shrink-0 h-screen bg-forest-800 border-r border-forest-700/30 overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-forest-700/30">
        <img src="/pangaea-mark.png" className="h-6 w-6 object-contain shrink-0" alt="Pangaea" />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-display text-forest-100 text-[11px] leading-tight">Pangaea<span className="text-copper-500">.</span></span>
          <span className="text-[9px] text-forest-400 leading-tight">Workforce</span>
        </div>
        <AlertsBell />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-4">
        {navGroups.map((group, gi) => {
          const visibleItems = group.items.filter((item) => {
            if (userRole === 'site_manager') return !SITE_MANAGER_HIDDEN_HREFS.has(item.href)
            if (userRole === 'auditor') return AUDITOR_ALLOWED_HREFS.has(item.href)
            return true
          })
          if (visibleItems.length === 0) return null
          return (
          <div key={gi}>
            {group.label && (
              <p className="px-2 mb-0.5 text-[9px] font-semibold tracking-widest text-forest-500/80 uppercase">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {visibleItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                        active
                          ? 'bg-forest-500/10 text-forest-300 border-l-2 border-forest-400 pl-[6px] shadow-sm shadow-forest-500/10'
                          : 'text-forest-300/70 hover:bg-forest-700/50 hover:text-forest-100'
                      )}
                    >
                      <item.icon className="h-3.5 w-3.5 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
        })}
      </nav>

      {/* Quick Rex — opens widget panel */}
      <div className="px-2 pb-2">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('toggle-rex'))}
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs font-semibold transition-colors bg-forest-700/30 border border-forest-600/50 text-forest-300 hover:bg-forest-700/50 hover:text-forest-200"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          Quick Rex
        </button>
      </div>

      {/* User + sign out */}
      <div className="border-t border-forest-700/30 p-2">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-forest-900/40">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-forest-700 text-forest-200 text-[10px] font-bold uppercase">
            {userEmail?.[0] ?? 'A'}
          </div>
          <span className="flex-1 truncate text-[10px] text-forest-300/70">{userEmail ?? 'Admin'}</span>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="text-forest-500 hover:text-forest-200 transition-colors shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
