'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { Check, Download, Laptop, Link2, Smartphone } from 'lucide-react';

const subscribeNever = () => () => {};

// ¿Móvil o tableta? Las extensiones no se instalan desde un archivo en Android
// ni en iOS, así que allí no se ofrece la descarga (solo bajaría un zip inútil).
function isMobileDevice(): boolean {
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua));
}

export function ExtensionDownload() {
  const mobile = useSyncExternalStore(subscribeNever, isMobileDevice, () => false);
  const [copied, setCopied] = useState(false);

  async function sendToComputer() {
    const url = `${window.location.origin}/extension`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Extensión de Nexor Vault', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* el usuario canceló el menú de compartir */
    }
  }

  if (mobile) {
    return (
      <section className="nexor-rise mb-5 rounded-3xl border border-line bg-surface p-5">
        <h2 className="flex items-center gap-2 text-[16px] font-black">
          <Laptop size={18} className="text-purple" /> La extensión es para ordenador
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-dim">
          En el móvil no se instalan extensiones desde un archivo (Chrome para Android no las admite y Firefox solo las de su tienda). Por eso aquí no te ofrezco
          descargarla: no serviría de nada.
        </p>

        <div className="mt-4 rounded-2xl border border-purple/25 bg-purple/5 p-4">
          <p className="flex items-center gap-2 text-[14px] font-black">
            <Smartphone size={16} className="text-purple" /> Lo que sí funciona en el móvil
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-mist">
            En cualquier web pulsa <b>Compartir → Nexor</b> y verás al instante tu usuario, contraseña y código 2FA de ese sitio, con copiar a un toque. En Android,
            instala antes Nexor en la pantalla de inicio.
          </p>
          <Link
            href="/open"
            className="mt-3 inline-block rounded-xl bg-purple px-4 py-2.5 text-[13px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(108,92,231,0.8)] transition-transform active:scale-95"
          >
            Probar acceso rápido
          </Link>
        </div>

        <button
          onClick={sendToComputer}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-line-strong bg-white px-4 py-3 text-[14px] font-bold transition-colors hover:border-purple hover:text-purple"
        >
          {copied ? <Check size={16} className="text-success" /> : <Link2 size={16} />}
          {copied ? 'Enlace copiado' : 'Enviar el enlace a mi ordenador'}
        </button>
      </section>
    );
  }

  return (
    <section className="nexor-rise mb-5 rounded-3xl border border-line bg-surface p-5">
      <h2 className="flex items-center gap-2 text-[16px] font-black">
        <Download size={18} className="text-purple" /> Descargar
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-dim">
        Mismo código para todos los navegadores de ordenador. Todo se descifra en tu navegador, igual que en la web.
      </p>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <a
          href="/downloads/nexor-vault-chrome.zip"
          download
          className="rounded-2xl bg-purple px-4 py-3.5 text-center text-[14px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(108,92,231,0.8)] transition-transform active:scale-95"
        >
          Chrome · Edge · Brave
        </a>
        <a
          href="/downloads/nexor-vault-firefox.zip"
          download
          className="rounded-2xl border border-line-strong bg-white px-4 py-3.5 text-center text-[14px] font-bold transition-colors hover:border-purple hover:text-purple"
        >
          Firefox
        </a>
      </div>
    </section>
  );
}
