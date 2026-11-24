'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';

export type Scene = 'vault' | 'share' | 'teams' | 'audit' | 'settings' | 'home';

// Fondos animados en bucle infinito, uno por sección:
//  vault    → dial de caja fuerte girando + candados flotando
//  share    → red de nodos con paquetes viajando entre ellos
//  teams    → órbitas con personas girando alrededor de un núcleo
//  audit    → radar con barrido y puntos que parpadean
//  settings → engranajes girando en sentidos opuestos
//  home     → anillos que laten + lluvia suave de nodos
//
// Cómo se consigue que se vean bien en TODOS los dispositivos y vayan fluidos:
//  · Cada elemento es una capa HTML con un SVG estático dentro; solo se anima
//    `transform` y `opacity` (se componen en la GPU, sin repintar nada).
//  · El tamaño y la posición usan unidades de contenedor (cqmin/cqw/cqh), así
//    que la escena se recompone sola según el ancho y alto de su caja.
//  · Se pausa cuando sale de pantalla (IntersectionObserver) y respeta
//    prefers-reduced-motion (ver globals.css).

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** Capa posicionada por centro (x, y en %) con tamaño s en cqmin. */
function L({
  x,
  y,
  s,
  o,
  hide,
  children,
  style,
}: {
  x: number;
  y: number;
  s: number;
  o?: number;
  hide?: boolean; // se oculta en pantallas pequeñas (menos capas = más fluido)
  children: ReactNode;
  style?: Vars;
}) {
  return (
    <div className={`nx-l ${hide ? 'nx-hide-sm' : ''}`} style={{ '--x': x, '--y': y, '--s': s, ...(o !== undefined ? { '--o': o } : {}), ...style } as Vars}>
      {children}
    </div>
  );
}

/** Contenedor que gira (t = segundos por vuelta). */
function Spin({ t = 30, rev = false, children }: { t?: number; rev?: boolean; children?: ReactNode }) {
  return (
    <div className={`nx-a nx-rot ${rev ? 'nx-rev' : ''}`} style={{ '--t': `${t}s` } as Vars}>
      {children}
    </div>
  );
}

function Bob({ d = 0, children }: { d?: number; children: ReactNode }) {
  return (
    <div className="nx-a nx-bob2" style={{ '--d': d } as Vars}>
      {children}
    </div>
  );
}

const svgProps = { viewBox: '0 0 100 100', fill: 'none' } as const;

function DialA() {
  return (
    <svg {...svgProps}>
      <circle cx="50" cy="50" r="46" stroke="currentColor" strokeOpacity=".2" strokeWidth="5" strokeDasharray="0.7 3.6" />
      <circle cx="50" cy="50" r="39" stroke="currentColor" strokeOpacity=".24" strokeWidth=".9" />
      <circle cx="50" cy="50" r="33" stroke="currentColor" strokeOpacity=".3" strokeWidth="1.3" strokeDasharray="12 5 3 5" />
    </svg>
  );
}
function DialB() {
  return (
    <svg {...svgProps}>
      <circle cx="50" cy="50" r="42" stroke="currentColor" strokeOpacity=".3" strokeWidth="1.6" strokeDasharray="26 9 5 9" />
      <circle cx="50" cy="50" r="30" stroke="currentColor" strokeOpacity=".16" strokeWidth="9" strokeDasharray="0.8 5" />
      <circle cx="50" cy="50" r="12" fill="currentColor" fillOpacity=".2" />
      <circle cx="50" cy="50" r="4.5" fill="currentColor" fillOpacity=".5" />
    </svg>
  );
}
function LockSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <rect x="4" y="10" width="16" height="11" rx="3" fill="currentColor" fillOpacity=".2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="15.5" r="1.7" fill="currentColor" fillOpacity=".6" />
    </svg>
  );
}
function PersonSvg() {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11.5" fill="currentColor" fillOpacity=".14" />
      <circle cx="12" cy="9.5" r="3.6" fill="currentColor" fillOpacity=".6" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" fill="currentColor" fillOpacity=".4" />
    </svg>
  );
}
function GearSvg() {
  return (
    <svg {...svgProps}>
      <circle cx="50" cy="50" r="43" stroke="currentColor" strokeOpacity=".22" strokeWidth="7" strokeDasharray="4.2 4.2" />
      <circle cx="50" cy="50" r="34" stroke="currentColor" strokeOpacity=".3" strokeWidth="1.8" />
      <circle cx="50" cy="50" r="12" fill="currentColor" fillOpacity=".18" />
      <path d="M16 50h68M50 16v68" stroke="currentColor" strokeOpacity=".16" strokeWidth="2" />
    </svg>
  );
}

function Vault() {
  return (
    <>
      <L x={76} y={42} s={86}>
        <Spin t={46}>
          <DialA />
        </Spin>
      </L>
      <L x={76} y={42} s={86}>
        <Spin t={30} rev>
          <DialB />
        </Spin>
      </L>
      <L x={16} y={26} s={17}>
        <Bob d={0}>
          <LockSvg />
        </Bob>
      </L>
      <L x={38} y={72} s={11} hide>
        <Bob d={2.4}>
          <LockSvg />
        </Bob>
      </L>
      <L x={7} y={74} s={9} hide>
        <Bob d={4.1}>
          <LockSvg />
        </Bob>
      </L>
      <L x={93} y={86} s={13}>
        <Bob d={1.2}>
          <LockSvg />
        </Bob>
      </L>
    </>
  );
}

// Nodos en % del contenedor; los enlaces y los paquetes usan las mismas coordenadas.
const NODES: [number, number][] = [
  [14, 22],
  [38, 12],
  [66, 26],
  [26, 58],
  [54, 52],
  [86, 62],
  [40, 88],
];
const LINKS: [number, number][] = [
  [0, 1],
  [1, 2],
  [0, 3],
  [1, 4],
  [2, 4],
  [3, 4],
  [4, 5],
  [3, 6],
  [4, 6],
];

function Share() {
  return (
    <>
      {/* líneas: un solo SVG estático que se estira al contenedor */}
      <svg className="nx-lines" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none">
        {LINKS.map(([a, b], i) => (
          <line key={i} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} stroke="currentColor" strokeOpacity=".22" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {NODES.map(([x, y], i) => (
        <L key={i} x={x} y={y} s={4.4}>
          <div className="nx-a nx-ping" style={{ '--d': i * 0.7 } as Vars}>
            <i className="nx-disc" style={{ opacity: 0.16 } as CSSProperties} />
          </div>
          <i className="nx-disc nx-dot" />
        </L>
      ))}
      {LINKS.map(([a, b], i) => {
        const [x1, y1] = NODES[a];
        const [x2, y2] = NODES[b];
        return (
          <L key={`p${i}`} x={x1} y={y1} s={2.2} hide={i > 4}>
            <div
              className="nx-a nx-sweep"
              style={{ '--dx': x2 - x1, '--dy': y2 - y1, '--t': `${3.4 + (i % 4) * 0.8}s`, '--d': i * 0.9 } as Vars}
            >
              <i className="nx-disc nx-packet" />
            </div>
          </L>
        );
      })}
    </>
  );
}

function Teams() {
  // personas repartidas por la circunferencia (ángulos en grados, 0 = arriba)
  const outer = [0, 120, 240];
  const inner = [60, 240];
  const at = (deg: number) => {
    const r = (deg * Math.PI) / 180;
    return { left: `${(50 + 50 * Math.sin(r)).toFixed(2)}%`, top: `${(50 - 50 * Math.cos(r)).toFixed(2)}%` };
  };
  return (
    <>
      <L x={74} y={44} s={96}>
        <i className="nx-ring nx-ring-dash" />
      </L>
      <L x={74} y={44} s={58}>
        <i className="nx-ring" />
      </L>
      <L x={74} y={44} s={96}>
        <Spin t={40}>
          {outer.map((deg) => (
            <div key={deg} className="nx-orb" style={{ ...at(deg), '--s': '0.17' } as Vars}>
              <Spin t={40} rev>
                <PersonSvg />
              </Spin>
            </div>
          ))}
        </Spin>
      </L>
      <L x={74} y={44} s={58}>
        <Spin t={28} rev>
          {inner.map((deg) => (
            <div key={deg} className="nx-orb" style={{ ...at(deg), '--s': '0.2' } as Vars}>
              <Spin t={28}>
                <PersonSvg />
              </Spin>
            </div>
          ))}
        </Spin>
      </L>
      <L x={74} y={44} s={15}>
        <div className="nx-a nx-ping" style={{ '--d': 0 } as Vars}>
          <i className="nx-disc" style={{ opacity: 0.2 } as CSSProperties} />
        </div>
        <i className="nx-disc nx-dot" />
      </L>
    </>
  );
}

function Audit() {
  const blips: [number, number, number][] = [
    [82, 28, 0],
    [66, 56, 0.9],
    [90, 50, 1.8],
    [60, 34, 2.7],
  ];
  return (
    <>
      <L x={74} y={44} s={92}>
        <svg {...svgProps}>
          {[14, 28, 42].map((r) => (
            <circle key={r} cx="50" cy="50" r={r} stroke="currentColor" strokeOpacity=".17" strokeWidth=".9" />
          ))}
          <path d="M4 50h92M50 4v92" stroke="currentColor" strokeOpacity=".12" strokeWidth=".8" />
        </svg>
      </L>
      <L x={74} y={44} s={84}>
        <Spin t={7}>
          <i className="nx-sweep-beam" />
        </Spin>
      </L>
      {blips.map(([x, y, d], i) => (
        <L key={i} x={x} y={y} s={4.4}>
          <div className="nx-a nx-blink" style={{ '--d': d } as Vars}>
            <i className="nx-disc nx-dot" />
          </div>
        </L>
      ))}
      <div className="nx-a nx-scan" aria-hidden />
    </>
  );
}

function Settings() {
  return (
    <>
      <L x={76} y={34} s={70}>
        <Spin t={36}>
          <GearSvg />
        </Spin>
      </L>
      <L x={52} y={66} s={42}>
        <Spin t={21} rev>
          <GearSvg />
        </Spin>
      </L>
      <L x={92} y={74} s={34} hide>
        <Spin t={17} rev>
          <GearSvg />
        </Spin>
      </L>
      <L x={22} y={30} s={26} hide>
        <Spin t={14}>
          <GearSvg />
        </Spin>
      </L>
    </>
  );
}

const DROPS = Array.from({ length: 12 }, (_, i) => ({
  x: 6 + ((i * 41) % 90),
  d: (i * 1.1) % 9,
  s: 1.4 + (i % 3) * 0.7,
  t: 9 + (i % 5),
}));

function Home() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <L key={i} x={50} y={34} s={52}>
          <div className="nx-a nx-ping nx-ping-slow" style={{ '--d': i * 1.6 } as Vars}>
            <i className="nx-ring" />
          </div>
        </L>
      ))}
      {DROPS.map((p, i) => (
        <L key={i} x={p.x} y={0} s={p.s} hide={i > 6}>
          <div className="nx-a nx-fall" style={{ '--d': p.d, '--t': `${p.t}s` } as Vars}>
            <i className="nx-disc" style={{ opacity: 0.3 } as CSSProperties} />
          </div>
        </L>
      ))}
    </>
  );
}

const subscribeNever = () => () => {};
function isWeakDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4 || nav.connection?.saveData === true;
}

const SCENES: Record<Scene, () => ReactNode> = {
  vault: Vault,
  share: Share,
  teams: Teams,
  audit: Audit,
  settings: Settings,
  home: Home,
};

/**
 * `fade` es el color al que se funde la parte inferior del fondo (por defecto
 * el del fondo de la app); en secciones de color usa `fade="#6c5ce7"`.
 */
export function SectionBackdrop({ scene, className = '', fade }: { scene: Scene; className?: string; fade?: string }) {
  const Scn = SCENES[scene];
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  // Equipos modestos (pocos núcleos / poca RAM) o con ahorro de datos: menos
  // capas y movimiento por pasos. En servidor se asume equipo normal.
  const lite = useSyncExternalStore(subscribeNever, isWeakDevice, () => false);

  // Pausa las animaciones cuando el fondo no está en pantalla.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { rootMargin: '80px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`nexor-backdrop text-purple ${active ? '' : 'nx-paused'} ${lite ? 'nx-lite' : ''} ${className}`}
      style={fade ? ({ '--nx-fade': fade } as Vars) : undefined}
    >
      <Scn />
    </div>
  );
}
