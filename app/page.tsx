import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Fingerprint,
  FolderTree,
  KeyRound,
  Laptop,
  Lock,
  MessageCircleWarning,
  Plus,
  ScrollText,
  Share2,
  ShieldCheck,
  Smartphone,
  UserMinus,
  Users2,
} from 'lucide-react';
import { NexorMark } from '@/components/NexorLogo';
import { Reveal } from '@/components/Reveal';
import { SectionBackdrop, type Scene } from '@/components/SectionBackdrop';

const PROBLEMS = [
  {
    icon: MessageCircleWarning,
    color: '#e11d48',
    title: 'Accesos por WhatsApp',
    desc: 'Contraseñas en chats, notas y hojas de cálculo que nadie controla ni puede revocar.',
  },
  {
    icon: UserMinus,
    color: '#f59e0b',
    title: 'Alguien se marcha',
    desc: 'Cuando una persona deja el equipo, ¿sabes a qué cuentas tenía acceso y cuáles debes cambiar?',
  },
  {
    icon: KeyRound,
    color: '#0ea5e9',
    title: 'Todo depende de una persona',
    desc: 'Si solo una persona recuerda dónde está cada acceso, tu negocio tiene un punto único de fallo.',
  },
];

const STEPS: { icon: typeof Lock; scene: Scene; accent: string; accent2: string; title: string; desc: string; points: string[] }[] = [
  {
    icon: Lock,
    scene: 'vault',
    accent: '#6c5ce7',
    accent2: '#38bdf8',
    title: 'Guarda y organiza',
    desc: 'Una bóveda cifrada para todos tus accesos, con carpetas y el logo de cada marca.',
    points: ['Carpetas anidadas', 'Generador de contraseñas', 'Códigos 2FA en vivo por acceso'],
  },
  {
    icon: Share2,
    scene: 'share',
    accent: '#0ea5e9',
    accent2: '#6366f1',
    title: 'Comparte sin exponer',
    desc: 'Envía un acceso a quien lo necesite sin pegar la contraseña en ningún chat.',
    points: ['Compartir un acceso concreto', 'Vaults de equipo con carpetas', 'Avisos al añadir contenido'],
  },
  {
    icon: ScrollText,
    scene: 'audit',
    accent: '#10b981',
    accent2: '#14b8a6',
    title: 'Controla y revisa',
    desc: 'Detecta contraseñas débiles o repetidas y consulta qué ha pasado en tu cuenta.',
    points: ['Auditoría de contraseñas', 'Registro de actividad', 'Bloqueo automático por inactividad'],
  },
];

const USES = [
  { icon: Laptop, color: '#6c5ce7', title: 'Agencias', desc: 'Redes, hosting, anuncios y herramientas de cada cliente, ordenados por carpetas.' },
  { icon: Smartphone, color: '#0ea5e9', title: 'Autónomos', desc: 'Todos tus accesos con 2FA integrado, en el móvil y en el ordenador.' },
  { icon: Users2, color: '#ec4899', title: 'Equipos remotos', desc: 'Un vault compartido por equipo, sin depender de quién tiene qué contraseña.' },
];

const FAQ = [
  {
    q: '¿Pueden ver mis contraseñas?',
    a: 'No. Todo se cifra en tu dispositivo antes de enviarse. Nexor solo almacena datos cifrados y un hash de autenticación: sin tu master password no hay forma de descifrar tu bóveda.',
  },
  {
    q: '¿Qué pasa si olvido mi master password?',
    a: 'Como nadie más puede descifrar tu bóveda, tampoco podemos recuperarla por ti. Por eso conviene guardarla en un sitio seguro y activar el 2FA.',
  },
  {
    q: '¿Cómo se protege mi contraseña maestra?',
    a: 'Se transforma con Argon2id en tu navegador y de ella se derivan, con HKDF, una clave para autenticarte y otra para cifrar. Los datos se cifran con AES-GCM.',
  },
  {
    q: '¿Funciona en el móvil?',
    a: 'Sí. Nexor es una app web instalable (PWA): puedes añadirla a la pantalla de inicio y usarla como una app.',
  },
  {
    q: '¿Puedo compartir accesos con mi equipo?',
    a: 'Sí. Puedes crear equipos, invitar a miembros y compartir vaults con carpetas. Los accesos compartidos también viajan cifrados.',
  },
];

const MARQUEE = ['Redes sociales', 'Hosting y dominios', 'Banca', 'Facturación', 'Anuncios', 'Herramientas de equipo', 'Clientes', 'Proveedores', 'Correo', 'Streaming'];

export default function Home() {
  return (
    <div data-section="home" className="relative flex flex-1 flex-col overflow-x-clip bg-void text-foreground">
      {/* ───────── Navegación ───────── */}
      <header className="safe-top nexor-glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <NexorMark size={26} id="nav" />
            <span className="text-[15px] font-black tracking-[0.18em]">NEXOR</span>
          </Link>
          <nav className="hidden items-center gap-7 text-[13.5px] font-semibold text-mist md:flex">
            <a href="#problema" className="transition-colors hover:text-purple">Problema</a>
            <a href="#como" className="transition-colors hover:text-purple">Cómo funciona</a>
            <a href="#seguridad" className="transition-colors hover:text-purple">Seguridad</a>
            <a href="#faq" className="transition-colors hover:text-purple">Preguntas</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-xl px-3.5 py-2 text-[13.5px] font-semibold text-mist transition-colors hover:text-purple">
              Entrar
            </Link>
            <Link
              href="/register"
              className="nexor-shine rounded-xl bg-purple px-4 py-2 text-[13.5px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(108,92,231,0.8)] transition-transform active:scale-95"
            >
              Crear bóveda
            </Link>
          </div>
        </div>
      </header>

      {/* ───────── Hero ───────── */}
      <section className="nexor-mesh-bg relative isolate">
        <div className="absolute inset-0">
          <SectionBackdrop scene="home" />
        </div>
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 md:grid-cols-[1.05fr_0.95fr] md:pb-28 md:pt-24">
          <div className="text-center md:text-left">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-white/80 px-3.5 py-1.5 text-[12px] font-bold text-purple-deep shadow-sm">
                <ShieldCheck size={14} /> Zero-knowledge · Cifrado E2E · 2FA
              </span>
            </Reveal>
            <Reveal index={1}>
              <h1 className="mt-5 nexor-h1 font-black tracking-tight">
                Tu equipo comparte accesos.{' '}
                <span className="bg-gradient-to-r from-[#6c5ce7] via-[#0ea5e9] to-[#ec4899] bg-clip-text text-transparent">No riesgos.</span>
              </h1>
            </Reveal>
            <Reveal index={2}>
              <p className="mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-dim md:mx-0">
                Gestiona las contraseñas y los códigos 2FA de tu negocio desde un único lugar. Cifrado en tu dispositivo: ni
                siquiera nosotros podemos ver lo que guardas.
              </p>
            </Reveal>
            <Reveal index={3}>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
                <Link
                  href="/register"
                  className="nexor-shine group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple px-7 py-4 text-[16px] font-bold text-white shadow-[0_14px_30px_-10px_rgba(108,92,231,0.85)] transition-transform active:scale-[0.97] sm:w-auto"
                >
                  Crear mi bóveda
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </Link>
                <a
                  href="#como"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-line-strong bg-white px-7 py-4 text-[16px] font-semibold transition-colors hover:border-purple hover:text-purple sm:w-auto"
                >
                  Cómo funciona
                </a>
              </div>
            </Reveal>
            <Reveal index={4}>
              <ul className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] font-semibold text-mist md:justify-start">
                {['Sin anuncios ni rastreo', 'Instalable como app', 'En español'].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <Check size={15} className="text-success" strokeWidth={3} /> {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          {/* Maqueta de la app, con elementos que flotan y el 2FA contando atrás */}
          <Reveal index={2} className="relative mx-auto w-full max-w-[360px]">
            <div className="nx-bob relative rounded-[34px] border border-line-strong bg-white p-3 shadow-[0_40px_80px_-30px_rgba(76,63,196,0.45)]">
              <div className="rounded-[26px] bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <NexorMark size={20} id="mock" />
                    <span className="text-[13px] font-black tracking-wide">Mi bóveda</span>
                  </div>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-purple text-white">
                    <Plus size={15} strokeWidth={3} />
                  </span>
                </div>
                {[
                  { n: 'Instagram', u: 'agencia@cliente.com', c: '#E4405F', l: 'I' },
                  { n: 'Google Ads', u: 'ads@cliente.com', c: '#4285F4', l: 'G' },
                  { n: 'Hosting', u: 'admin@cliente.com', c: '#6c5ce7', l: 'H' },
                ].map((it, i) => (
                  <div
                    key={it.n}
                    className="nexor-rise mb-2 flex items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2.5"
                    style={{ ['--i' as string]: i + 3 }}
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl text-[14px] font-black text-white" style={{ background: it.c }}>
                      {it.l}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold">{it.n}</span>
                      <span className="block truncate text-[11px] text-dim">{it.u}</span>
                    </span>
                    <span className="text-[11px] font-mono text-dim">••••••</span>
                  </div>
                ))}
                {/* tarjeta 2FA con cuenta atrás infinita */}
                <div className="nx-bob mt-3 flex items-center gap-3 rounded-2xl bg-purple px-4 py-3 text-white" style={{ ['--d' as string]: 2 }}>
                  <svg width="34" height="34" viewBox="0 0 36 36" className="-rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3.5" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" pathLength="100" className="nx-countdown" />
                  </svg>
                  <span className="flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider opacity-80">Código 2FA · Instagram</span>
                    <span className="block font-mono text-[20px] font-bold tracking-[0.18em]">482 913</span>
                  </span>
                  <Fingerprint size={22} className="opacity-80" />
                </div>
              </div>
            </div>
            <div className="nx-bob absolute -left-5 top-16 hidden rounded-2xl border border-line-strong bg-white px-3.5 py-2.5 shadow-xl sm:block" style={{ ['--d' as string]: 1 }}>
              <span className="flex items-center gap-2 text-[12px] font-bold">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-success/15 text-success">
                  <Lock size={13} />
                </span>
                Cifrado en tu dispositivo
              </span>
            </div>
            <div className="nx-bob absolute -right-4 bottom-20 hidden rounded-2xl border border-line-strong bg-white px-3.5 py-2.5 shadow-xl sm:block" style={{ ['--d' as string]: 3.5 }}>
              <span className="flex items-center gap-2 text-[12px] font-bold">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-purple/15 text-purple">
                  <Users2 size={13} />
                </span>
                Vault de equipo
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────── Cinta infinita de usos ───────── */}
      <div className="overflow-hidden border-y border-line bg-surface py-4" aria-hidden>
        <div className="nexor-marquee">
          {[...MARQUEE, ...MARQUEE].map((t, i) => (
            <span key={i} className="mx-5 flex items-center gap-2.5 whitespace-nowrap text-[14px] font-bold text-dim">
              <span className="h-1.5 w-1.5 rounded-full bg-purple" />
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* ───────── Problema ───────── */}
      <section id="problema" className="nexor-lazy-section relative scroll-mt-16 bg-gradient-to-b from-white via-white to-rose-50/50 py-14 sm:py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-purple">El problema</p>
            <h2 className="mt-3 max-w-2xl nexor-h2 font-black tracking-tight">
              Tu negocio no debería depender de quién recuerda cada contraseña.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PROBLEMS.map(({ icon: Icon, title, desc, color }, i) => (
              <Reveal key={title} index={i}>
                <div className="group h-full rounded-3xl border border-line bg-surface p-7 transition-all duration-300 hover:-translate-y-1.5 hover:border-purple/40 hover:bg-white hover:shadow-[0_24px_50px_-24px_rgba(76,63,196,0.45)]">
                  <span
                    className="grid h-12 w-12 place-items-center rounded-2xl transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110"
                    style={{ background: color + '1f', color }}
                  >
                    <Icon size={22} />
                  </span>
                  <h3 className="mt-5 text-[19px] font-black">{title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-dim">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Cómo funciona (cada paso con su fondo animado) ───────── */}
      <section id="como" className="nexor-lazy-section relative scroll-mt-16 bg-gradient-to-b from-rose-50/50 via-surface to-sky-50/60 py-14 sm:py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-purple">Cómo funciona</p>
            <h2 className="mt-3 max-w-2xl nexor-h2 font-black tracking-tight">
              Tres pasos y tus accesos dejan de ser un riesgo.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {STEPS.map(({ icon: Icon, scene, accent, accent2, title, desc, points }, i) => (
              <Reveal key={title} index={i}>
                <article
                  className="group relative h-full overflow-hidden rounded-3xl border border-line bg-white p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_60px_-28px_var(--nx-accent)]"
                  style={{ ['--nx-accent' as string]: accent, ['--nx-accent-2' as string]: accent2 }}
                >
                  <div className="absolute inset-x-0 top-0 h-48 opacity-70 transition-opacity duration-500 group-hover:opacity-100">
                    <SectionBackdrop scene={scene} />
                  </div>
                  <div className="relative z-10 pt-24">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-[0_10px_24px_-10px_var(--nx-accent)]" style={{ background: accent }}>
                      <Icon size={22} />
                    </span>
                    <p className="mt-5 text-[12px] font-black uppercase tracking-widest" style={{ color: accent }}>
                      Paso {i + 1}
                    </p>
                    <h3 className="mt-1 text-[22px] font-black">{title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-dim">{desc}</p>
                    <ul className="mt-5 space-y-2">
                      {points.map((p) => (
                        <li key={p} className="flex items-center gap-2 text-[14px] font-semibold text-mist">
                          <Check size={15} className="shrink-0 text-success" strokeWidth={3} /> {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Seguridad ───────── */}
      <section id="seguridad" className="nexor-lazy-section relative scroll-mt-16 bg-gradient-to-b from-sky-50/60 via-white to-white py-14 sm:py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
          <Reveal>
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-purple">Seguridad</p>
            <h2 className="mt-3 nexor-h2 font-black tracking-tight">
              No es una promesa. Es cómo está construido.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-dim">
              Tu master password nunca sale de tu dispositivo. Con ella se derivan las claves en tu navegador y todo se cifra
              antes de enviarse. El servidor solo guarda datos que no puede leer.
            </p>
            <ul className="mt-7 space-y-3.5">
              {[
                ['Argon2id', 'Protege tu master password frente a ataques por fuerza bruta.'],
                ['HKDF', 'Claves separadas: una para autenticarte y otra para cifrar.'],
                ['AES-GCM', 'Cada dato se cifra con cifrado autenticado.'],
                ['2FA / TOTP', 'Códigos de verificación integrados, por acceso y para tu cuenta.'],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3.5">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-success/12 text-success">
                    <Check size={15} strokeWidth={3} />
                  </span>
                  <span className="text-[15px] leading-snug">
                    <b className="font-black">{t}.</b> <span className="text-dim">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* diagrama: dispositivo → servidor (solo ve cifrado) → equipo */}
          <Reveal index={2}>
            <div className="relative overflow-hidden rounded-[32px] border border-line bg-surface p-6 md:p-8">
              <div className="absolute inset-0 opacity-60">
                <SectionBackdrop scene="share" fade="var(--nexor-surface)" />
              </div>
              <div className="relative z-10 grid items-center gap-3 text-center sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
                {[
                  { icon: Laptop, t: 'Tu dispositivo', d: 'Cifra y descifra', tone: 'bg-purple text-white' },
                  { icon: ShieldCheck, t: 'Nexor', d: 'Solo ve datos cifrados', tone: 'bg-white text-purple border border-line-strong' },
                  { icon: Users2, t: 'Tu equipo', d: 'Descifra con su clave', tone: 'bg-purple text-white' },
                ].flatMap(({ icon: Icon, t, d, tone }, i) => {
                  const node = (
                    <div key={t} className="flex flex-col items-center">
                      <span className={`nx-bob grid h-16 w-16 place-items-center rounded-2xl shadow-lg ${tone}`} style={{ ['--d' as string]: i * 1.4 }}>
                        <Icon size={28} />
                      </span>
                      <p className="mt-3 text-[14px] font-black">{t}</p>
                      <p className="text-[12px] text-dim">{d}</p>
                    </div>
                  );
                  return i < 2
                    ? [
                        node,
                        <div key={`a${i}`} className="mx-auto h-8 w-px bg-gradient-to-b from-purple/10 to-purple sm:h-px sm:w-12 sm:bg-gradient-to-r" aria-hidden>
                          <span className="sr-only">cifrado</span>
                        </div>,
                      ]
                    : [node];
                })}
              </div>
              <p className="relative z-10 mt-6 rounded-2xl bg-white/80 px-4 py-3 text-center text-[13px] font-semibold text-mist">
                Los datos viajan y se guardan cifrados. Sin tu master password no hay forma de leerlos.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────── Casos de uso ───────── */}
      <section className="relative bg-gradient-to-b from-white via-surface to-fuchsia-50/50 py-14 sm:py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-purple">Para quién es</p>
            <h2 className="mt-3 max-w-2xl nexor-h2 font-black tracking-tight">
              Hecho para quien gestiona muchos accesos.
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {USES.map(({ icon: Icon, title, desc, color }, i) => (
              <Reveal key={title} index={i}>
                <div className="group flex h-full gap-4 rounded-3xl border border-line bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-purple/40">
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--c)_12%,transparent)] text-[var(--c)] transition-colors group-hover:bg-[var(--c)] group-hover:text-white"
                    style={{ ['--c' as string]: color }}
                  >
                    <Icon size={22} />
                  </span>
                  <div>
                    <h3 className="text-[18px] font-black">{title}</h3>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-dim">{desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal index={3}>
            <p className="mt-8 flex items-center justify-center gap-2 text-center text-[14px] font-semibold text-mist">
              <FolderTree size={16} className="text-purple" /> Carpetas, equipos y compartir en una sola app.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section id="faq" className="nexor-lazy-section relative scroll-mt-16 py-14 sm:py-20 md:py-28">
        <div className="mx-auto max-w-3xl px-5">
          <Reveal>
            <p className="text-center text-[12px] font-black uppercase tracking-[0.2em] text-purple">Preguntas frecuentes</p>
            <h2 className="mt-3 text-center nexor-h2 font-black tracking-tight">
              Lo que suelen preguntarnos.
            </h2>
          </Reveal>
          <div className="mt-10 space-y-3">
            {FAQ.map(({ q, a }, i) => (
              <Reveal key={q} index={i}>
                <details className="nexor-faq group rounded-2xl border border-line bg-surface px-5 py-4 transition-colors open:border-purple/40 open:bg-white">
                  <summary className="flex items-center justify-between gap-4 text-[16px] font-bold">
                    {q}
                    <span className="faq-plus grid h-7 w-7 shrink-0 place-items-center rounded-full bg-purple/10 text-purple">
                      <Plus size={16} strokeWidth={3} />
                    </span>
                  </summary>
                  <p className="faq-body mt-3 text-[15px] leading-relaxed text-dim">{a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── CTA final ───────── */}
      <section className="relative isolate overflow-hidden bg-purple py-20 text-center text-white md:py-24">
        <div className="absolute inset-0 opacity-30">
          <SectionBackdrop scene="home" fade="#6c5ce7" className="!text-white" />
        </div>
        <div className="relative z-10 mx-auto max-w-2xl px-5">
          <Reveal>
            <h2 className="nexor-h2 font-black tracking-tight">Organiza tus accesos hoy.</h2>
            <p className="mt-4 text-[17px] text-white/85">Crea tu bóveda en un minuto y guarda tu primer acceso.</p>
            <Link
              href="/register"
              className="nexor-shine group mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-[16px] font-black text-purple-deep shadow-[0_18px_40px_-14px_rgba(0,0,0,0.5)] transition-transform active:scale-[0.97]"
            >
              Crear mi bóveda
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className="safe-bottom border-t border-line bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-[13px] text-dim sm:flex-row">
          <span className="flex items-center gap-2 font-bold text-foreground">
            <NexorMark size={18} id="foot" /> NEXOR · Secure every connection
          </span>
          <span className="flex gap-5 font-semibold">
            <Link href="/login" className="hover:text-purple">Iniciar sesión</Link>
            <Link href="/register" className="hover:text-purple">Crear cuenta</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
