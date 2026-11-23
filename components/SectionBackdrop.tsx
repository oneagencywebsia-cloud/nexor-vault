import type { ReactElement } from 'react';

export type Scene = 'vault' | 'share' | 'teams' | 'audit' | 'settings' | 'home';

// Fondos SVG animados en bucle infinito. Cada escena representa su sección:
//  vault    → dial de caja fuerte girando + candados flotando
//  share    → red de nodos con paquetes viajando entre ellos
//  teams    → órbitas con personas girando alrededor de un núcleo
//  audit    → radar con barrido y puntos que parpadean
//  settings → engranajes girando en sentidos opuestos
//  home     → lluvia suave de nodos + anillos pulsantes (landing / auth)
// Son decorativos (aria-hidden), no reciben puntero y respetan
// prefers-reduced-motion (ver globals.css).

function Lock({ x, y, s = 1, d = 0 }: { x: number; y: number; s?: number; d?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="nx-float" style={{ ['--d' as string]: d }}>
        <rect x="-9" y="-2" width="18" height="14" rx="3.5" fill="currentColor" opacity="0.16" />
        <path d="M-5 -2 v-4 a5 5 0 0 1 10 0 v4" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4" strokeLinecap="round" />
        <circle cx="0" cy="5" r="1.6" fill="currentColor" opacity="0.5" />
      </g>
    </g>
  );
}

function Vault() {
  return (
    <>
      <g className="nx-spin" style={{ transformBox: 'view-box', transformOrigin: '300px 120px' }}>
        <circle cx="300" cy="120" r="104" fill="none" stroke="currentColor" strokeOpacity="0.16" strokeWidth="14" strokeDasharray="2 12" />
        <circle cx="300" cy="120" r="84" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
      </g>
      <g className="nx-spin-rev" style={{ transformBox: 'view-box', transformOrigin: '300px 120px' }}>
        <circle cx="300" cy="120" r="62" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2" strokeDasharray="30 14 6 14" />
        <circle cx="300" cy="120" r="40" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="10" strokeDasharray="1 9" />
      </g>
      <circle cx="300" cy="120" r="14" fill="currentColor" opacity="0.22" />
      <circle cx="300" cy="120" r="5" fill="currentColor" opacity="0.5" />
      <Lock x={60} y={70} s={1.6} d={0} />
      <Lock x={150} y={190} s={1.1} d={2.4} />
      <Lock x={44} y={230} s={0.9} d={4.1} />
      <Lock x={360} y={250} s={1.3} d={1.2} />
    </>
  );
}

const SHARE_NODES: [number, number][] = [
  [60, 60],
  [190, 40],
  [330, 80],
  [110, 170],
  [250, 150],
  [360, 220],
  [180, 260],
];
const SHARE_LINKS: [number, number][] = [
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
      {SHARE_LINKS.map(([a, b], i) => {
        const [x1, y1] = SHARE_NODES[a];
        const [x2, y2] = SHARE_NODES[b];
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeOpacity="0.16" strokeWidth="1.5" />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" className="nx-flow" />
            <circle r="3.2" fill="currentColor" opacity="0.7">
              <animateMotion dur={`${3 + (i % 4)}s`} repeatCount="indefinite" begin={`${-i * 0.7}s`} path={`M${x1} ${y1} L${x2} ${y2}`} />
            </circle>
          </g>
        );
      })}
      {SHARE_NODES.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="14" fill="currentColor" opacity="0.1" className="nx-pulse" style={{ ['--d' as string]: i * 0.6 }} />
          <circle cx={x} cy={y} r="6" fill="currentColor" opacity="0.38" />
        </g>
      ))}
    </>
  );
}

function Teams() {
  const people: [number, number, number][] = [
    [120, 0, 0],
    [120, 120, 1],
    [120, 240, 2],
  ];
  return (
    <>
      <circle cx="240" cy="150" r="20" fill="currentColor" opacity="0.2" />
      <circle cx="240" cy="150" r="8" fill="currentColor" opacity="0.5" />
      <circle cx="240" cy="150" r="120" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeDasharray="4 8" />
      <circle cx="240" cy="150" r="76" fill="none" stroke="currentColor" strokeOpacity="0.18" />
      <g className="nx-spin" style={{ transformBox: 'view-box', transformOrigin: '240px 150px' }}>
        {people.map(([r, deg, i]) => {
          const rad = (deg * Math.PI) / 180;
          const x = 240 + r * Math.cos(rad);
          const y = 150 + r * Math.sin(rad);
          return (
            <g key={i} transform={`translate(${x} ${y})`}>
              <circle r="11" fill="currentColor" opacity="0.16" />
              <circle cy="-2.5" r="3.6" fill="currentColor" opacity="0.55" />
              <path d="M-5.5 6 a5.5 5.5 0 0 1 11 0" fill="currentColor" opacity="0.4" />
            </g>
          );
        })}
      </g>
      <g className="nx-spin-rev" style={{ transformBox: 'view-box', transformOrigin: '240px 150px' }}>
        {[0, 180].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <g key={deg} transform={`translate(${240 + 76 * Math.cos(rad)} ${150 + 76 * Math.sin(rad)})`}>
              <circle r="8" fill="currentColor" opacity="0.16" />
              <circle cy="-1.8" r="2.7" fill="currentColor" opacity="0.5" />
              <path d="M-4 4.4 a4 4 0 0 1 8 0" fill="currentColor" opacity="0.38" />
            </g>
          );
        })}
      </g>
    </>
  );
}

function Audit() {
  const blips: [number, number][] = [
    [300, 90],
    [250, 190],
    [340, 160],
    [210, 110],
  ];
  return (
    <>
      <g>
        {[30, 60, 90, 120].map((r) => (
          <circle key={r} cx="260" cy="150" r={r} fill="none" stroke="currentColor" strokeOpacity="0.16" />
        ))}
        <line x1="130" y1="150" x2="390" y2="150" stroke="currentColor" strokeOpacity="0.12" />
        <line x1="260" y1="20" x2="260" y2="280" stroke="currentColor" strokeOpacity="0.12" />
      </g>
      <g className="nx-spin" style={{ transformBox: 'view-box', transformOrigin: '260px 150px', animationDuration: '6s' }}>
        <path d="M260 150 L260 30 A120 120 0 0 1 345 65 Z" fill="currentColor" opacity="0.2" />
        <line x1="260" y1="150" x2="260" y2="30" stroke="currentColor" strokeOpacity="0.6" strokeWidth="2" />
      </g>
      {blips.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4.5" fill="currentColor" className="nx-blink" style={{ ['--d' as string]: i * 0.8 }} />
      ))}
      <g className="nx-scan">
        <rect x="0" y="0" width="400" height="2" fill="currentColor" opacity="0.28" />
      </g>
    </>
  );
}

function Gear({ cx, cy, r, rev = false, speed = 28 }: { cx: number; cy: number; r: number; rev?: boolean; speed?: number }) {
  return (
    <g className={rev ? 'nx-spin-rev' : 'nx-spin'} style={{ transformBox: 'view-box', transformOrigin: `${cx}px ${cy}px`, animationDuration: `${speed}s` }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth={r * 0.22} strokeDasharray={`${r * 0.2} ${r * 0.2}`} />
      <circle cx={cx} cy={cy} r={r * 0.78} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={r * 0.3} fill="currentColor" opacity="0.16" />
      <line x1={cx - r * 0.78} y1={cy} x2={cx + r * 0.78} y2={cy} stroke="currentColor" strokeOpacity="0.16" strokeWidth="2" />
      <line x1={cx} y1={cy - r * 0.78} x2={cx} y2={cy + r * 0.78} stroke="currentColor" strokeOpacity="0.16" strokeWidth="2" />
    </g>
  );
}

function Settings() {
  return (
    <>
      <Gear cx={300} cy={110} r={74} speed={30} />
      <Gear cx={186} cy={174} r={44} rev speed={18} />
      <Gear cx={360} cy={230} r={34} rev speed={14} />
      <Gear cx={90} cy={70} r={28} speed={12} />
    </>
  );
}

function Home() {
  const dots = Array.from({ length: 14 }, (_, i) => ({
    x: 14 + ((i * 53) % 372),
    d: (i * 0.9) % 9,
    r: 2 + (i % 3),
  }));
  return (
    <>
      {[0, 1, 2].map((i) => (
        <circle key={i} cx="200" cy="120" r="46" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" className="nx-pulse" style={{ ['--d' as string]: i * 1.5 }} />
      ))}
      {dots.map((p, i) => (
        <circle key={i} cx={p.x} cy="0" r={p.r} fill="currentColor" opacity="0.28" className="nx-rain" style={{ ['--d' as string]: p.d, animationDuration: `${8 + (i % 5)}s` }} />
      ))}
    </>
  );
}

const SCENES: Record<Scene, () => ReactElement> = {
  vault: Vault,
  share: Share,
  teams: Teams,
  audit: Audit,
  settings: Settings,
  home: Home,
};

export function SectionBackdrop({ scene, className = '' }: { scene: Scene; className?: string }) {
  const Scn = SCENES[scene];
  return (
    <div aria-hidden className={`nexor-backdrop text-purple ${className}`}>
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMin slice" fill="none">
        <Scn />
      </svg>
    </div>
  );
}
