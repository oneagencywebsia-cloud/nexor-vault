'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Copy,
  Pencil,
  Trash2,
  Search,
  Plus,
  Lock,
  LogOut,
  FolderPlus,
  FolderOpen,
  X,
  ChevronRight,
  Home,
  MoreHorizontal,
  FolderInput,
  Users2,
  AtSign,
  KeyRound,
  Globe,
  StickyNote,
  Clock,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { decryptJson, encryptJson, EncryptedBlob } from '@/lib/crypto';
import { encryptPrivateKey, generateKeyPair, unwrapRawKey } from '@/lib/sharing';
import { useVaultStore } from '@/lib/store';
import { matchBrandIcon } from '@/lib/brand-icon';
import { collectDescendants, topDownOrder, type FolderNode } from '@/lib/folder-tree';
import AutoLock from '@/components/AutoLock';
import PasswordGenerator from '@/components/PasswordGenerator';
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
  folderId: string | null;
  data: VaultItemData;
}

interface RawFolder {
  id: string;
  encrypted_name: string;
  parent_id: string | null;
}

type DecryptedFolder = FolderNode;

const EMPTY_FORM: VaultItemData = { title: '', username: '', password: '', url: '', notes: '', totpSecret: '' };
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
  const [folders, setFolders] = useState<DecryptedFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [actionFolderId, setActionFolderId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);
  const [writeableTeams, setWriteableTeams] = useState<{ id: string; name: string; wrappedTeamKey: string }[]>([]);
  const [movingItemId, setMovingItemId] = useState<string | null>(null);
  const [movingItemFolderId, setMovingItemFolderId] = useState<string | null>(null);
  const [movingItemFolderBusy, setMovingItemFolderBusy] = useState(false);
  const [moveToTeamBusy, setMoveToTeamBusy] = useState(false);
  const [moveToTeamError, setMoveToTeamError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VaultItemData>(EMPTY_FORM);
  const [formFolderId, setFormFolderId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [viewItemId, setViewItemId] = useState<string | null>(null);
  const [viewReveal, setViewReveal] = useState(false);
  const [viewCopiedField, setViewCopiedField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (unlocked) return;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => router.replace(data.user ? '/unlock' : '/login'));
  }, [unlocked, router]);

  async function loadItems(key: Uint8Array, silent = false) {
    if (!silent) setLoading(true);
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
        const data = await decryptJson<VaultItemData>(key, blob);
        decrypted.push({ id: item.id, updatedAt: item.updated_at, folderId: item.folder_id, data });
      } catch {
        // item cifrado con otra key (no debería pasar) — se omite en vez de romper la lista
      }
    }
    setItems(decrypted);
    setLoading(false);
  }

  async function loadFolders(key: Uint8Array) {
    const res = await fetch('/api/vault/folders');
    if (!res.ok) return;
    const { folders: raw } = (await res.json()) as { folders: RawFolder[] };
    const decrypted: DecryptedFolder[] = [];
    for (const folder of raw) {
      try {
        const blob = JSON.parse(folder.encrypted_name) as EncryptedBlob;
        const { name } = await decryptJson<{ name: string }>(key, blob);
        decrypted.push({ id: folder.id, name, parentId: folder.parent_id });
      } catch {
        // carpeta cifrada con otra key — se omite
      }
    }
    setFolders(decrypted);
  }

  useEffect(() => {
    if (!unlocked || !vaultKey) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial estándar, no un loop de sincronización
    loadItems(vaultKey);
    loadFolders(vaultKey);
  }, [unlocked, vaultKey]);

  // "Dinámico de verdad": si añades/editas algo desde el móvil o desde
  // otra pestaña, al volver a esta pestaña se refresca solo — sin recargar
  // la página. Sin spinner (silent) para no interrumpir lo que se esté
  // mirando.
  useEffect(() => {
    if (!unlocked || !vaultKey) return;
    function refresh() {
      if (document.visibilityState !== 'visible') return;
      loadItems(vaultKey!, true);
      loadFolders(vaultKey!);
    }
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [unlocked, vaultKey]);

  // Equipos donde el usuario puede escribir (owner/editor) — para poder
  // mover items del vault personal al vault de un equipo.
  useEffect(() => {
    if (!unlocked || !vaultKey) return;
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/teams');
      if (!res.ok) return;
      const { teams: raw } = (await res.json()) as {
        teams: { role: string; wrapped_team_key: string; team: { id: string; name: string } | { id: string; name: string }[] }[];
      };
      const list = (raw ?? [])
        .filter((r) => r.role === 'owner' || r.role === 'editor')
        .map((r) => {
          const team = Array.isArray(r.team) ? r.team[0] : r.team;
          return { id: team.id, name: team.name, wrappedTeamKey: r.wrapped_team_key };
        });
      if (!cancelled) setWriteableTeams(list);
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

  const searching = query.trim().length > 0;

  // Con búsqueda activa se ignora la carpeta actual y se busca en todo el
  // vault; sin búsqueda, la vista está "encarpetada": solo se ven los items
  // que viven exactamente en la carpeta que se está navegando (null = raíz).
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (q) {
      return items.filter(
        (i) =>
          i.data.title.toLowerCase().includes(q) ||
          i.data.username.toLowerCase().includes(q) ||
          i.data.url.toLowerCase().includes(q),
      );
    }
    return items.filter((i) => i.folderId === activeFolderId);
  }, [items, query, activeFolderId]);

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

  const childFolders = useMemo(
    () => folders.filter((f) => f.parentId === activeFolderId),
    [folders, activeFolderId],
  );

  function folderStats(id: string) {
    const subfolders = folders.filter((f) => f.parentId === id).length;
    const directItems = items.filter((i) => i.folderId === id).length;
    return { subfolders, directItems };
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormFolderId(activeFolderId);
    setError(null);
    setShowForm(true);
  }

  function openEdit(item: DecryptedItem) {
    setEditingId(item.id);
    setForm(item.data);
    setFormFolderId(item.folderId);
    setError(null);
    setShowForm(true);
  }

  async function onCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!vaultKey || !newFolderName.trim()) return;
    const encryptedName = await encryptJson(vaultKey, { name: newFolderName.trim() });
    const res = await fetch('/api/vault/folders', {
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
        ? `¿Borrar "${label}" y sus ${removed.size - 1} subcarpeta(s)? Los items dentro pasarán a la raíz.`
        : `¿Borrar "${label}"? Los items dentro pasarán a la raíz.`;
    if (!confirm(msg)) return;

    const parentOfDeleted = folderMap.get(id)?.parentId ?? null;
    const res = await fetch(`/api/vault/folders/${id}`, { method: 'DELETE' });
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
    if (!vaultKey || !renameDraft.trim()) {
      setRenamingFolderId(null);
      return;
    }
    const encryptedName = await encryptJson(vaultKey, { name: renameDraft.trim() });
    const res = await fetch(`/api/vault/folders/${id}`, {
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
    const res = await fetch(`/api/vault/folders/${id}`, {
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

  // Copia (no mueve) una carpeta ENTERA (y sus subcarpetas) a un equipo,
  // preservando la jerarquía: se recrea cada carpeta como team_folder
  // (nombre cifrado con la team key) y los items quedan dentro de la
  // carpeta correspondiente, no sueltos. El original se queda intacto en
  // el vault personal.
  async function onMoveFolderToTeam(folderId: string, team: { id: string; wrappedTeamKey: string }) {
    if (!vaultKey) return;
    const subtree = collectDescendants(folderId, folders);
    const order = topDownOrder(folderId, subtree, folders);

    setMoveToTeamBusy(true);
    setMoveToTeamError(null);
    try {
      const meRes = await fetch('/api/auth/me');
      const { user } = await meRes.json();
      if (!user?.encryptedPrivateKey) throw new Error('Aún no tienes claves de compartir configuradas');
      const teamKey = await unwrapRawKey(vaultKey, user.encryptedPrivateKey, team.wrappedTeamKey);

      const idMap = new Map<string, string>(); // id de carpeta personal -> id de team_folder creado
      for (const fid of order) {
        const f = folderMap.get(fid)!;
        const encryptedName = await encryptJson(teamKey, { name: f.name });
        const parentId = f.parentId ? (idMap.get(f.parentId) ?? null) : null;
        const res = await fetch(`/api/teams/${team.id}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedName, parentId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `No se pudo crear la carpeta "${f.name}" en el equipo`);
        idMap.set(fid, data.folder.id);
      }

      const itemsToCopy = items.filter((i) => i.folderId && subtree.has(i.folderId));
      for (const item of itemsToCopy) {
        const encryptedBlob = await encryptJson(teamKey, item.data);
        const res = await fetch(`/api/teams/${team.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemType: 'login', encryptedBlob, folderId: idMap.get(item.folderId!) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `No se pudo copiar "${item.data.title || 'un item'}"`);
      }

      setMovingFolderId(null);
    } catch (err) {
      setMoveToTeamError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setMoveToTeamBusy(false);
    }
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
          body: JSON.stringify({ encryptedBlob, folderId: formFolderId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems((prev) =>
          prev.map((i) =>
            i.id === editingId
              ? { id: editingId, updatedAt: data.item.updated_at, folderId: formFolderId, data: form }
              : i,
          ),
        );
      } else {
        const res = await fetch('/api/vault/items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemType: 'login', encryptedBlob, folderId: formFolderId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems((prev) => [
          { id: data.item.id, updatedAt: data.item.updated_at, folderId: formFolderId, data: form },
          ...prev,
        ]);
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

  // Mueve un item suelto a una carpeta (o a la raíz): se re-cifra con la
  // misma vault key, solo cambia folder_id.
  async function onMoveItemFolder(id: string, newFolderId: string | null) {
    if (!vaultKey) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setMovingItemFolderBusy(true);
    try {
      const encryptedBlob = await encryptJson(vaultKey, item.data);
      const res = await fetch(`/api/vault/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedBlob, folderId: newFolderId }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, folderId: newFolderId } : i)));
      }
    } finally {
      setMovingItemFolderBusy(false);
      setMovingItemFolderId(null);
    }
  }

  // Mueve un item del vault personal al vault de un equipo: se re-cifra
  // localmente con la team key (desenvuelta con la clave privada propia)
  // y solo entonces se crea allí y se borra del vault personal — el
  // server nunca ve el item en claro en ningún punto del proceso.
  // Copia (no mueve) un item del vault personal al vault de un equipo: se
  // re-cifra localmente con la team key y se crea allí; el original se
  // queda intacto en el vault personal.
  async function onMoveToTeam(itemId: string, team: { id: string; wrappedTeamKey: string }) {
    if (!vaultKey) return;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    setMoveToTeamBusy(true);
    setMoveToTeamError(null);
    try {
      const meRes = await fetch('/api/auth/me');
      const { user } = await meRes.json();
      if (!user?.encryptedPrivateKey) throw new Error('Aún no tienes claves de compartir configuradas');

      const teamKey = await unwrapRawKey(vaultKey, user.encryptedPrivateKey, team.wrappedTeamKey);
      const encryptedBlob = await encryptJson(teamKey, item.data);

      const createRes = await fetch(`/api/teams/${team.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType: 'login', encryptedBlob }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'No se pudo copiar al equipo');

      setMovingItemId(null);
    } catch (err) {
      setMoveToTeamError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setMoveToTeamBusy(false);
    }
  }

  async function onLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    lock();
    router.push('/login');
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  function copyWithFeedback(text: string, field: string) {
    copy(text);
    setViewCopiedField(field);
    setTimeout(() => setViewCopiedField((f) => (f === field ? null : f)), 1200);
  }

  function formatUpdated(iso: string) {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const viewItem = viewItemId ? items.find((i) => i.id === viewItemId) : undefined;

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

      {!searching && (
        <>
          {/* breadcrumb: Vault > carpeta > subcarpeta… */}
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
                  className={`rounded-lg px-1.5 py-1 font-medium ${
                    activeFolderId === f.id ? 'text-foreground' : 'text-dim'
                  }`}
                >
                  {f.name}
                </button>
              </span>
            ))}
          </div>

          {/* grid de carpetas: tarjetas de color, tocar para entrar */}
          {(childFolders.length > 0 || true) && (
            <div className="mb-5 grid grid-cols-3 gap-2.5">
              {childFolders.map((f) => {
                const brand = matchBrandIcon(f.name);
                const tone = brand?.hex ?? avatarTone(f.id);
                const stats = folderStats(f.id);
                return (
                  <div
                    key={f.id}
                    className="group relative flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface/70 px-2 py-3.5 active:scale-95"
                  >
                    <button
                      onClick={() => setActionFolderId(f.id)}
                      aria-label="Opciones de carpeta"
                      className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full text-dim"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    <button onClick={() => setActiveFolderId(f.id)} className="flex flex-col items-center gap-1.5">
                      <div
                        className="grid h-11 w-11 place-items-center rounded-2xl"
                        style={{ background: `${tone}26`, color: tone }}
                      >
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

              <button
                onClick={() => setShowFolderForm(true)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong px-2 py-3.5 text-dim active:scale-95"
              >
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-dashed border-line-strong">
                  <FolderPlus size={18} />
                </div>
                <span className="text-[12px] font-medium">Nueva carpeta</span>
              </button>
            </div>
          )}

          {showFolderForm && (
            <form onSubmit={onCreateFolder} className="mb-5 flex items-center gap-2">
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
        </>
      )}

      {loading && <p className="text-[13px] text-dim">Descifrando vault…</p>}
      {!loading && filtered.length === 0 && childFolders.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center">
          <p className="text-[13px] text-dim">
            {searching
              ? 'Sin resultados.'
              : activeFolderId
                ? 'Esta carpeta está vacía.'
                : 'Tu vault está vacío. Crea tu primer item o carpeta.'}
          </p>
        </div>
      )}

      <ul className="space-y-2.5">
        {filtered.map((item) => {
          const brand = matchBrandIcon(item.data.title);
          const tone = brand?.hex ?? avatarTone(item.data.title || item.id);
          return (
            <li
              key={item.id}
              onClick={() => {
                setViewReveal(false);
                setViewItemId(item.id);
              }}
              className="cursor-pointer rounded-2xl border border-line bg-surface/70 p-4 transition-transform active:scale-[0.985]"
            >
              <div className="flex items-center gap-3">
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[15px] font-bold text-white"
                  style={{ background: brand ? `${tone}26` : tone, color: brand ? tone : undefined }}
                >
                  {brand ? (
                    <BrandIcon slug={brand.slug} className="block h-5 w-5 [&_svg]:h-full [&_svg]:w-full" />
                  ) : (
                    (item.data.title || '?').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-foreground">{item.data.title || '(sin título)'}</p>
                  <p className="truncate text-[12.5px] text-dim">{item.data.username || item.data.url || '—'}</p>
                </div>
              </div>

              {item.data.notes && (
                <p className="mt-2 line-clamp-2 flex items-start gap-1.5 text-[12px] leading-snug text-dim/80">
                  <StickyNote size={12} className="mt-0.5 shrink-0 text-dim/60" />
                  <span className="italic">{item.data.notes}</span>
                </p>
              )}

              <div
                onClick={(e) => e.stopPropagation()}
                className="mt-3 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2"
              >
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
                  <IconBtn onClick={() => setMovingItemFolderId(item.id)} label="Mover a carpeta">
                    <FolderInput size={15} />
                  </IconBtn>
                  {writeableTeams.length > 0 && (
                    <IconBtn onClick={() => setMovingItemId(item.id)} label="Copiar a equipo">
                      <Users2 size={15} />
                    </IconBtn>
                  )}
                  <IconBtn onClick={() => onDelete(item.id)} label="Borrar" danger>
                    <Trash2 size={15} />
                  </IconBtn>
                </div>
              </div>

              {item.data.totpSecret && (
                <div onClick={(e) => e.stopPropagation()}>
                  <TotpCode secret={item.data.totpSecret} />
                </div>
              )}
            </li>
          );
        })}
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
            className="safe-bottom max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-line bg-surface sm:rounded-[28px]"
          >
            <div className="mx-auto -mt-1 mb-1 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" />

            {/* cabecera con avatar en vivo: cambia con el título mientras escribes */}
            {(() => {
              const brand = matchBrandIcon(form.title);
              const tone = brand?.hex ?? avatarTone(form.title || 'x');
              return (
                <div
                  className="flex flex-col items-center gap-2 px-6 pb-5 pt-4 text-center"
                  style={{ background: `linear-gradient(180deg, ${tone}26, transparent)` }}
                >
                  <div
                    className="grid h-14 w-14 place-items-center rounded-2xl text-[22px] font-bold text-white shadow-lg transition-colors"
                    style={{ background: brand ? `${tone}26` : tone, color: brand ? tone : undefined }}
                  >
                    {brand ? (
                      <BrandIcon slug={brand.slug} className="block h-7 w-7 [&_svg]:h-full [&_svg]:w-full" />
                    ) : (
                      (form.title || '?').charAt(0).toUpperCase()
                    )}
                  </div>
                  <h2 className="text-[16px] font-bold text-foreground">{editingId ? 'Editar item' : 'Nuevo item'}</h2>
                </div>
              );
            })()}

            <div className="space-y-2 px-5 pb-6">
              <FormField icon={<KeyRound size={15} />} label="Título">
                <input
                  placeholder="ej. Instagram, Gmail…"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  autoFocus
                  className="w-full bg-transparent text-[14px] text-foreground outline-none placeholder:text-dim/50"
                />
              </FormField>

              <FormField icon={<AtSign size={15} />} label="Usuario / email">
                <input
                  placeholder="tu@email.com"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full bg-transparent text-[14px] text-foreground outline-none placeholder:text-dim/50"
                />
              </FormField>

              <FormField icon={<ShieldCheck size={15} />} label="Contraseña">
                <input
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-transparent font-mono text-[14px] text-foreground outline-none placeholder:text-dim/50"
                />
              </FormField>

              <PasswordGenerator onUse={(pwd) => setForm((f) => ({ ...f, password: pwd }))} />

              <TotpSecretInput value={form.totpSecret ?? ''} onChange={(secret) => setForm((f) => ({ ...f, totpSecret: secret }))} />

              {folders.length > 0 && (
                <FormField icon={<FolderOpen size={15} />} label="Carpeta">
                  <select
                    value={formFolderId ?? ''}
                    onChange={(e) => setFormFolderId(e.target.value || null)}
                    className="w-full bg-transparent text-[14px] text-foreground outline-none [&>option]:bg-surface"
                  >
                    <option value="">Sin carpeta</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}

              <FormField icon={<Globe size={15} />} label="URL">
                <input
                  placeholder="https://…"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="w-full bg-transparent text-[14px] text-foreground outline-none placeholder:text-dim/50"
                />
              </FormField>

              <FormField icon={<StickyNote size={15} />} label="Notas">
                <textarea
                  placeholder="Notas opcionales…"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full resize-none bg-transparent text-[14px] text-foreground outline-none placeholder:text-dim/50"
                />
              </FormField>

              {error && <p className="text-[13px] text-danger">{error}</p>}

              <div className="flex gap-2 pt-2">
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
            </div>
          </form>
        </div>
      )}

      {/* hoja de acciones: renombrar / mover / eliminar carpeta */}
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
            <p className="mb-1 px-2 text-[13.5px] font-semibold text-foreground">
              {folderMap.get(actionFolderId)?.name}
            </p>
            <button
              onClick={() => startRenameFolder(actionFolderId)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-medium text-foreground active:bg-surface-2"
            >
              <Pencil size={16} /> Renombrar
            </button>
            <button
              onClick={() => {
                setMoveToTeamError(null);
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

      {/* mover carpeta: a otra carpeta/raíz, o a un equipo entero */}
      {movingFolderId && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:px-6"
          onClick={() => !moveToTeamBusy && setMovingFolderId(null)}
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

            {writeableTeams.length > 0 && (
              <>
                <p className="mb-1 mt-3 px-2 text-[11.5px] font-semibold uppercase tracking-wide text-dim">
                  O copiar a un equipo
                </p>
                <p className="mb-1 px-2 text-[11.5px] text-dim">
                  Se copian todos los items de esta carpeta (y subcarpetas); en tu vault personal no cambia nada.
                </p>
                {writeableTeams.map((team) => (
                  <button
                    key={team.id}
                    disabled={moveToTeamBusy}
                    onClick={() => onMoveFolderToTeam(movingFolderId, team)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] font-medium text-foreground active:bg-surface-2 disabled:opacity-50"
                  >
                    <Users2 size={16} /> {team.name}
                  </button>
                ))}
              </>
            )}

            {moveToTeamError && <p className="px-2 text-[13px] text-danger">{moveToTeamError}</p>}

            <button
              onClick={() => setMovingFolderId(null)}
              disabled={moveToTeamBusy}
              className="mt-1 w-full rounded-xl border border-line-strong py-3 text-[14px] font-semibold text-foreground disabled:opacity-50"
            >
              {moveToTeamBusy ? 'Copiando…' : 'Cancelar'}
            </button>
          </div>
        </div>
      )}

      {/* mover item del vault personal al vault de un equipo */}
      {movingItemId && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:px-6"
          onClick={() => !moveToTeamBusy && setMovingItemId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="safe-bottom max-h-[70vh] w-full max-w-md space-y-1 overflow-y-auto rounded-t-[28px] border border-line bg-surface p-4 sm:rounded-[28px]"
          >
            <div className="mx-auto -mt-1 mb-2 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" />
            <p className="mb-1 px-2 text-[13.5px] font-semibold text-foreground">Copiar a equipo…</p>
            <p className="mb-2 px-2 text-[12px] text-dim">
              Se cifrará con la clave del equipo y se añadirá ahí; se queda igual en tu vault personal.
            </p>
            {writeableTeams.map((team) => (
              <button
                key={team.id}
                disabled={moveToTeamBusy}
                onClick={() => onMoveToTeam(movingItemId, team)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] font-medium text-foreground active:bg-surface-2 disabled:opacity-50"
              >
                <Users2 size={16} /> {team.name}
              </button>
            ))}
            {moveToTeamError && <p className="px-2 text-[13px] text-danger">{moveToTeamError}</p>}
            <button
              onClick={() => setMovingItemId(null)}
              disabled={moveToTeamBusy}
              className="mt-1 w-full rounded-xl border border-line-strong py-3 text-[14px] font-semibold text-foreground disabled:opacity-50"
            >
              {moveToTeamBusy ? 'Copiando…' : 'Cancelar'}
            </button>
          </div>
        </div>
      )}

      {/* mover item suelto a una carpeta del vault personal */}
      {movingItemFolderId && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:px-6"
          onClick={() => !movingItemFolderBusy && setMovingItemFolderId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="safe-bottom max-h-[70vh] w-full max-w-md space-y-1 overflow-y-auto rounded-t-[28px] border border-line bg-surface p-4 sm:rounded-[28px]"
          >
            <div className="mx-auto -mt-1 mb-2 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" />
            <p className="mb-1 px-2 text-[13.5px] font-semibold text-foreground">Mover a carpeta…</p>
            <FolderPicker
              folders={folders}
              excludeIds={new Set()}
              currentParentId={items.find((i) => i.id === movingItemFolderId)?.folderId ?? null}
              onPick={(newFolderId) => onMoveItemFolder(movingItemFolderId, newFolderId)}
            />
            <button
              onClick={() => setMovingItemFolderId(null)}
              disabled={movingItemFolderBusy}
              className="mt-1 w-full rounded-xl border border-line-strong py-3 text-[14px] font-semibold text-foreground disabled:opacity-50"
            >
              {movingItemFolderBusy ? 'Moviendo…' : 'Cancelar'}
            </button>
          </div>
        </div>
      )}

      {/* ficha de detalle del item: se abre al tocar la tarjeta */}
      {viewItem && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center sm:px-6"
          onClick={() => setViewItemId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="safe-bottom max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[28px] border border-line bg-surface sm:rounded-[28px]"
          >
            <div className="mx-auto -mt-1 mb-1 h-1.5 w-10 rounded-full bg-line-strong sm:hidden" />

            {/* cabecera con degradado del color de marca/avatar */}
            <div
              className="relative flex flex-col items-center gap-2 px-6 pb-6 pt-5 text-center"
              style={{
                background: `linear-gradient(180deg, ${
                  matchBrandIcon(viewItem.data.title)?.hex ?? avatarTone(viewItem.data.title || viewItem.id)
                }26, transparent)`,
              }}
            >
              <button
                onClick={() => setViewItemId(null)}
                aria-label="Cerrar"
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-dim active:scale-90"
              >
                <X size={15} />
              </button>
              {(() => {
                const brand = matchBrandIcon(viewItem.data.title);
                const tone = brand?.hex ?? avatarTone(viewItem.data.title || viewItem.id);
                return (
                  <div
                    className="grid h-16 w-16 place-items-center rounded-2xl text-[24px] font-bold text-white shadow-lg"
                    style={{ background: brand ? `${tone}26` : tone, color: brand ? tone : undefined }}
                  >
                    {brand ? (
                      <BrandIcon slug={brand.slug} className="block h-8 w-8 [&_svg]:h-full [&_svg]:w-full" />
                    ) : (
                      (viewItem.data.title || '?').charAt(0).toUpperCase()
                    )}
                  </div>
                );
              })()}
              <h2 className="text-[18px] font-bold text-foreground">{viewItem.data.title || '(sin título)'}</h2>
              <p className="text-[12.5px] text-dim">
                {viewItem.folderId ? folderMap.get(viewItem.folderId)?.name ?? 'Carpeta' : 'Vault'} · actualizado{' '}
                {formatUpdated(viewItem.updatedAt)}
              </p>
            </div>

            <div className="space-y-2 px-5 pb-5">
              {viewItem.data.totpSecret && (
                <div className="mb-1">
                  <TotpCode secret={viewItem.data.totpSecret} />
                </div>
              )}

              {viewItem.data.username && (
                <DetailField
                  icon={<AtSign size={15} />}
                  label="Usuario"
                  value={viewItem.data.username}
                  copied={viewCopiedField === 'username'}
                  onCopy={() => copyWithFeedback(viewItem.data.username, 'username')}
                />
              )}

              {viewItem.data.password && (
                <DetailField
                  icon={<KeyRound size={15} />}
                  label="Contraseña"
                  value={viewReveal ? viewItem.data.password : '••••••••••••'}
                  mono
                  copied={viewCopiedField === 'password'}
                  onCopy={() => copyWithFeedback(viewItem.data.password, 'password')}
                  extra={
                    <IconBtn onClick={() => setViewReveal((v) => !v)} label={viewReveal ? 'Ocultar' : 'Ver'}>
                      {viewReveal ? <EyeOff size={15} /> : <Eye size={15} />}
                    </IconBtn>
                  }
                />
              )}

              {viewItem.data.url && (
                <DetailField
                  icon={<Globe size={15} />}
                  label="URL"
                  value={viewItem.data.url}
                  copied={viewCopiedField === 'url'}
                  onCopy={() => copyWithFeedback(viewItem.data.url, 'url')}
                  extra={
                    <a
                      href={viewItem.data.url.startsWith('http') ? viewItem.data.url : `https://${viewItem.data.url}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Abrir enlace"
                      className="grid h-8 w-8 place-items-center rounded-lg text-dim active:scale-90"
                    >
                      <ChevronRight size={15} />
                    </a>
                  }
                />
              )}

              {viewItem.data.notes && (
                <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-dim">
                    <StickyNote size={13} /> Notas
                  </div>
                  <p className="whitespace-pre-wrap text-[13.5px] text-foreground">{viewItem.data.notes}</p>
                </div>
              )}

              <div className="flex items-center gap-1.5 px-1 pt-1 text-[11.5px] text-dim">
                <Clock size={12} /> Actualizado el {formatUpdated(viewItem.updatedAt)}
                {viewItem.data.totpSecret && (
                  <span className="ml-auto flex items-center gap-1 text-purple">
                    <ShieldCheck size={12} /> 2FA activo
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => {
                    setViewItemId(null);
                    openEdit(viewItem);
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-line-strong py-3 text-[13.5px] font-semibold text-foreground active:scale-[0.98]"
                >
                  <Pencil size={14} /> Editar
                </button>
                <button
                  onClick={() => {
                    setViewItemId(null);
                    setMovingItemFolderId(viewItem.id);
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-line-strong py-3 text-[13.5px] font-semibold text-foreground active:scale-[0.98]"
                >
                  <FolderInput size={14} /> Mover
                </button>
                {writeableTeams.length > 0 && (
                  <button
                    onClick={() => {
                      setViewItemId(null);
                      setMoveToTeamError(null);
                      setMovingItemId(viewItem.id);
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-2xl border border-line-strong py-3 text-[13.5px] font-semibold text-foreground active:scale-[0.98]"
                  >
                    <Users2 size={14} /> A equipo
                  </button>
                )}
                <button
                  onClick={() => {
                    setViewItemId(null);
                    onDelete(viewItem.id);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-2xl border border-line-strong py-3 text-[13.5px] font-semibold text-danger active:scale-[0.98] ${
                    writeableTeams.length > 0 ? '' : 'col-span-1'
                  }`}
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              </div>
            </div>
          </div>
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

function FormField({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-surface-2 px-3 py-2 transition-colors focus-within:bg-line">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-dim">{icon}</div>
      <div className="min-w-0 flex-1">
        <label className="block text-[10.5px] font-semibold uppercase tracking-wide text-dim">{label}</label>
        {children}
      </div>
    </div>
  );
}

function DetailField({
  icon,
  label,
  value,
  onCopy,
  copied,
  mono,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  mono?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-dim">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-dim">{label}</p>
        <p className={`truncate text-[14px] text-foreground ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
      {extra}
      <IconBtn onClick={onCopy} label={`Copiar ${label}`}>
        {copied ? <Check size={15} className="text-purple" /> : <Copy size={15} />}
      </IconBtn>
    </div>
  );
}
