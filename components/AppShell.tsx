'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Lock, Share2, ShieldCheck, Users2, Settings2 } from 'lucide-react';
import { NexorMark } from './NexorLogo';
import PushSetup from './PushSetup';

const TABS = [
  { href: '/vault', label: 'Vault', icon: Lock },
  { href: '/share', label: 'Compartir', icon: Share2 },
  { href: '/teams', label: 'Equipos', icon: Users2 },
  { href: '/audit', label: 'Auditoría', icon: ShieldCheck },
  { href: '/settings', label: 'Ajustes', icon: Settings2 },
];

export function TopBar({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <header className="safe-top nexor-glass sticky top-0 z-30 border-b border-line">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <NexorMark size={22} id="topbar" />
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="truncate text-[11px] text-dim">{subtitle}</p>}
          </div>
        </div>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </div>
    </header>
  );
}

export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav className="safe-bottom nexor-glass fixed inset-x-0 bottom-0 z-30 border-t border-line">
      <div className="mx-auto flex max-w-2xl items-stretch justify-between px-2 pt-1.5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 transition-colors active:bg-surface-2"
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 1.8}
                className={active ? 'text-purple' : 'text-dim'}
              />
              <span className={`text-[10px] font-medium ${active ? 'text-purple' : 'text-dim'}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="nexor-mesh-bg flex min-h-screen flex-col bg-void">
      <PushSetup />
      <TopBar title={title} subtitle={subtitle} right={right} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-28 pt-5">{children}</main>
      <BottomTabBar />
    </div>
  );
}
