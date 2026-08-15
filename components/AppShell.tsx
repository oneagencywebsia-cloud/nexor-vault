'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
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

const BLOB_DIAMETER = 44;

export function BottomTabBar() {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [blob, setBlob] = useState<{ left: number; width: number; radius: number; visible: boolean }>({
    left: 0,
    width: BLOB_DIAMETER,
    radius: BLOB_DIAMETER / 2,
    visible: false,
  });
  const [poppedHref, setPoppedHref] = useState<string | null>(null);

  const activeIndex = Math.max(
    0,
    TABS.findIndex(({ href }) => pathname === href || pathname?.startsWith(href + '/')),
  );
  const pillPercent = 100 / TABS.length;

  // Mide qué pestaña hay bajo el dedo. Si está dentro de una, la gota se
  // "funde" con su rectángulo exacto (metaball); si está en el hueco entre
  // pestañas, vuelve a ser un círculo pequeño centrado en el dedo.
  function moveBlob(clientX: number) {
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    const relX = clientX - containerRect.left;

    for (const el of tabRefs.current) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const left = r.left - containerRect.left;
      const right = r.right - containerRect.left;
      if (relX >= left && relX <= right) {
        setBlob({ left, width: right - left, radius: 19, visible: true });
        return;
      }
    }

    const clamped = Math.min(Math.max(relX, BLOB_DIAMETER / 2), containerRect.width - BLOB_DIAMETER / 2);
    setBlob({ left: clamped - BLOB_DIAMETER / 2, width: BLOB_DIAMETER, radius: BLOB_DIAMETER / 2, visible: true });
  }

  function pop(href: string) {
    setPoppedHref(href);
    window.setTimeout(() => setPoppedHref((cur) => (cur === href ? null : cur)), 420);
  }

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-2.5">
      <div
        ref={containerRef}
        onPointerDown={(e) => moveBlob(e.clientX)}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === 'touch') moveBlob(e.clientX);
        }}
        onPointerUp={() => setBlob((b) => ({ ...b, visible: false }))}
        onPointerLeave={() => setBlob((b) => ({ ...b, visible: false }))}
        className="nexor-liquid-glass relative mx-auto flex w-full max-w-md items-stretch justify-between overflow-hidden rounded-[26px] px-1.5 py-1.5"
      >
        {/* gota de vidrio que sigue al dedo y se funde con cada pestaña */}
        <div
          className="nexor-touch-blob pointer-events-none absolute top-1.5 bottom-1.5"
          style={{
            left: blob.left,
            width: blob.width,
            borderRadius: blob.radius,
            opacity: blob.visible ? 1 : 0,
          }}
        />

        {/* píldora activa, se desliza entre pestañas con rebote */}
        <div
          className="nexor-active-pill absolute inset-y-1.5 rounded-[19px] bg-purple/20"
          style={{
            width: `calc(${pillPercent}% - 6px)`,
            left: `calc(${activeIndex * pillPercent}% + 3px)`,
          }}
        />

        {TABS.map(({ href, label, icon: Icon }, i) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              onClick={() => pop(href)}
              className={`relative z-10 flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 transition-transform active:scale-90 ${
                poppedHref === href ? 'nexor-tab-pop' : ''
              }`}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 1.8}
                className={`transition-colors ${active ? 'text-purple' : 'text-dim'}`}
              />
              <span className={`text-[10px] font-medium transition-colors ${active ? 'text-purple' : 'text-dim'}`}>
                {label}
              </span>
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
