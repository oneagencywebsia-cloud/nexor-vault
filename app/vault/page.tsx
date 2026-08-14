'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Copy, Pencil, Trash2, Search, Plus, Lock, LogOut } from 'lucide-react';
import { decryptJson, encryptJson, EncryptedBlob } from '@/lib/crypto';
import { encryptPrivateKey, generateKeyPair } from '@/lib/sharing';
import { useVaultStore } from '@/lib/store';
import AutoLock from '@/components/AutoLock';
import PasswordGenerator from '@/components/PasswordGenerator';
import { AppShell } from '@/components/AppShell';
import { inputClass, primaryButtonClass } from '@/components/AuthCard';

interface VaultItemData {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
}

interface RawItem {
  id: string;
  item_type: string;
  encrypted_blob: string;
  folder_id: string | null;
  updated_at: string;
}

interface DecryptedItem {
  id: string;
  updatedAt: string;
  data: VaultItemData;
}

const EMPTY_FORM: VaultItemData = { title: '', username: '', password: '', url: '', notes: '' };
const AVATAR_TONES = ['#6c5ce7', '#8b7cf6', '#b8b3ff', '#34d399', '#fbbf24', '#fb7185'];

function avatarTone(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export default function VaultPage() {
  const router = useRouter();
  const { email, vaultKey, unlocked, lock } = useVaultStore();
  const [items, setItems] = useState<DecryptedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VaultItemData>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (unlocked) return;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => router.replace(data.user ? '/unlock' : '/login'));
  }, [unlocked, router]);

  useEffect(() => {
    if (!unlocked || !vaultKey) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch('/api/vault/items');
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const { items: raw } = (await res.json()) as { items: RawItem[] };
      const decrypted: DecryptedItem[] = [];
      for (const item of raw) {
        try {
          const blob = JSON.parse(item.encrypted_blob) as EncryptedBlob;
          const data = await decryptJson<VaultItemData>(vaultKey, blob);
          decrypted.push({ id: item.id, updatedAt: item.updated_at, data });
        } catch {
          // item cifrado con otra key (no debería pasar) — se omite en vez de romper la lista
        }
      }
      if (!cancelled) {
        setItems(decrypted);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unlocked, vaultKey]);

  // Aprovisiona el par de claves de "compartir" la primera vez que el vault
  // se desbloquea (idempotente: el server ignora si ya existen). Necesita
  // vaultKey para cifrar la privada, así que solo puede pasar aquí.
  useEffect(() => {
    if (!unlocked || !vaultKey) return;
    (async () => {
      const res = await fetch('/api/auth/me');
      const { user } = await res.json();
      if (user?.publicKey) return;
      const { publicKeyB64, privateKeyB64 } = await generateKeyPair();
      const encryptedPrivateKey = await encryptPrivateKey(vaultKey, privateKeyB64);
      await fetch('/api/auth/keys/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: publicKeyB64, encryptedPrivateKey }),
      });
    })();
  }, [unlocked, vaultKey]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.data.title.toLowerCase().includes(q) ||
        i.data.username.toLowerCase().includes(q) ||
        i.data.url.toLowerCase().includes(q),
    );
  }, [items, query]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(item: DecryptedItem) {
    setEditingId(item.id);
    setForm(item.data);
    setError(null);
    setShowForm(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!vaultKey) return;
    setError(null);
    try {
      const encryptedBlob = await encryptJson(vaultKey, form);
      if (editingId) {
        const res = await fetch(`/api/vault/items/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedBlob }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems((prev) =>
          prev.map((i) => (i.id === editingId ? { id: editingId, updatedAt: data.item.updated_at, data: form } : i)),
        );
      } else {
        const res = await fetch('/api/vault/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemType: 'login', encryptedBlob }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems((prev) => [{ id: data.item.id, updatedAt: data.item.updated_at, data: form }, ...prev]);
      }
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    }
  }

  async function onDelete(id: string) {
    if (!confirm('¿Borrar este item del vault?')) return;
    const res = await fetch(`/api/vault/items/${id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function onLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    lock();
    router.push('/login');
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  if (!unlocked || !vaultKey) {
    return <div className="flex flex-1 items-center justify-center bg-void text-dim">Cargando…</div>;
  }

  return (
    <AppShell
      title="Vault"
      subtitle={email ?? undefined}
      right={
        <>
          <button
            onClick={() => {
              lock();
              router.push('/unlock');
            }}
            aria-label="Bloquear"
            className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-dim active:scale-90"
          >
            <Lock size={16} />
          </button>
          <button
            onClick={onLogout}
            aria-label="Cerrar sesión"
            className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-dim active:scale-90"
          >
            <LogOut size={16} />
          </button>
        </>
      }
    >
      <AutoLock />

      <div className="relative mb-5">
        <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dim" />
        <input
          placeholder="Buscar en el vault…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${inputClass} pl-11`}
        />
      </div>

      {loading && <p className="text-[13px] text-dim">Descifrando vault…</p>}
      {!loading && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center">
          <p className="text-[13px] text-dim">
            {items.length === 0 ? 'Tu vault está vacío. Crea tu primer item.' : 'Sin resultados.'}
          </p>
        </div>
      )}

      <ul className="space-y-2.5">
        {filtered.map((item) => (
          <li key={item.id} className="rounded-2xl border border-line bg-surface/70 p-4">
            <div className="flex items-center gap-3">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[15px] font-bold text-white"
                style={{ background: avatarTone(item.data.title || item.id) }}
              >
                {(item.data.title || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-foreground">{item.data.title || '(sin título)'}</p>
                <p className="truncate text-[12.5px] text-dim">{item.data.username || item.data.url || '—'}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
              <span className="truncate font-mono text-[13px] text-mist">
                {revealId === item.id ? item.data.password : '••••••••••••'}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <IconBtn onClick={() => setRevealId(revealId === item.id ? null : item.id)} label={revealId === item.id ? 'Ocultar' : 'Ver'}>
                  {revealId === item.id ? <EyeOff size={15} /> : <Eye size={15} />}
                </IconBtn>
                <IconBtn onClick={() => copy(item.data.password)} label="Copiar">
                  <Copy size={15} />
                </IconBtn>
                <IconBtn onClick={() => openEdit(item)} label="Editar">
                  <Pencil size={15} />
                </IconBtn>
                <IconBtn onClick={() => onDelete(item.id)} label="Borrar" danger>
                  <Trash2 size={15} />
                </IconBtn>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button
        onClick={openCreate}
        aria-label="Nuevo item"
        className="fixed bottom-24 right-5 z-20 grid h-14 w-14 place-items-center rounded-full bg-purple text-white shadow-[0_10px_30px_-8px_rgba(108,92,231,0.8)] transition-transform active:scale-90"
      >
        <Plus size={26} strokeWidth={2.4} />
      </button>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:px-6">
          <form
            onSubmit={onSave}
            className="safe-bottom w-full max-w-md space-y-3 rounded-t-[28px] border border-line bg-surface p-6 sm:rounded-[28px]"
          >
            <div className="mx-auto -mt-1 mb-2 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" />
            <h2 className="text-[17px] font-bold text-foreground">{editingId ? 'Editar item' : 'Nuevo item'}</h2>

            <input
              placeholder="Título"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              className={inputClass}
            />
            <input
              placeholder="Usuario / email"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className={inputClass}
            />
            <input
              placeholder="Contraseña"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={`${inputClass} font-mono`}
            />

            <PasswordGenerator onUse={(pwd) => setForm((f) => ({ ...f, password: pwd }))} />

            <input
              placeholder="URL"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className={inputClass}
            />
            <textarea
              placeholder="Notas"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className={inputClass}
            />

            {error && <p className="text-[13px] text-danger">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-2xl border border-line-strong py-3 text-[14px] font-semibold text-foreground"
              >
                Cancelar
              </button>
              <button type="submit" className={`${primaryButtonClass} flex-1`}>
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`grid h-8 w-8 place-items-center rounded-lg transition-colors active:scale-90 ${
        danger ? 'text-danger hover:bg-danger/10' : 'text-dim hover:bg-line'
      }`}
    >
      {children}
    </button>
  );
}
