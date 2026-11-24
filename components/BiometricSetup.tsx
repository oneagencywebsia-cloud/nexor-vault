'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { Fingerprint } from 'lucide-react';
import { BioError, enrollWebBio, getWebBio, removeWebBio, webBioSupported } from '@/lib/biometric-web';
import { useVaultStore } from '@/lib/store';

const subscribeNever = () => () => {};

// Ajustes → desbloqueo con huella / Face ID / Touch ID / Windows Hello / llave de seguridad.
export function BiometricSetup({ email }: { email: string }) {
  const { vaultKey, unlocked } = useVaultStore();
  const supported = useSyncExternalStore(subscribeNever, webBioSupported, () => false);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `enrolled` se lee del dispositivo la primera vez que hace falta (no se guarda hasta que el usuario actúa).
  const isOn = enrolled ?? (email ? getWebBio(email) !== null : false);

  async function enable() {
    if (!vaultKey) return;
    setBusy(true);
    setError(null);
    try {
      await enrollWebBio(email, vaultKey);
      setEnrolled(true);
    } catch (err) {
      setError(err instanceof BioError ? err.message : 'No se pudo activar.');
    } finally {
      setBusy(false);
    }
  }

  function disable() {
    removeWebBio(email);
    setEnrolled(false);
  }

  return (
    <>
      <p className="mb-2 mt-6 px-1 text-[12px] font-semibold uppercase tracking-wide text-dim">Desbloqueo rápido</p>
      <div className="overflow-hidden rounded-2xl border border-line bg-surface/70 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-purple/15 text-purple">
            <Fingerprint size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-foreground">Huella, Face ID o llave de seguridad</p>
            <p className="text-[12px] text-dim">
              {!supported
                ? 'Este navegador o dispositivo no lo admite.'
                : isOn
                  ? 'Activado en este dispositivo'
                  : 'Desbloquea sin escribir la master password'}
            </p>
          </div>
          {supported &&
            (isOn ? (
              <button onClick={disable} className="shrink-0 rounded-xl border border-line-strong bg-white px-3.5 py-2 text-[13px] font-bold text-danger">
                Desactivar
              </button>
            ) : (
              <button
                onClick={enable}
                disabled={busy || !unlocked}
                className="shrink-0 rounded-xl bg-purple px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-50"
              >
                {busy ? 'Verificando…' : 'Activar'}
              </button>
            ))}
        </div>

        {supported && !isOn && !unlocked && (
          <p className="mt-3 text-[12.5px] leading-relaxed text-dim">
            Para activarlo hay que tener la bóveda desbloqueada.{' '}
            <Link href="/unlock?next=/settings" className="font-semibold text-purple underline">
              Desbloquear ahora
            </Link>
          </p>
        )}
        {error && <p className="mt-3 text-[12.5px] text-danger">{error}</p>}
        <p className="mt-3 text-[11.5px] leading-relaxed text-dim">
          En este dispositivo solo se guarda tu clave ya cifrada con el secreto de tu huella/Face ID/llave: sin ellos no sirve de nada. La master password sigue
          funcionando siempre. En iPhone hace falta iOS 18 o posterior.
        </p>
      </div>
    </>
  );
}
