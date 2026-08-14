'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Pencil, Trash2, UserPlus, Plus } from 'lucide-react';
import { decryptJson, encryptJson, EncryptedBlob } from '@/lib/crypto';
import { unwrapRawKey, wrapRawKey } from '@/lib/sharing';
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

interface DecryptedItem {
  id: string;
  data: VaultItemData;
}

interface Member {
  role: string;
  user: { email: string } | { email: string }[];
}

const EMPTY_FORM: VaultItemData = { title: '', username: '', password: '', url: '', notes: '' };

function one<T>(v: T | T[]): T {
  return Array.isArray(v) ? v[0] : v;
}

export default function TeamDetailPage() {
  const params = useParams<{ id: string }>();
  const teamId = params.id;
  const router = useRouter();
  const { vaultKey, unlocked } = useVaultStore();

  const [teamName, setTeamName] = useState('');
  const [myRole, setMyRole] = useState<string | null>(null);
  const [teamKey, setTeamKey] = useState<Uint8Array | null>(null);
  const [items, setItems] = useState<DecryptedItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VaultItemData>(EMPTY_FORM);
  const [itemError, setItemError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const canWrite = myRole === 'owner' || myRole === 'editor';

  useEffect(() => {
    if (unlocked) return;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => router.replace(data.user ? '/unlock' : '/login'));
  }, [unlocked, router]);

  async function loadItems(key: Uint8Array) {
    const res = await fetch(`/api/teams/${teamId}/items`);
    const { items: raw } = await res.json();
    const decrypted: DecryptedItem[] = [];
    for (const item of raw ?? []) {
      try {
        const blob = JSON.parse(item.encrypted_blob) as EncryptedBlob;
        const data = await decryptJson<VaultItemData>(key, blob);
        decrypted.push({ id: item.id, data });
      } catch {
        // omitido
      }
    }
    setItems(decrypted);
  }

  async function loadMembers() {
    const res = await fetch(`/api/teams/${teamId}/members`);
    const { members: raw } = await res.json();
    setMembers(raw ?? []);
  }

  useEffect(() => {
    if (!unlocked || !vaultKey || !teamId) return;
    (async () => {
      setLoading(true);
      const [meRes, teamsRes] = await Promise.all([fetch('/api/auth/me'), fetch('/api/teams')]);
      const { user } = await meRes.json();
      const { teams } = await teamsRes.json();
      const mine = (teams ?? []).find((t: { team: { id: string } | { id: string }[] }) => one(t.team).id === teamId);
      if (!mine) {
        router.replace('/teams');
        return;
      }
      setTeamName(one(mine.team).name);
      setMyRole(mine.role);

      const key = await unwrapRawKey(vaultKey, user.encryptedPrivateKey, mine.wrapped_team_key);
      setTeamKey(key);
      await Promise.all([loadItems(key), loadMembers()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, vaultKey, teamId]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setItemError(null);
    setShowForm(true);
  }

  function openEdit(item: DecryptedItem) {
    setEditingId(item.id);
    setForm(item.data);
    setItemError(null);
    setShowForm(true);
  }

  async function onSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!teamKey) return;
    setItemError(null);
    try {
      const encryptedBlob = await encryptJson(teamKey, form);
      if (editingId) {
        const res = await fetch(`/api/teams/${teamId}/items/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedBlob }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems((prev) => prev.map((i) => (i.id === editingId ? { id: editingId, data: form } : i)));
      } else {
        const res = await fetch(`/api/teams/${teamId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemType: 'login', encryptedBlob }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems((prev) => [{ id: data.item.id, data: form }, ...prev]);
      }
      setShowForm(false);
    } catch (err) {
      setItemError(err instanceof Error ? err.message : 'No se pudo guardar');
    }
  }

  async function onDeleteItem(id: string) {
    if (!confirm('¿Borrar este item del vault de equipo?')) return;
    const res = await fetch(`/api/teams/${teamId}/items/${id}`, { method: 'DELETE' });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!teamKey) return;
    setInviteError(null);
    setInviteSuccess(null);
    setInviteBusy(true);
    try {
      const lookupRes = await fetch(`/api/share/lookup?email=${encodeURIComponent(inviteEmail.toLowerCase().trim())}`);
      const lookupData = await lookupRes.json();
      if (!lookupRes.ok) throw new Error(lookupData.error || 'No se pudo buscar al usuario');

      const wrappedTeamKey = await wrapRawKey(lookupData.publicKey, teamKey);
      const res = await fetch(`/api/teams/${teamId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, wrappedTeamKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo invitar');

      setInviteSuccess(`Invitación enviada a ${inviteEmail}.`);
      setInviteEmail('');
      await loadMembers();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setInviteBusy(false);
    }
  }

  const memberList = useMemo(() => members, [members]);

  if (!unlocked || !vaultKey || loading) {
    return <div className="flex flex-1 items-center justify-center bg-void text-dim">Cargando…</div>;
  }

  return (
    <AppShell title={teamName} subtitle={`Tu rol: ${myRole}`}>
      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-dim">Vault del equipo</p>
          {canWrite && (
            <button
              onClick={openCreate}
              className="flex items-center gap-1 rounded-full bg-purple px-3 py-1.5 text-[12px] font-bold text-white active:scale-95"
            >
              <Plus size={13} /> Nuevo
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-dim">
            Vault vacío.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded-2xl border border-line bg-surface/70 p-4">
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-semibold text-foreground">{item.data.title || '(sin título)'}</p>
                  <p className="truncate text-[12px] text-dim">{item.data.username}</p>
                </div>
                {canWrite && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => openEdit(item)}
                      aria-label="Editar"
                      className="grid h-8 w-8 place-items-center rounded-lg text-dim hover:bg-line"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => onDeleteItem(item.id)}
                      aria-label="Borrar"
                      className="grid h-8 w-8 place-items-center rounded-lg text-danger hover:bg-danger/10"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-dim">Miembros</p>
        <ul className="overflow-hidden rounded-2xl border border-line bg-surface/70">
          {memberList.map((m, i) => (
            <li
              key={i}
              className={`flex items-center justify-between px-4 py-3 text-[13.5px] ${i > 0 ? 'border-t border-line' : ''}`}
            >
              <span className="truncate text-foreground">{one(m.user).email}</span>
              <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] capitalize text-dim">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      {myRole === 'owner' && (
        <section>
          <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-dim">Invitar</p>
          <form onSubmit={onInvite} className="space-y-3 rounded-2xl border border-line bg-surface/70 p-4">
            <input
              type="email"
              required
              placeholder="Email a invitar"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className={inputClass}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
              className={inputClass}
            >
              <option value="editor">Editor (puede añadir/editar items)</option>
              <option value="viewer">Viewer (solo lectura)</option>
            </select>
            {inviteError && <p className="text-[13px] text-danger">{inviteError}</p>}
            {inviteSuccess && <p className="text-[13px] text-success">{inviteSuccess}</p>}
            <button type="submit" disabled={inviteBusy} className={`${primaryButtonClass} flex items-center justify-center gap-2`}>
              <UserPlus size={16} /> {inviteBusy ? 'Invitando…' : 'Invitar'}
            </button>
          </form>
        </section>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:px-6">
          <form
            onSubmit={onSaveItem}
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
            {itemError && <p className="text-[13px] text-danger">{itemError}</p>}
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
