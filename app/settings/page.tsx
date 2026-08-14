'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ShieldCheck, Mail } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { inputClass, primaryButtonClass } from '@/components/AuthCard';

type Step = 'loading' | 'idle' | 'setup' | 'disable';

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [step, setStep] = useState<Step>('loading');
  const [secret, setSecret] = useState('');
  const [otpauthUri, setOtpauthUri] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          router.replace('/login');
          return;
        }
        setEmail(data.user.email);
        setTotpEnabled(!!data.user.totpEnabled);
        setStep('idle');
      });
  }, [router]);

  async function startSetup() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/totp/setup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo iniciar la configuración');
      setSecret(data.secret);
      setOtpauthUri(data.otpauthUri);
      setCode('');
      setStep('setup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/totp/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código inválido');
      setTotpEnabled(true);
      setStep('idle');
      setSuccess('2FA activado. A partir de ahora se pedirá el código en cada login.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código inválido');
      setTotpEnabled(false);
      setStep('idle');
      setCode('');
      setSuccess('2FA desactivado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'loading') {
    return <div className="flex flex-1 items-center justify-center bg-void text-dim">Cargando…</div>;
  }

  return (
    <AppShell title="Ajustes">
      <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-dim">Cuenta</p>
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-surface/70 p-4">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-purple/15 text-purple">
          <Mail size={17} />
        </div>
        <p className="truncate text-[14px] font-medium text-foreground">{email}</p>
      </div>

      <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-dim">Seguridad</p>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface/70">
        <button
          onClick={totpEnabled ? () => setStep('disable') : startSetup}
          disabled={busy || step === 'setup' || step === 'disable'}
          className="flex w-full items-center gap-3 p-4 text-left active:bg-surface-2"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-purple/15 text-purple">
            <ShieldCheck size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-foreground">Verificación en dos pasos</p>
            <p className="text-[12px] text-dim">{totpEnabled ? 'Activada' : 'Desactivada'}</p>
          </div>
          <ChevronRight size={18} className="shrink-0 text-dim" />
        </button>

        {step === 'setup' && (
          <form onSubmit={confirmEnable} className="space-y-3 border-t border-line p-4">
            <p className="text-[12.5px] text-dim">
              Añade esta clave a tu app de autenticación (Google Authenticator, Authy, 1Password…):
            </p>
            <p className="break-all rounded-xl border border-line-strong bg-surface-2 p-3 font-mono text-[12.5px] text-mist">
              {secret}
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              placeholder="Código de 6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputClass} text-center font-mono tracking-[0.35em]`}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('idle')}
                className="flex-1 rounded-2xl border border-line-strong py-3 text-[14px] font-semibold text-foreground"
              >
                Cancelar
              </button>
              <button type="submit" disabled={busy} className={`${primaryButtonClass} flex-1`}>
                Confirmar
              </button>
            </div>
          </form>
        )}

        {step === 'disable' && (
          <form onSubmit={confirmDisable} className="space-y-3 border-t border-line p-4">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              placeholder="Código de 6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputClass} text-center font-mono tracking-[0.35em]`}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('idle')}
                className="flex-1 rounded-2xl border border-line-strong py-3 text-[14px] font-semibold text-foreground"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-2xl bg-danger/90 py-3 text-[14px] font-bold text-void active:scale-[0.97]"
              >
                Desactivar
              </button>
            </div>
          </form>
        )}
      </div>

      {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}
      {success && <p className="mt-4 text-[13px] text-success">{success}</p>}
    </AppShell>
  );
}
