'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Eye, EyeOff, ExternalLink, Search } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { TotpCode } from '@/components/TotpCode';
import { decryptJson, type EncryptedBlob } from '@/lib/crypto';
import { hostOf, matchKind, type MatchKind } from '@/lib/domain-match';
import { useVaultStore } from '@/lib/store';

// Acceso rápido para móvil. Cuando el usuario comparte una web a Nexor (menú
// "Compartir" de Android con la PWA instalada), llega aquí con la URL y ve al
// instante las credenciales de ese sitio con "copiar" a un toque. Es lo más
// cercano al autorrelleno que permite una PWA: el autorrelleno a nivel de
// sistema en Android/iOS exige una app nativa.

interface Item {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  totpSecret?: string;
  match: MatchKind | null;
}

const CLEAR_CLIPBOARD_MS = 30_000;

const subscribeNever = () => () => {};

/** Saca la primera URL http(s) de lo que comparte el navegador (url o texto). */
function extractSharedUrl(params: URLSearchParams): string {
  for (const key of ['url', 'text', 'title']) {
    const m = (params.get(key) ?? '').match(/https?:\/\/[^\s]+/i);
    if (m) return m[0];
  }
  return '';
}

export default function OpenPage() {
  const router = useRouter();
  const { vaultKey, unlocked } = useVaultStore();
  // Lo compartido llega en la query. Se lee con useSyncExternalStore: en servidor
  // es null (aún no se sabe) y en el cliente es la URL real, sin setState en efectos.
  const search = useSyncExternalStore(subscribeNever, () => window.location.search, () => null);
  const sharedUrl = useMemo(() => (search === null ? null : extractSharedUrl(new URLSearchParams(search))), [search]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // 1) lee lo compartido; si no hay sesión desbloqueada, va a desbloquear y vuelve
  useEffect(() => {
    if (unlocked) return;
    const back = encodeURIComponent('/open' + window.location.search);
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => router.replace(`${data.user ? '/unlock' : '/login'}?next=${back}`));
  }, [unlocked, router]);

  // 2) descifra los accesos y calcula la coincidencia con la web compartida
  useEffect(() => {
    if (!unlocked || !vaultKey || sharedUrl === null) return;
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/vault/items');
      if (!res.ok) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { items: raw } = (await res.json()) as { items: { id: string; encrypted_blob: string }[] };
      const out: Item[] = [];
      for (const r of raw) {
        try {
          const d = await decryptJson<Partial<Item>>(vaultKey, JSON.parse(r.encrypted_blob) as EncryptedBlob);
          out.push({
            id: r.id,
            title: d.title || '(sin título)',
            username: d.username ?? '',
            password: d.password ?? '',
            url: d.url ?? '',
            totpSecret: d.totpSecret || undefined,
            match: sharedUrl ? matchKind(d.url ?? '', sharedUrl) : null,
          });
        } catch {
          /* no descifrable: se omite */
        }
      }
      if (!cancelled) {
        setItems(out);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unlocked, vaultKey, sharedUrl]);

  const host = sharedUrl ? hostOf(sharedUrl) : '';
  const matches = useMemo(() => items.filter((i) => i.match).sort((a, b) => (a.match === 'exact' ? -1 : 1) - (b.match === 'exact' ? -1 : 1)), [items]);
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter((i) => `${i.title} ${i.username} ${i.url}`.toLowerCase().includes(q)).slice(0, 20);
  }, [items, query]);

  if (!unlocked || !vaultKey) {
    return <div className="flex flex-1 items-center justify-center bg-void text-dim">Cargando…</div>;
  }

  return (
    <AppShell title="Acceso rápido" subtitle={host || 'Busca un acceso'}>
      {loading ? (
        <p className="text-[13px] text-dim">Descifrando vault…</p>
      ) : (
        <>
          {host && (
            <p className="mb-3 px-1 text-[12px] font-semibold uppercase tracking-wide text-dim">
              {matches.length > 0 ? `Para ${host}` : `Sin accesos para ${host}`}
            </p>
          )}

          {matches.map((item) => (
            <QuickCard key={item.id} item={item} />
          ))}

          {host && matches.length === 0 && (
            <div className="mb-5 rounded-3xl border border-dashed border-line-strong px-5 py-8 text-center">
              <p className="text-[14px] font-bold">No tienes ningún acceso guardado para esta web.</p>
              <p className="mx-auto mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-dim">
                Búscalo abajo por si lo guardaste con otro nombre, o créalo desde tu vault.
              </p>
            </div>
          )}

          {/* buscador de respaldo */}
          <div className="relative mt-4">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar otro acceso…"
              className="w-full rounded-2xl border border-line-strong bg-white py-3 pl-10 pr-4 text-[14px] outline-none transition-all focus:border-purple focus:ring-4 focus:ring-purple/15"
            />
          </div>
          <div className="mt-3 space-y-3">
            {searchResults.map((item) => (
              <QuickCard key={item.id} item={item} />
            ))}
          </div>
          {query.trim() && searchResults.length === 0 && <p className="mt-3 text-center text-[13px] text-dim">Sin resultados.</p>}
        </>
      )}
    </AppShell>
  );
}

function QuickCard({ item }: { item: Item }) {
  const [copied, setCopied] = useState<'user' | 'pass' | null>(null);
  const [reveal, setReveal] = useState(false);

  const copy = useCallback(async (text: string, which: 'user' | 'pass') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      window.setTimeout(() => setCopied((c) => (c === which ? null : c)), 1600);
      // Una contraseña no debe quedarse en el portapapeles: se borra a los 30 s.
      if (which === 'pass') {
        window.setTimeout(() => {
          navigator.clipboard.writeText('').catch(() => {});
        }, CLEAR_CLIPBOARD_MS);
      }
    } catch {
      /* portapapeles no disponible */
    }
  }, []);

  const site = item.url ? (/^[a-z][a-z0-9+.-]*:\/\//i.test(item.url) ? item.url : `https://${item.url}`) : '';

  return (
    <article className="nexor-rise mb-3 rounded-3xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-purple text-[17px] font-black text-white">
          {(item.title.trim()[0] ?? '?').toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-black">{item.title}</p>
          <p className="truncate text-[12.5px] text-dim">{item.username || item.url}</p>
        </div>
        {item.match === 'related' && (
          <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[10.5px] font-bold text-warning">Dominio relacionado</span>
        )}
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        <button
          onClick={() => copy(item.username, 'user')}
          disabled={!item.username}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-line-strong bg-white text-[14px] font-bold transition-transform active:scale-95 disabled:opacity-40"
        >
          {copied === 'user' ? <Check size={16} className="text-success" /> : <Copy size={16} />}
          {copied === 'user' ? 'Copiado' : 'Usuario'}
        </button>
        <button
          onClick={() => copy(item.password, 'pass')}
          disabled={!item.password}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-purple text-[14px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(108,92,231,0.8)] transition-transform active:scale-95 disabled:opacity-40"
        >
          {copied === 'pass' ? <Check size={16} /> : <Copy size={16} />}
          {copied === 'pass' ? 'Copiada' : 'Contraseña'}
        </button>
      </div>

      {item.totpSecret && <TotpCode secret={item.totpSecret} />}

      <div className="mt-3 flex items-center justify-between gap-3 text-[12.5px] font-semibold">
        <button onClick={() => setReveal((r) => !r)} className="flex items-center gap-1.5 text-dim">
          {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
          {reveal ? 'Ocultar' : 'Mostrar contraseña'}
        </button>
        {site && (
          <a href={site} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-purple">
            Abrir sitio <ExternalLink size={13} />
          </a>
        )}
      </div>
      {reveal && <p className="nexor-rise mt-2 break-all rounded-xl bg-surface-2 px-3 py-2 font-mono text-[13px]">{item.password || '—'}</p>}
      <p className="mt-2 text-[11px] text-dim">La contraseña se borra del portapapeles a los 30 segundos.</p>
    </article>
  );
}
