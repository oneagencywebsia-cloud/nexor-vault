import Link from 'next/link';
import { Keyboard, Lock, MousePointerClick, ShieldCheck, Smartphone, Share2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { ExtensionDownload } from '@/components/ExtensionDownload';

export const metadata = { title: 'Extensión de navegador' };

const SECURITY = [
  'No inyecta ningún menú dentro de las webs: el relleno se lanza solo desde el popup o con un atajo (evita el "clickjacking de extensión").',
  'Solo rellena si el dominio coincide exactamente con el guardado. Los subdominios piden confirmación explícita.',
  'Nunca rellena en iframes ni en páginas http (salvo localhost).',
  'La clave de tu bóveda vive solo en memoria: se bloquea sola a los 10 minutos y al cerrar el navegador. Nunca se guarda en claro en disco.',
  'Al reabrir el navegador no tienes que iniciar sesión otra vez: solo desbloqueas con tu master password o, si lo activas, con huella, Face ID o llave de seguridad (la clave se guarda cifrada con un secreto que solo tu autenticador puede calcular).',
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
            <>
              Descarga el <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px]">.zip</code> y <b>extráelo</b>: clic derecho → <b>Extraer todo…</b> (Windows) o doble
              clic (Mac). <b>El .zip no se puede cargar tal cual</b>: Chrome necesita la carpeta ya extraída.
            </>,
            <>
              Mueve la carpeta a un sitio fijo (por ejemplo Documentos) y <b>no la borres</b>: Chrome la usa desde ahí.
            </>,
            <>
              Abre <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px]">chrome://extensions</code> (en Edge <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px]">edge://extensions</code>,
              en Brave <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px]">brave://extensions</code>) y activa el <b>Modo desarrollador</b> (arriba a la derecha).
            </>,
            <>
              Pulsa <b>Cargar descomprimida</b>. Se abre un selector que <b>solo muestra carpetas</b> (no verás archivos, es normal): entra en la carpeta extraída y pulsa{' '}
              <b>Seleccionar carpeta</b>.
            </>,
            <>Fija el icono de Nexor en la barra, púlsalo e inicia sesión <b>una sola vez</b> con tu email y tu master password. Después, al abrir el navegador, solo tendrás que desbloquear.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-purple/12 text-[12px] font-black text-purple">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <details className="mt-4 rounded-2xl border border-line bg-white px-4 py-3 text-[13px]">
          <summary className="cursor-pointer font-bold text-purple">¿No te deja cargarla? Mira esto</summary>
          <ul className="mt-3 space-y-2.5 leading-relaxed text-mist">
            <li>
              <b>Estás eligiendo el .zip.</b> No sirve: hay que extraerlo antes y elegir la <b>carpeta</b>.
            </li>
            <li>
              <b>Comprueba que es la carpeta correcta:</b> dentro tienen que estar directamente{' '}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px]">manifest.json</code>,{' '}
              <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px]">popup.html</code> y la carpeta <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px]">icons</code>. Si
              dentro solo ves <i>otra carpeta</i> con el mismo nombre, entra en esa y selecciónala.
            </li>
            <li>
              <b>«Falta el archivo de manifiesto»:</b> has elegido una carpeta de más (la que contiene a la buena) o de menos (la carpeta <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px]">icons</code>).
            </li>
            <li>
              <b>No aparece «Cargar descomprimida»:</b> activa antes el <b>Modo desarrollador</b> (interruptor arriba a la derecha de la página de extensiones).
            </li>
            <li>
              <b>Windows muestra el .zip como si fuera una carpeta</b> al abrirlo: aun así hay que usar <b>Extraer todo…</b>; Chrome no puede leer dentro de un .zip.
            </li>
            <li>
              <b>Lo ves en gris o desactivada:</b> si moviste o borraste la carpeta, Chrome la desactiva. Vuelve a cargarla desde su nueva ubicación.
            </li>
          </ul>
        </details>

        <p className="mt-4 text-[12px] leading-relaxed text-dim">
          <b>Firefox:</b> abre <code className="rounded bg-surface-2 px-1.5 py-0.5">about:debugging</code> → Este Firefox → Cargar complemento temporal y elige el
          archivo <code className="rounded bg-surface-2 px-1.5 py-0.5">manifest.json</code> de la carpeta extraída (aquí sí es un archivo; es temporal y se quita al cerrar Firefox).
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
