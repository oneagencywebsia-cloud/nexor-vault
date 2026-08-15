'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Pencil,
  Trash2,
  UserPlus,
  Plus,
  Check,
  X,
  Home,
  ChevronRight,
  FolderPlus,
  FolderOpen,
  MoreHorizontal,
  FolderInput,
} from 'lucide-react';
import { decryptJson, encryptJson, EncryptedBlob } from '@/lib/crypto';
import { unwrapRawKey, wrapRawKey } from '@/lib/sharing';
import { useVaultStore } from '@/lib/store';
import { matchBrandIcon } from '@/lib/brand-icon';
import { collectDescendants, type FolderNode } from '@/lib/folder-tree';
import { AppShell } from '@/components/AppShell';
import { BrandIcon } from '@/components/BrandIcon';
import { FolderPicker } from '@/components/FolderPicker';
import { TotpCode } from '@/components/TotpCode';
import { TotpSecretInput } from '@/components/TotpSecretInput';
import { inputClass, primaryButtonClass } from '@/components/AuthCard';

interface VaultItemData {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  totpSecret?: string;
}

interface DecryptedItem {
  id: string;
  folderId: string | null;
  data: VaultItemData;
}

type DecryptedFolder = FolderNode;

interface Member {
  role: string;
  user: { email: string } | { email: string }[];
}

const EMPTY_FORM: VaultItemData = { title: '', username: '', password: '', url: '', notes: '', totpSecret: '' };
const AVATAR_TONES = ['#6c5ce7', '#8b7cf6', '#b8b3ff', '#34d399', '#fbbf24', '#fb7185'];

function avatarTone(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

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
  const [folders, setFolders] = useState<DecryptedFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VaultItemData>(EMPTY_FORM);
  const [formFolderId, setFormFolderId] = useState<string | null>(null);
  const [itemError, setItemError] = useState<string | null>(null);

  const [showFolderForm, setShowFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [actionFolderId, setActionFolderId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canWrite = myRole === 'owner' || myRole === 'editor';
  const isOwner = myRole === 'owner';

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
        decrypted.push({ id: item.id, folderId: item.folder_id, data });
      } catch {
        // omitido
      }
    }
    setItems(decrypted);
  }

  async function loadFolders(key: Uint8Array) {
    const res = await fetch(`/api/teams/${teamId}/folders`);
    const { folders: raw } = await res.json();
    const decrypted: DecryptedFolder[] = [];
    for (const folder of raw ?? []) {
      try {
        const blob = JSON.parse(folder.encrypted_name) as EncryptedBlob;
        const { name } = await decryptJson<{ name: string }>(key, blob);
        decrypted.push({ id: folder.id, name, parentId: folder.parent_id });
      } catch {
        // omitido
      }
    }
    setFolders(decrypted);
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
      await Promise.all([loadItems(key), loadFolders(key), loadMembers()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, vaultKey, teamId]);

  // Al volver a esta pestaña se refresca el vault del equipo sin recargar
  // — útil de verdad en equipo: si otro miembro añade algo, lo ves en
  // cuanto vuelves a mirar, sin tener que darle a F5.
  useEffect(() => {
    if (!unlocked || !teamKey) return;
    function refresh() {
      if (document.visibilityState !== 'visible') return;
      loadItems(teamKey!);
      loadFolders(teamKey!);
      loadMembers();
    }
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, teamKey]);

  const folderMap = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const breadcrumb = useMemo(() => {
    const path: DecryptedFolder[] = [];
    let cur = activeFolderId ? folderMap.get(activeFolderId) : undefined;
    while (cur) {
      path.unshift(cur);
      cur = cur.parentId ? folderMap.get(cur.parentId) : undefined;
    }
    return path;
  }, [activeFolderId, folderMap]);
  const childFolders = useMemo(() => folders.filter((f) => f.parentId === activeFolderId), [folders, activeFolderId]);
  const visibleItems = useMemo(() => items.filter((i) => i.folderId === activeFolderId), [items, activeFolderId]);

  function folderStats(id: string) {
    const subfolders = folders.filter((f) => f.parentId === id).length;
    const directItems = items.filter((i) => i.folderId === id).length;
    return { subfolders, directItems };
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormFolderId(activeFolderId);
    setItemError(null);
    setShowForm(true);
  }

  function openEdit(item: DecryptedItem) {
    setEditingId(item.id);
    setForm(item.data);
    setFormFolderId(item.folderId);
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
          body: JSON.stringify({ encryptedBlob, folderId: formFolderId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems((prev) => prev.map((i) => (i.id === editingId ? { id: editingId, folderId: formFolderId, data: form } : i)));
      } else {
        const res = await fetch(`/api/teams/${teamId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemType: 'login', encryptedBlob, folderId: formFolderId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems((prev) => [{ id: data.item.id, folderId: formFolderId, data: form }, ...prev]);
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

  async function onCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!teamKey || !newFolderName.trim()) return;
    const encryptedName = await encryptJson(teamKey, { name: newFolderName.trim() });
    const res = await fetch(`/api/teams/${teamId}/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encryptedName, parentId: activeFolderId }),
    });
    const data = await res.json();
    if (res.ok) {
      setFolders((prev) => [...prev, { id: data.folder.id, name: newFolderName.trim(), parentId: activeFolderId }]);
      setNewFolderName('');
      setShowFolderForm(false);
    }
  }

  async function onDeleteFolder(id: string) {
    const removed = collectDescendants(id, folders);
    const label = folderMap.get(id)?.name ?? 'esta carpeta';
    const msg =
      removed.size > 1
        ? `¿Borrar "${label}" y sus ${removed.size - 1} subcarpeta(s)? Los items dentro pasarán a la raíz del equipo.`
        : `¿Borrar "${label}"? Los items dentro pasarán a la raíz del equipo.`;
    if (!confirm(msg)) return;

    const parentOfDeleted = folderMap.get(id)?.parentId ?? null;
    const res = await fetch(`/api/teams/${teamId}/folders/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setFolders((prev) => prev.filter((f) => !removed.has(f.id)));
      setItems((prev) => prev.map((i) => (i.folderId && removed.has(i.folderId) ? { ...i, folderId: null } : i)));
      if (activeFolderId && removed.has(activeFolderId)) setActiveFolderId(parentOfDeleted);
    }
    setActionFolderId(null);
  }

  function startRenameFolder(id: string) {
    setRenameDraft(folderMap.get(id)?.name ?? '');
    setRenamingFolderId(id);
    setActionFolderId(null);
  }

  async function onRenameFolder(id: string) {
    if (!teamKey || !renameDraft.trim()) {
      setRenamingFolderId(null);
      return;
    }
    const encryptedName = await encryptJson(teamKey, { name: renameDraft.trim() });
    const res = await fetch(`/api/teams/${teamId}/folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encryptedName }),
    });
    if (res.ok) {
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: renameDraft.trim() } : f)));
    }
    setRenamingFolderId(null);
  }

  async function onMoveFolder(id: string, newParentId: string | null) {
    const res = await fetch(`/api/teams/${teamId}/folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId: newParentId }),
    });
    const data = await res.json();
    if (res.ok) {
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, parentId: newParentId } : f)));
    } else {
      alert(data.error || 'No se pudo mover la carpeta');
    }
    setMovingFolderId(null);
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

  function startEditName() {
    setNameDraft(teamName);
    setEditingName(true);
  }

  async function onSaveName() {
    const name = nameDraft.trim();
    if (!name || name === teamName) {
      setEditingName(false);
      return;
    }
    setNameBusy(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTeamName(data.team.name);
      setEditingName(false);
    } catch {
      // el nombre se queda como estaba si falla; el usuario puede reintentar
    } finally {
      setNameBusy(false);
    }
  }

  async function onDeleteTeam() {
    if (!confirm(`¿Eliminar el equipo "${teamName}"? Se borrará para todos los miembros y no se puede deshacer.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/teams');
    } else {
      setDeleting(false);
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

        {/* breadcrumb */}
        <div className="mb-3 flex items-center gap-1 overflow-x-auto text-[12.5px]">
          <button
            onClick={() => setActiveFolderId(null)}
            className={`flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 font-medium ${
              activeFolderId === null ? 'text-foreground' : 'text-dim'
            }`}
          >
            <Home size={13} /> Vault
          </button>
          {breadcrumb.map((f) => (
            <span key={f.id} className="flex shrink-0 items-center gap-1">
              <ChevronRight size={12} className="text-dim" />
              <button
                onClick={() => setActiveFolderId(f.id)}
                className={`rounded-lg px-1.5 py-1 font-medium ${activeFolderId === f.id ? 'text-foreground' : 'text-dim'}`}
              >
                {f.name}
              </button>
            </span>
          ))}
        </div>

        {/* grid de carpetas */}
        {(childFolders.length > 0 || canWrite) && (
          <div className="mb-4 grid grid-cols-3 gap-2.5">
            {childFolders.map((f) => {
              const brand = matchBrandIcon(f.name);
              const tone = brand?.hex ?? avatarTone(f.id);
              const stats = folderStats(f.id);
              return (
                <div
                  key={f.id}
                  className="group relative flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface/70 px-2 py-3.5 active:scale-95"
                >
                  {canWrite && (
                    <button
                      onClick={() => setActionFolderId(f.id)}
                      aria-label="Opciones de carpeta"
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full text-dim"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  )}
                  <button onClick={() => setActiveFolderId(f.id)} className="flex flex-col items-center gap-1.5">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: `${tone}26`, color: tone }}>
                      {brand ? (
                        <BrandIcon slug={brand.slug} className="block h-5 w-5 [&_svg]:h-full [&_svg]:w-full" />
                      ) : (
                        <FolderOpen size={20} />
                      )}
                    </div>
                    <span className="max-w-full truncate text-[12.5px] font-semibold text-foreground">{f.name}</span>
                    <span className="text-[10.5px] text-dim">
                      {stats.subfolders > 0 ? `${stats.subfolders} carpeta(s) · ` : ''}
                      {stats.directItems} item(s)
                    </span>
                  </button>
                </div>
              );
            })}

            {canWrite && (
              <button
                onClick={() => setShowFolderForm(true)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong px-2 py-3.5 text-dim active:scale-95"
              >
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-dashed border-line-strong">
                  <FolderPlus size={18} />
                </div>
                <span className="text-[12px] font-medium">Nueva carpeta</span>
              </button>
            )}
          </div>
        )}

        {showFolderForm && (
          <form onSubmit={onCreateFolder} className="mb-4 flex items-center gap-2">
            <input
              autoFocus
              placeholder={activeFolderId ? `Carpeta dentro de "${folderMap.get(activeFolderId)?.name}"` : 'Nombre de la carpeta'}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className={`${inputClass} flex-1`}
            />
            <button type="submit" className="rounded-xl bg-purple px-4 py-2.5 text-[13px] font-semibold text-white">
              Crear
            </button>
            <button
              type="button"
              onClick={() => {
                setShowFolderForm(false);
                setNewFolderName('');
              }}
              aria-label="Cancelar"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-dim"
            >
              <X size={16} />
            </button>
          </form>
        )}

        {visibleItems.length === 0 && childFolders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-dim">
            {activeFolderId ? 'Esta carpeta está vacía.' : 'Vault vacío.'}
          </div>
        ) : (
          <ul className="space-y-2">
            {visibleItems.map((item) => {
              const brand = matchBrandIcon(item.data.title);
              const tone = brand?.hex ?? avatarTone(item.data.title || item.id);
              return (
                <li key={item.id} className="rounded-2xl border border-line bg-surface/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[13px] font-bold text-white"
                        style={{ background: brand ? `${tone}26` : tone, color: brand ? tone : undefined }}
                      >
                        {brand ? (
                          <BrandIcon slug={brand.slug} className="block h-4.5 w-4.5 [&_svg]:h-full [&_svg]:w-full" />
                        ) : (
                          (item.data.title || '?').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[14.5px] font-semibold text-foreground">{item.data.title || '(sin título)'}</p>
                        <p className="truncate text-[12px] text-dim">{item.data.username}</p>
                      </div>
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
                  </div>
                  {item.data.totpSecret && <TotpCode secret={item.data.totpSecret} />}
                </li>
              );
            })}
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

      {isOwner && (
        <section className="mb-8">
          <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-dim">Ajustes del equipo</p>
          <div className="space-y-3 rounded-2xl border border-line bg-surface/70 p-4">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onSaveName()}
                  className={`${inputClass} flex-1`}
                />
                <button
                  onClick={onSaveName}
                  disabled={nameBusy}
                  aria-label="Guardar nombre"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple text-white"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  aria-label="Cancelar"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line-strong text-dim"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] text-foreground">{teamName}</span>
                <button
                  onClick={startEditName}
                  className="flex items-center gap-1.5 rounded-xl border border-line-strong px-3 py-2 text-[12.5px] font-semibold text-foreground active:scale-95"
                >
                  <Pencil size={14} /> Renombrar
                </button>
              </div>
            )}

            <button
              onClick={onDeleteTeam}
              disabled={deleting}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/30 py-2.5 text-[13px] font-semibold text-danger active:scale-95"
            >
              <Trash2 size={15} /> {deleting ? 'Eliminando…' : 'Eliminar equipo'}
            </button>
          </div>
        </section>
      )}

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
            <TotpSecretInput value={form.totpSecret ?? ''} onChange={(secret) => setForm((f) => ({ ...f, totpSecret: secret }))} />
            {folders.length > 0 && (
              <select value={formFolderId ?? ''} onChange={(e) => setFormFolderId(e.target.value || null)} className={inputClass}>
                <option value="">Sin carpeta</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
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

      {/* hoja de acciones de carpeta */}
      {actionFolderId && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:px-6"
          onClick={() => setActionFolderId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="safe-bottom w-full max-w-md space-y-1.5 rounded-t-[28px] border border-line bg-surface p-4 sm:rounded-[28px]"
          >
            <div className="mx-auto -mt-1 mb-2 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" />
            <p className="mb-1 px-2 text-[13.5px] font-semibold text-foreground">{folderMap.get(actionFolderId)?.name}</p>
            <button
              onClick={() => startRenameFolder(actionFolderId)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-foreground active:bg-surface-2"
            >
              <Pencil size={16} /> Renombrar
            </button>
            <button
              onClick={() => {
                setMovingFolderId(actionFolderId);
                setActionFolderId(null);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-foreground active:bg-surface-2"
            >
              <FolderInput size={16} /> Mover a…
            </button>
            <button
              onClick={() => onDeleteFolder(actionFolderId)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-danger active:bg-danger/10"
            >
              <Trash2 size={16} /> Eliminar
            </button>
            <button
              onClick={() => setActionFolderId(null)}
              className="mt-1 w-full rounded-xl border border-line-strong py-3 text-[14px] font-semibold text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* renombrar carpeta */}
      {renamingFolderId && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:px-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onRenameFolder(renamingFolderId);
            }}
            className="safe-bottom w-full max-w-md space-y-3 rounded-t-[28px] border border-line bg-surface p-6 sm:rounded-[28px]"
          >
            <div className="mx-auto -mt-1 mb-2 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" />
            <h2 className="text-[17px] font-bold text-foreground">Renombrar carpeta</h2>
            <input autoFocus value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} className={inputClass} />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRenamingFolderId(null)}
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

      {/* mover carpeta */}
      {movingFolderId && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:px-6"
          onClick={() => setMovingFolderId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="safe-bottom max-h-[70vh] w-full max-w-md space-y-1 overflow-y-auto rounded-t-[28px] border border-line bg-surface p-4 sm:rounded-[28px]"
          >
            <div className="mx-auto -mt-1 mb-2 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" />
            <p className="mb-1 px-2 text-[13.5px] font-semibold text-foreground">Mover a…</p>
            <FolderPicker
              folders={folders}
              excludeIds={collectDescendants(movingFolderId, folders)}
              currentParentId={folderMap.get(movingFolderId)?.parentId ?? null}
              onPick={(newParentId) => onMoveFolder(movingFolderId, newParentId)}
            />
            <button
              onClick={() => setMovingFolderId(null)}
              className="mt-1 w-full rounded-xl border border-line-strong py-3 text-[14px] font-semibold text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
