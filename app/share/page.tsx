'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Send, Clock } from 'lucide-react';
import { decryptJson, encryptJson, EncryptedBlob } from '@/lib/crypto';
import { decryptSharedPackage, encryptForRecipient } from '@/lib/sharing';
import { useVaultStore } from '@/lib/store';
import { AppShell } from '@/components/AppShell';
import { inputClass, primaryButtonClass } from '@/components/AuthCard';

interface VaultItemData {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
}

interface OwnItem {
  id: string;
  title: string;
  data: VaultItemData;
}

interface IncomingShare {
  id: string;
  encrypted_blob: string;
  wrapped_key: string;
  from_user: { email: string } | { email: string }[];
}

interface OutgoingShare {
  id: string;
  created_at: string;
  to_user: { email: string } | { email: string }[];
}

function firstEmail(u: { email: string } | { email: string }[]): string {
  return Array.isArray(u) ? (u[0]?.email ?? '?') : u.email;
}

export default function SharePage() {
  const router = useRouter();
  const { vaultKey, unlocked } = useVaultStore();
  const [ownItems, setOwnItems] = useState<OwnItem[]>([]);
  const [incoming, setIncoming] = useState<IncomingShare[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingShare[]>([]);
  const [encryptedPrivateKey, setEncryptedPrivateKey] = useState<EncryptedBlob | null>(null);
  const [loading, setLoading] = useState(true);

  const [toEmail, setToEmail] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (unlocked) return;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => router.replace(data.user ? '/unlock' : '/login'));
  }, [unlocked, router]);

  async function reload() {
    if (!vaultKey) return;
    setLoading(true);

    const [meRes, itemsRes, sharesRes] = await Promise.all([
      fetch('/api/auth/me'),
      fetch('/api/vault/items'),
      fetch('/api/share/items'),
    ]);
    const { user } = await meRes.json();
    setEncryptedPrivateKey(user?.encryptedPrivateKey ?? null);

    const { items: rawItems } = await itemsRes.json();
    const decryptedOwn: OwnItem[] = [];
    for (const item of rawItems ?? []) {
      try {
        const blob = JSON.parse(item.encrypted_blob) as EncryptedBlob;
        const data = await decryptJson<VaultItemData>(vaultKey, blob);
        decryptedOwn.push({ id: item.id, title: data.title || '(sin título)', data });
      } catch {
        // omitido
      }
    }
    setOwnItems(decryptedOwn);
    if (decryptedOwn.length > 0) setSelectedItemId((prev) => prev || decryptedOwn[0].id);

    const { incoming: rawIncoming, outgoing: rawOutgoing } = await sharesRes.json();
    setIncoming(rawIncoming ?? []);
    setOutgoing(rawOutgoing ?? []);

    setLoading(false);
  }

  useEffect(() => {
    if (!unlocked || !vaultKey) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, vaultKey]);

  async function onShare(e: React.FormEvent) {
    e.preventDefault();
    if (!vaultKey) return;
    setShareError(null);
    setShareSuccess(null);
    setShareBusy(true);
    try {
      const item = ownItems.find((i) => i.id === selectedItemId);
      if (!item) throw new Error('Selecciona un item');

      const lookupRes = await fetch(`/api/share/lookup?email=${encodeURIComponent(toEmail.toLowerCase().trim())}`);
      const lookupData = await lookupRes.json();
      if (!lookupRes.ok) throw new Error(lookupData.error || 'No se pudo buscar al destinatario');

      const pkg = await encryptForRecipient(lookupData.publicKey, item.data);

      const res = await fetch('/api/share/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail, itemType: 'login', encryptedBlob: pkg.blob, wrappedKey: pkg.wrappedKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo compartir');

      setShareSuccess(`"${item.title}" compartido con ${toEmail}.`);
      setToEmail('');
      await reload();
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setShareBusy(false);
    }
  }

  async function onAccept(share: IncomingShare) {
    if (!vaultKey || !encryptedPrivateKey) return;
    try {
      const data = await decryptSharedPackage<VaultItemData>(vaultKey, encryptedPrivateKey, {
        blob: JSON.parse(share.encrypted_blob),
        wrappedKey: share.wrapped_key,
      });
      const encryptedBlob = await encryptJson(vaultKey, data);
      const saveRes = await fetch('/api/vault/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType: 'login', encryptedBlob }),
      });
      if (!saveRes.ok) throw new Error('No se pudo guardar en tu vault');

      await fetch(`/api/share/items/${share.id}`, { method: 'DELETE' });
      await reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo aceptar el item compartido');
    }
  }

  async function onDecline(shareId: string) {
    await fetch(`/api/share/items/${shareId}`, { method: 'DELETE' });
    await reload();
  }

  if (!unlocked || !vaultKey) {
    return <div className="flex flex-1 items-center justify-center bg-void text-dim">Cargando…</div>;
  }

  return (
    <AppShell title="Compartir">
      <section className="mb-8">
        <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-dim">Recibidos</p>
        {loading ? (
          <p className="text-[13px] text-dim">Cargando…</p>
        ) : incoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-dim">
            Nada pendiente de aceptar.
          </div>
        ) : (
          <ul className="space-y-2">
            {incoming.map((share) => (
              <li key={share.id} className="rounded-2xl border border-line bg-surface/70 p-4">
                <p className="mb-3 text-[13.5px] text-foreground">
                  Item compartido por <strong>{firstEmail(share.from_user)}</strong>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onAccept(share)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-purple py-2.5 text-[13px] font-bold text-white active:scale-95"
                  >
                    <Check size={15} /> Aceptar
                  </button>
                  <button
                    onClick={() => onDecline(share.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong py-2.5 text-[13px] font-semibold text-foreground active:scale-95"
                  >
                    <X size={15} /> Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-dim">Compartir un item</p>
        {ownItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-dim">
            Tu vault está vacío — nada que compartir.
          </div>
        ) : (
          <form onSubmit={onShare} className="space-y-3 rounded-2xl border border-line bg-surface/70 p-4">
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className={inputClass}
            >
              {ownItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <input
              type="email"
              required
              placeholder="Email del destinatario"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              className={inputClass}
            />
            {shareError && <p className="text-[13px] text-danger">{shareError}</p>}
            {shareSuccess && <p className="text-[13px] text-success">{shareSuccess}</p>}
            <button type="submit" disabled={shareBusy} className={`${primaryButtonClass} flex items-center justify-center gap-2`}>
              <Send size={15} /> {shareBusy ? 'Compartiendo…' : 'Compartir'}
            </button>
          </form>
        )}
      </section>

      {outgoing.length > 0 && (
        <section>
          <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-dim">Enviados (pendientes)</p>
          <ul className="space-y-2">
            {outgoing.map((share) => (
              <li
                key={share.id}
                className="flex items-center gap-2 rounded-2xl border border-line bg-surface/70 px-4 py-3 text-[13px] text-dim"
              >
                <Clock size={14} className="shrink-0 text-dim" />
                Pendiente de aceptar por <strong className="text-foreground">{firstEmail(share.to_user)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
