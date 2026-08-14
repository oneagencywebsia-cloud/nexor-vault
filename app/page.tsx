import Link from 'next/link';
import { Fingerprint, Lock, ShieldCheck, Users2 } from 'lucide-react';
import { NexorMark } from '@/components/NexorLogo';

const FEATURES = [
  { icon: Lock, label: 'Cifrado E2E', desc: 'AES-256 en tu dispositivo' },
  { icon: ShieldCheck, label: 'Zero-knowledge', desc: 'Nunca vemos tu clave' },
  { icon: Fingerprint, label: '2FA', desc: 'TOTP integrado' },
  { icon: Users2, label: 'Equipos', desc: 'Vaults compartidos' },
];

export default function Home() {
  return (
    <div className="nexor-mesh-bg safe-top safe-bottom relative flex min-h-screen flex-1 flex-col overflow-hidden bg-void px-6">
      {/* halo decorativo, eco del pattern de marca */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, #6c5ce7 0%, transparent 70%)' }}
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center py-16 text-center">
        <div className="mb-7 rounded-[28px] border border-line bg-surface/60 p-5 shadow-[0_0_60px_-15px_rgba(108,92,231,0.5)]">
          <NexorMark size={52} id="hero" />
        </div>

        <h1 className="text-[15px] font-black tracking-[0.22em] text-dim">NEXOR</h1>
        <p className="mt-2 max-w-xs text-[26px] font-black leading-[1.15] tracking-tight text-foreground">
          Secure every connection.
        </p>
        <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-dim">
          Vault de contraseñas zero-knowledge. Cifrado en tu navegador — nosotros nunca vemos tu master password.
        </p>

        <div className="mt-9 flex w-full max-w-xs flex-col gap-3">
          <Link
            href="/register"
            className="rounded-2xl bg-purple py-3.5 text-center text-[15px] font-bold text-white shadow-[0_8px_24px_-8px_rgba(108,92,231,0.7)] transition-transform active:scale-[0.97]"
          >
            Crear vault
          </Link>
          <Link
            href="/login"
            className="rounded-2xl border border-line-strong bg-surface/60 py-3.5 text-center text-[15px] font-semibold text-foreground transition-transform active:scale-[0.97]"
          >
            Iniciar sesión
          </Link>
        </div>

        <div className="mt-14 grid w-full max-w-sm grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-2xl border border-line bg-surface/50 p-4 text-left">
              <Icon size={18} className="text-lavender" strokeWidth={2} />
              <p className="mt-2 text-[13px] font-bold text-foreground">{label}</p>
              <p className="text-[11px] text-dim">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
