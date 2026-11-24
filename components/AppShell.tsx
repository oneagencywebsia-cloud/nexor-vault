'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Lock, Share2, ShieldCheck, Users2, Settings2 } from 'lucide-react';
import { NexorMark } from './NexorLogo';
import PushSetup from './PushSetup';
import { SectionBackdrop, type Scene } from './SectionBackdrop';

// Cada sección tiene su color (el violeta de marca es el de Vault): así se nota
// al cambiar de pantalla. Los mismos colores están en globals.css ([data-section]).
const TABS = [
  { href: '/vault', label: 'Vault', icon: Lock, color: '#6c5ce7' },
  { href: '/share', label: 'Compartir', icon: Share2, color: '#0ea5e9' },
  { href: '/teams', label: 'Equipos', icon: Users2, color: '#ec4899' },
  { href: '/audit', label: 'Auditoría', icon: ShieldCheck, color: '#10b981' },
  { href: '/settings', label: 'Ajustes', icon: Settings2, color: '#f59e0b' },
];

function sectionOf(pathname: string): string {
  const tab = TABS.find(({ href }) => pathname === href || pathname.startsWith(href + '/'));
  if (tab) return tab.href.slice(1);
  if (pathname.startsWith('/import')) return 'import';
  if (pathname.startsWith('/open')) return 'open';
  if (pathname.startsWith('/extension')) return 'extension';
  return 'vault';
}

const SCENE_BY_SECTION: Record<string, Scene> = {
  vault: 'vault',
  share: 'share',
  teams: 'teams',
  audit: 'audit',
  settings: 'settings',
  import: 'share',
  open: 'vault',
  extension: 'settings',
};

// Barra lateral de escritorio (lg+): sustituye a la barra inferior, con el
// mismo orden de accesos directos y un indicador que se desliza entre ellos.
function SideNav() {
  const pathname = usePathname();
  const activeIndex = TABS.findIndex(({ href }) => pathname === href || pathname?.startsWith(href + '/'));
  return (
    <aside className="safe-top fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-white/80 px-4 pb-6 pt-6 backdrop-blur-md lg:flex xl:w-64">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
        <NexorMark size={26} id="side" />
        <span className="text-[15px] font-black tracking-[0.18em] text-foreground">NEXOR</span>
      </Link>
      <nav className="relative flex flex-1 flex-col gap-1" aria-label="Secciones">
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="absolute left-0 right-0 h-11 rounded-xl transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
            style={{
              transform: `translateY(${activeIndex * 48}px)`,
              backgroundColor: `color-mix(in srgb, ${TABS[activeIndex].color} 14%, transparent)`,
            }}
          />
        )}
        {TABS.map(({ href, label, icon: Icon, color }, i) => {
          const active = i === activeIndex;
          return (
            <Link
              key={href}
              href={href}
              style={active ? { color } : undefined}
              className={`relative z-10 flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold transition-colors ${
                active ? '' : 'text-dim hover:text-foreground'
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 1.9} />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="px-2 text-[11px] leading-snug text-dim">Secure every connection</p>
    </aside>
  );
}

export function TopBar({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <header className="safe-top nexor-glass sticky top-0 z-30 border-b border-line">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5 md:max-w-3xl lg:max-w-4xl lg:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="lg:hidden">
            <NexorMark size={22} id="topbar" />
          </span>
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
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [blob, setBlob] = useState<{ left: number; width: number; radius: number; visible: boolean }>({
    left: 0,
    width: BLOB_DIAMETER,
    radius: BLOB_DIAMETER / 2,
    visible: false,
  });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [landed, setLanded] = useState(false);
  const [poppedHref, setPoppedHref] = useState<string | null>(null);
  const hoveredRef = useRef<number | null>(null);

  const activeIndex = Math.max(
    0,
    TABS.findIndex(({ href }) => pathname === href || pathname?.startsWith(href + '/')),
  );
  const pillPercent = 100 / TABS.length;

  // Mide qué pestaña hay bajo el dedo. Si está dentro de una, la gota se
  // "funde" con su rectángulo exacto (metaball) y esa pestaña se marca como
  // hovered (para distorsionar su icono); en el hueco entre pestañas vuelve
  // a ser un círculo pequeño centrado en el dedo.
  function moveBlob(clientX: number) {
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    const relX = clientX - containerRect.left;

    for (let i = 0; i < tabRefs.current.length; i++) {
      const el = tabRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const left = r.left - containerRect.left;
      const right = r.right - containerRect.left;
      if (relX >= left && relX <= right) {
        setBlob({ left, width: right - left, radius: 19, visible: true });
        if (hoveredRef.current !== i) {
          hoveredRef.current = i;
          setHoveredIndex(i);
          setLanded(true);
          window.setTimeout(() => setLanded(false), 320);
        }
        return;
      }
    }

    hoveredRef.current = null;
    setHoveredIndex(null);
    const clamped = Math.min(Math.max(relX, BLOB_DIAMETER / 2), containerRect.width - BLOB_DIAMETER / 2);
    setBlob({ left: clamped - BLOB_DIAMETER / 2, width: BLOB_DIAMETER, radius: BLOB_DIAMETER / 2, visible: true });
  }

  function endTouch(navigate: boolean) {
    if (navigate && hoveredRef.current !== null) router.push(TABS[hoveredRef.current].href);
    setBlob((b) => ({ ...b, visible: false }));
    hoveredRef.current = null;
    setHoveredIndex(null);
  }

  // Tap simple (sin arrastre): la burbuja también viaja hasta esa pestaña
  // y aterriza ahí un instante, para que el toque siempre tenga el mismo
  // feedback visual que arrastrar el dedo hasta esa opción.
  function pop(href: string, i: number) {
    setPoppedHref(href);
    window.setTimeout(() => setPoppedHref((cur) => (cur === href ? null : cur)), 420);

    const containerRect = containerRef.current?.getBoundingClientRect();
    const el = tabRefs.current[i];
    if (!containerRect || !el) return;
    const r = el.getBoundingClientRect();
    const left = r.left - containerRect.left;
    const right = r.right - containerRect.left;

    hoveredRef.current = i;
    setHoveredIndex(i);
    setBlob({ left, width: right - left, radius: 19, visible: true });
    setLanded(true);
    window.setTimeout(() => setLanded(false), 320);
    window.setTimeout(() => {
      setBlob((b) => ({ ...b, visible: false }));
      if (hoveredRef.current === i) {
        hoveredRef.current = null;
        setHoveredIndex(null);
      }
    }, 420);
  }

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-2.5">
      {/* filtro de refracción reutilizado por todos los iconos — solo se
          "activa" visualmente cuando la gota está encima (ver más abajo) */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id="nexor-glass-distortion" x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.01 0.12" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="22" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <div
        ref={containerRef}
        onPointerDown={(e) => moveBlob(e.clientX)}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === 'touch') moveBlob(e.clientX);
        }}
        onPointerUp={() => endTouch(true)}
        onPointerCancel={() => endTouch(false)}
        onPointerLeave={() => endTouch(false)}
        style={{ touchAction: 'none' }}
        className="nexor-liquid-glass relative mx-auto flex w-full max-w-md items-stretch justify-between overflow-hidden rounded-[26px] px-1.5 py-1.5"
      >
        {/* gota de vidrio que sigue al dedo y se funde con cada pestaña */}
        <div
          className={`nexor-touch-blob pointer-events-none absolute top-1.5 bottom-1.5 ${landed ? 'nexor-blob-land' : ''}`}
          style={{
            left: blob.left,
            width: blob.width,
            borderRadius: blob.radius,
            opacity: blob.visible ? 1 : 0,
          }}
        />

        {/* píldora activa, se desliza entre pestañas con rebote */}
        <div
          className="nexor-active-pill absolute inset-y-1.5 rounded-[19px]"
          style={{
            width: `calc(${pillPercent}% - 6px)`,
            left: `calc(${activeIndex * pillPercent}% + 3px)`,
            backgroundColor: `color-mix(in srgb, ${TABS[activeIndex].color} 20%, transparent)`,
          }}
        />

        {TABS.map(({ href, label, icon: Icon, color }, i) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          const distorted = hoveredIndex === i;
          const tint = active ? { color } : undefined;
          return (
            <Link
              key={href}
              href={href}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              onClick={() => pop(href, i)}
              className={`relative z-10 flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 transition-transform active:scale-90 ${
                poppedHref === href ? 'nexor-tab-pop' : ''
              }`}
            >
              <span className="relative grid h-[22px] w-[22px] place-items-center">
                <Icon
                  size={22}
                  strokeWidth={active ? 2.4 : 1.8}
                  className={`transition-opacity duration-200 ${active ? '' : 'text-dim'} ${
                    distorted ? 'opacity-0' : 'opacity-100'
                  }`}
                  style={tint}
                />
                {/* copia distorsionada, se funde con la de arriba solo
                    mientras la gota de vidrio pasa por este icono */}
                <Icon
                  size={22}
                  strokeWidth={active ? 2.4 : 1.8}
                  className={`absolute inset-0 transition-opacity duration-200 ${active ? '' : 'text-dim'} ${
                    distorted ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{ filter: 'url(#nexor-glass-distortion)', ...tint }}
                />
              </span>
              <span className={`text-[10px] font-medium transition-colors ${active ? '' : 'text-dim'}`} style={tint}>
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
  const pathname = usePathname() ?? '';
  const section = sectionOf(pathname);
  const scene = SCENE_BY_SECTION[section] ?? 'vault';

  return (
    <div data-section={section} className="nexor-mesh-bg relative flex min-h-dvh flex-col bg-void lg:pl-60 xl:pl-64">
      <SideNav />
      {/* destello de color de la sección al entrar: es lo que hace visible la transición */}
      <div aria-hidden className="nexor-wash" />
      {/* fondo animado infinito que representa la sección actual: ocupa toda la
          pantalla, fijo detrás del contenido (no se corta ni se mueve al hacer scroll) */}
      <div className="pointer-events-none fixed inset-0 z-0 lg:left-60 xl:left-64">
        <SectionBackdrop scene={scene} key={scene} fade="transparent" className="opacity-45" />
      </div>
      <PushSetup />
      <TopBar title={title} subtitle={subtitle} right={right} />
      <main className="nexor-page-anim relative z-10 mx-auto w-full max-w-2xl flex-1 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pt-5 md:max-w-3xl lg:max-w-4xl lg:px-8 lg:pb-12 lg:pt-7">
        {children}
      </main>
      {/* el contenido se funde con el fondo antes de llegar a la barra inferior */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-40 bg-gradient-to-t from-white via-white/75 to-transparent lg:hidden" />
      <div className="lg:hidden">
        <BottomTabBar />
      </div>
    </div>
  );
}
