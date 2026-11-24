import Link from 'next/link';
import { Keyboard, Lock, MousePointerClick, ShieldCheck, Smartphone, Share2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { ExtensionDownload } from '@/components/ExtensionDownload';

export const metadata = { title: 'Extensión de navegador' };

const SECURITY = [
  'No inyecta ningún menú dentro de las webs: el relleno se lanza solo desde el popup o con un atajo (evita el "clickjacking de extensión").',
  'Solo rellena si el dominio coincide exactamente con el guardado. Los subdominios piden confirmación explícita.',
  'Nunca rellena en iframes ni en páginas http (salvo localhost).',
  'Se bloquea sola a los 10 minutos y al cerrar el navegador. La clave vive solo en memoria, nunca en disco.',
  'Permisos mínimos: no puede leer tus pestañas ni tu historial; solo actúa sobre la pestaña activa cuando tú se lo pides.',
];

export default function ExtensionPage() {
  return (
    <AppShell title="Extensión" subtitle="Rellena en un clic desde tu navegador">
      <ExtensionDownload />

      <section className="nexor-rise mb-5 rounded-3xl border border-line bg-surface p-5 pointer-coarse:hidden" style={{ ['--i' as string]: 1 }}>
        <h2 className="text-[16px] font-black">Instalar (2 minutos)</h2>
        <ol className="mt-3 space-y-3 text-[13.5px] leading-relaxed">
          {[
            <>Descarga el archivo y <b>descomprímelo</b> en una carpeta fija (no la borres).</>,
            <>
              En Chrome/Edge/Brave abre <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px]">chrome://extensions</code> y activa el{' '}
              <b>Modo desarrollador</b>.
            </>,
            <>
              Pulsa <b>Cargar descomprimida</b> y elige esa carpeta. Fija el icono de Nexor en la barra.
            </>,
            <>Pulsa el icono, introduce tu email y tu master password, y listo.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-purple/12 text-[12px] font-black text-purple">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[12px] leading-relaxed text-dim">
          <b>Firefox:</b> abre <code className="rounded bg-surface-2 px-1.5 py-0.5">about:debugging</code> → Este Firefox → Cargar complemento temporal y elige el
          archivo <code className="rounded bg-surface-2 px-1.5 py-0.5">manifest.json</code> de la carpeta (temporal hasta que se publique en la tienda de Mozilla).
        </p>
      </section>

      <section className="nexor-rise mb-5 rounded-3xl border border-line bg-surface p-5 pointer-coarse:hidden" style={{ ['--i' as string]: 2 }}>
        <h2 className="text-[16px] font-black">Cómo se usa</h2>
        <ul className="mt-3 space-y-3 text-[13.5px] leading-relaxed">
          <li className="flex gap-3">
            <MousePointerClick size={18} className="mt-0.5 shrink-0 text-purple" />
            <span>
              En una página de login, pulsa el icono y <b>Rellenar</b> junto a tu acceso. También copia usuario, contraseña o código 2FA con un clic.
            </span>
          </li>
          <li className="flex gap-3">
            <Keyboard size={18} className="mt-0.5 shrink-0 text-purple" />
            <span>
              <b>Alt+Shift+L</b> rellena directamente si solo hay un acceso para esa web. <b>Ctrl+Shift+L</b> abre el popup.
            </span>
          </li>
          <li className="flex gap-3">
            <Lock size={18} className="mt-0.5 shrink-0 text-purple" />
            <span>Login en dos pasos (usuario y luego contraseña): vuelve a pulsar Rellenar en el segundo paso.</span>
          </li>
        </ul>
      </section>

      <section className="nexor-rise mb-5 rounded-3xl border border-line bg-surface p-5" style={{ ['--i' as string]: 3 }}>
        <h2 className="flex items-center gap-2 text-[16px] font-black">
          <ShieldCheck size={18} className="text-success" /> Seguridad
        </h2>
        <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-dim">
          {SECURITY.map((s) => (
            <li key={s} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" /> {s}
            </li>
          ))}
        </ul>
      </section>

      <section className="nexor-rise rounded-3xl border border-line bg-surface p-5" style={{ ['--i' as string]: 4 }}>
        <h2 className="flex items-center gap-2 text-[16px] font-black">
          <Smartphone size={18} className="text-purple" /> En el móvil
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-dim">
          Las webs instaladas (PWA) no pueden rellenar contraseñas dentro de otras apps o webs: eso solo lo permite una app nativa. Esto es lo que sí hay hoy:
        </p>
        <ul className="mt-3 space-y-3 text-[13.5px] leading-relaxed">
          <li className="flex gap-3">
            <Share2 size={18} className="mt-0.5 shrink-0 text-purple" />
            <span>
              <b>Android (Chrome):</b> instala Nexor en la pantalla de inicio. En cualquier web pulsa <b>Compartir → Nexor</b> y verás al instante el usuario, la
              contraseña y el código 2FA de ese sitio, con copiar a un toque.
            </span>
          </li>
          <li className="flex gap-3">
            <Smartphone size={18} className="mt-0.5 shrink-0 text-purple" />
            <span>
              <b>Otros navegadores móviles:</b> Chrome para Android no admite extensiones, y Firefox para Android solo instala las publicadas en la tienda de Mozilla (esta aún no lo está). Por eso el menú Compartir es la vía que funciona hoy.
            </span>
          </li>
        </ul>
        <Link href="/open" className="mt-4 inline-block rounded-xl bg-purple/10 px-3.5 py-2 text-[13px] font-bold text-purple">
          Abrir acceso rápido
        </Link>
        <p className="mt-5 text-[12px] text-dim">
          Cómo tratamos tus datos: <Link href="/privacy" className="font-semibold text-purple underline">política de privacidad</Link>.
        </p>
      </section>
    </AppShell>
  );
}
