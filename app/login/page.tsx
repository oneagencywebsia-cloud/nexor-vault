'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { deriveAuthKey, deriveMasterKey, deriveVaultKey, hashAuthKey } from '@/lib/crypto';
import { useVaultStore } from '@/lib/store';
import { AuthCard, ghostButtonClass, inputClass, primaryButtonClass } from '@/components/AuthCard';

export default function LoginPage() {
  const router = useRouter();
  const setUnlocked = useVaultStore((s) => s.setUnlocked);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingVaultKey, setPendingVaultKey] = useState<Uint8Array | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const saltRes = await fetch(`/api/auth/salt?email=${encodeURIComponent(normalizedEmail)}`);
      const { salt } = await saltRes.json();

      const masterKey = await deriveMasterKey(password, salt);
      const authKey = await deriveAuthKey(masterKey);
      const vaultKey = await deriveVaultKey(masterKey);
      const authHash = await hashAuthKey(authKey);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, authHash }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Credenciales inválidas');

      if (data.requiresTotp) {
        setPendingToken(data.pendingToken);
        setPendingVaultKey(vaultKey);
        setPendingEmail(normalizedEmail);
        return;
      }

      setUnlocked(normalizedEmail, vaultKey);
      router.push('/vault');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitTotp(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingToken || !pendingVaultKey || !pendingEmail) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/totp/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, code: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código incorrecto');

      setUnlocked(pendingEmail, pendingVaultKey);
      router.push('/vault');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  }

  if (pendingToken) {
    return (
      <AuthCard title="Verificación en dos pasos" subtitle="Introduce el código de 6 dígitos de tu app de autenticación.">
        <form onSubmit={onSubmitTotp} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            placeholder="123456"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            className={`${inputClass} text-center font-mono text-[20px] tracking-[0.4em]`}
          />
          {error && <p className="text-[13px] text-danger">{error}</p>}
          <button type="submit" disabled={busy} className={primaryButtonClass}>
            {busy ? 'Verificando…' : 'Verificar'}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Bienvenido de nuevo">
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
          placeholder="Master password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <button type="submit" disabled={busy} className={primaryButtonClass}>
          {busy ? 'Verificando…' : 'Entrar'}
        </button>

        <Link href="/register" className={`${ghostButtonClass} block text-center`}>
          Crear cuenta nueva
        </Link>
      </form>
    </AuthCard>
  );
}
