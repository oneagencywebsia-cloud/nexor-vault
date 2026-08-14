'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deriveAuthKey, deriveMasterKey, deriveVaultKey, hashAuthKey } from '@/lib/crypto';
import { useVaultStore } from '@/lib/store';
import { AuthCard, inputClass, primaryButtonClass } from '@/components/AuthCard';
import { Lock } from 'lucide-react';

export default function UnlockPage() {
  const router = useRouter();
  const setUnlocked = useVaultStore((s) => s.setUnlocked);
  const [email, setEmail] = useState<string | null>(null);
  const [salt, setSalt] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          router.replace('/login');
          return;
        }
        setEmail(data.user.email);
        setSalt(data.user.salt);
      });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!salt || !email) return;
    setBusy(true);
    setError(null);
    try {
      const masterKey = await deriveMasterKey(password, salt);
      const authKey = await deriveAuthKey(masterKey);
      const vaultKey = await deriveVaultKey(masterKey);
      const authHash = await hashAuthKey(authKey);

      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authHash }),
      });
      if (!res.ok) throw new Error('Master password incorrecto');

      setUnlocked(email, vaultKey);
      router.push('/vault');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  }

  if (!email) {
    return <div className="flex flex-1 items-center justify-center bg-void text-dim">Cargando…</div>;
  }

  return (
    <AuthCard
      title="Vault bloqueado"
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <Lock size={13} className="text-purple" />
          {email}
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="password"
          required
          autoFocus
          placeholder="Master password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <button type="submit" disabled={busy} className={primaryButtonClass}>
          {busy ? 'Verificando…' : 'Desbloquear'}
        </button>
      </form>
    </AuthCard>
  );
}
