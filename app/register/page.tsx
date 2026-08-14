'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  KDF_PARAMS,
  deriveAuthKey,
  deriveMasterKey,
  deriveVaultKey,
  generateSalt,
  hashAuthKey,
} from '@/lib/crypto';
import { useVaultStore } from '@/lib/store';
import { AuthCard, ghostButtonClass, inputClass, primaryButtonClass } from '@/components/AuthCard';

export default function RegisterPage() {
  const router = useRouter();
  const setUnlocked = useVaultStore((s) => s.setUnlocked);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 12) {
      setError('El master password debe tener al menos 12 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setBusy(true);
    try {
      const salt = generateSalt();
      const masterKey = await deriveMasterKey(password, salt);
      const authKey = await deriveAuthKey(masterKey);
      const vaultKey = await deriveVaultKey(masterKey);
      const authHash = await hashAuthKey(authKey);

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, authHash, salt, kdfParams: KDF_PARAMS }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar');

      setUnlocked(email.toLowerCase().trim(), vaultKey);
      router.push('/vault');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Crear vault"
      subtitle={
        <>
          Tu master password nunca sale de este dispositivo. Si lo olvidas,{' '}
          <strong className="text-foreground">no hay forma de recuperar tu vault</strong> — es el precio del
          zero-knowledge.
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="email@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          required
          placeholder="Master password (mín. 12 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <input
          type="password"
          required
          placeholder="Confirma el master password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <button type="submit" disabled={busy} className={primaryButtonClass}>
          {busy ? 'Derivando claves…' : 'Crear vault'}
        </button>

        <Link href="/login" className={`${ghostButtonClass} block text-center`}>
          Ya tengo cuenta
        </Link>
      </form>
    </AuthCard>
  );
}
