'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, ChevronDown, FileUp, FolderOpen, Info, ShieldCheck, Upload } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { primaryButtonClass } from '@/components/AuthCard';
import { decryptJson, encryptJson, type EncryptedBlob } from '@/lib/crypto';
import { useVaultStore } from '@/lib/store';
import {
  MAX_BYTES,
  SOURCE_LABELS,
  collectFolderPaths,
  markDuplicates,
  normalizeDomain,
  parseImport,
  type DuplicateKind,
  type ImportedItem,
  type ParseResult,
} from '@/lib/import-csv';

interface ExistingItem {
  title: string;
  username: string;
  password: string;
  url: string;
}
interface ExistingFolder {
  id: string;
  name: string;
  parentId: string | null;
}

interface Row {
  item: ImportedItem;
  duplicate: DuplicateKind;
  samePassword: boolean;
}

const HOW_TO: { name: string; steps: string }[] = [
  { name: 'Bitwarden', steps: 'Herramientas → Exportar bóveda → formato .csv.' },
  { name: 'Chrome / Edge / Brave', steps: 'Ajustes → Gestor de contraseñas → Exportar contraseñas.' },
  { name: 'Firefox', steps: 'Contraseñas guardadas → ⋯ → Exportar inicios de sesión.' },
  { name: '1Password', steps: 'Archivo → Exportar → elige la cuenta → formato CSV.' },
  { name: 'LastPass', steps: 'Opciones avanzadas → Exportar → se descarga como CSV.' },
  { name: 'KeePass / KeePassXC', steps: 'Base de datos → Exportar → CSV.' },
];

const CONCURRENCY = 4;

export default function ImportPage() {
  const router = useRouter();
  const { vaultKey, unlocked } = useVaultStore();

  const [existing, setExisting] = useState<ExistingItem[]>([]);
  const [folders, setFolders] = useState<ExistingFolder[]>([]);
  const [ready, setReady] = useState(false);

  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<{ ok: number; failed: number; folders: number } | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (unlocked) return;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => router.replace(data.user ? '/unlock' : '/login'));
  }, [unlocked, router]);

  // Carga lo que ya hay en la bóveda para detectar duplicados y reutilizar carpetas.
  useEffect(() => {
    if (!unlocked || !vaultKey) return;
    (async () => {
      const [itemsRes, foldersRes] = await Promise.all([fetch('/api/vault/items'), fetch('/api/vault/folders')]);
      const items: ExistingItem[] = [];
      if (itemsRes.ok) {
        const { items: raw } = (await itemsRes.json()) as { items: { encrypted_blob: string }[] };
        for (const it of raw) {
          try {
            const d = await decryptJson<ExistingItem>(vaultKey, JSON.parse(it.encrypted_blob) as EncryptedBlob);
            items.push({ title: d.title ?? '', username: d.username ?? '', password: d.password ?? '', url: d.url ?? '' });
          } catch {
            /* no descifrable: se ignora */
          }
        }
      }
      const fs: ExistingFolder[] = [];
      if (foldersRes.ok) {
        const { folders: raw } = (await foldersRes.json()) as {
          folders: { id: string; encrypted_name: string; parent_id: string | null }[];
        };
        for (const f of raw) {
          try {
            const { name } = await decryptJson<{ name: string }>(vaultKey, JSON.parse(f.encrypted_name) as EncryptedBlob);
            fs.push({ id: f.id, name, parentId: f.parent_id });
          } catch {
            /* ignorada */
          }
        }
      }
      setExisting(items);
      setFolders(fs);
      setReady(true);
    })();
  }, [unlocked, vaultKey]);

  const onFile = useCallback(
    async (file: File | undefined) => {
      setError(null);
      setResult(null);
      setParsed(null);
      setRows([]);
      if (!file) return;
      if (file.size > MAX_BYTES) {
        setError('El archivo es demasiado grande (máximo 5 MB).');
        return;
      }
      setFileName(file.name);
      const text = await file.text();
      const r = parseImport(text);
      setParsed(r);
      const marked = markDuplicates(r.items, existing);
      setRows(marked);
      // por defecto solo se marcan los nuevos
      setSelected(new Set(marked.map((m, i) => (m.duplicate === null ? i : -1)).filter((i) => i >= 0)));
    },
    [existing],
  );

  const stats = useMemo(() => {
    const fresh = rows.filter((r) => r.duplicate === null).length;
    const inVault = rows.filter((r) => r.duplicate === 'existing').length;
    const exact = rows.filter((r) => r.duplicate === 'existing' && r.samePassword).length;
    const inFile = rows.filter((r) => r.duplicate === 'file').length;
    return { fresh, inVault, exact, inFile };
  }, [rows]);

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function selectOnlyNew() {
    setSelected(new Set(rows.map((m, i) => (m.duplicate === null ? i : -1)).filter((i) => i >= 0)));
  }
  function selectAll() {
    setSelected(new Set(rows.map((_, i) => i)));
  }

  async function runImport() {
    if (!vaultKey) return;
    const chosen = rows.filter((_, i) => selected.has(i)).map((r) => r.item);
    if (chosen.length === 0) return;
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      // 1) carpetas: se reutilizan las que ya existen con la misma ruta y se crean el resto
      const pathOf = (id: string): string => {
        const f = folders.find((x) => x.id === id);
        if (!f) return '';
        return f.parentId ? `${pathOf(f.parentId)}/${f.name}` : f.name;
      };
      const idByPath = new Map<string, string>();
      folders.forEach((f) => idByPath.set(pathOf(f.id), f.id));

      let created = 0;
      for (const path of collectFolderPaths(chosen)) {
        if (idByPath.has(path)) continue;
        const parts = path.split('/');
        const name = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join('/');
        const encryptedName = await encryptJson(vaultKey, { name });
        const res = await fetch('/api/vault/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedName, parentId: parentPath ? (idByPath.get(parentPath) ?? null) : null }),
        });
        if (!res.ok) throw new Error(`No se pudo crear la carpeta "${path}"`);
        const data = await res.json();
        idByPath.set(path, data.folder.id);
        created++;
      }

      // 2) items: cifrados uno a uno en el navegador, con 4 peticiones en paralelo
      setProgress({ done: 0, total: chosen.length });
      let ok = 0;
      let failed = 0;
      let cursor = 0;
      async function worker() {
        while (cursor < chosen.length) {
          const item = chosen[cursor++];
          try {
            const data = {
              title: item.title,
              username: item.username,
              password: item.password,
              url: item.url,
              notes: item.notes,
              ...(item.totpSecret ? { totpSecret: item.totpSecret } : {}),
            };
            const encryptedBlob = await encryptJson(vaultKey as Uint8Array, data);
            const res = await fetch('/api/vault/items', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                itemType: 'login',
                encryptedBlob,
                folderId: item.folder ? (idByPath.get(item.folder) ?? null) : null,
              }),
            });
            if (res.ok) ok++;
            else failed++;
          } catch {
            failed++;
          }
          setProgress((p) => ({ ...p, done: ok + failed }));
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chosen.length) }, worker));
      setResult({ ok, failed, folders: created });
      setParsed(null);
      setRows([]);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al importar');
    } finally {
      setImporting(false);
    }
  }

  if (!unlocked || !vaultKey) {
    return <div className="flex flex-1 items-center justify-center bg-void text-dim">Cargando…</div>;
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <AppShell title="Importar" subtitle="Desde otro gestor de contraseñas">
      {/* éxito */}
      {result && (
        <div className="nexor-rise mb-5 rounded-3xl border border-success/30 bg-success/10 p-5">
          <p className="flex items-center gap-2 text-[16px] font-black text-success">
            <Check size={18} strokeWidth={3} /> Importación completada
          </p>
          <p className="mt-1.5 text-[14px] text-mist">
            {result.ok} {result.ok === 1 ? 'acceso importado' : 'accesos importados'}
            {result.folders > 0 && ` · ${result.folders} ${result.folders === 1 ? 'carpeta creada' : 'carpetas creadas'}`}
            {result.failed > 0 && ` · ${result.failed} con error`}.
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/vault" className={`${primaryButtonClass} !w-auto flex-1 px-5 text-center`}>
              Ver mi vault
            </Link>
            <Link href="/audit" className="flex-1 rounded-2xl border border-line-strong bg-white py-3.5 text-center text-[15px] font-semibold">
              Revisar seguridad
            </Link>
          </div>
          <p className="mt-3 flex gap-2 text-[12px] leading-relaxed text-dim">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
            El CSV contiene tus contraseñas en texto plano: bórralo de tu equipo (y de la papelera) cuando termines.
          </p>
        </div>
      )}

      {/* elegir archivo */}
      {!parsed && !importing && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              onFile(e.dataTransfer.files?.[0]);
            }}
            disabled={!ready}
            className="group flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-line-strong bg-surface px-6 py-10 text-center transition-all hover:border-purple hover:bg-white disabled:opacity-60"
          >
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-purple/12 text-purple transition-transform group-hover:-translate-y-1">
              <Upload size={26} />
            </span>
            <span className="text-[16px] font-black text-foreground">{ready ? 'Elige tu archivo CSV' : 'Preparando…'}</span>
            <span className="text-[13px] text-dim">o arrástralo aquí · Bitwarden, Chrome, Firefox, 1Password, LastPass, KeePass</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />

          {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}

          <div className="mt-5 flex gap-3 rounded-2xl border border-line bg-surface p-4">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-success" />
            <p className="text-[12.5px] leading-relaxed text-dim">
              <b className="text-foreground">Se procesa solo en tu navegador.</b> El archivo no se sube: cada acceso se cifra en
              tu dispositivo antes de enviarse, igual que cuando lo creas a mano.
            </p>
          </div>

          <p className="mb-2 mt-7 px-1 text-[12px] font-semibold uppercase tracking-wide text-dim">Cómo exportar desde…</p>
          <div className="space-y-2">
            {HOW_TO.map((h) => (
              <div key={h.name} className="rounded-2xl border border-line bg-surface px-4 py-3">
                <p className="text-[13.5px] font-bold">{h.name}</p>
                <p className="text-[12.5px] text-dim">{h.steps}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* vista previa */}
      {parsed && !importing && (
        <div className="nexor-rise">
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-purple/12 text-purple">
              <FileUp size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold">{fileName}</p>
              <p className="text-[12.5px] text-dim">
                Detectado: <b className="text-foreground">{SOURCE_LABELS[parsed.source]}</b> · {parsed.totalRows} filas
              </p>
            </div>
            <button
              onClick={() => {
                setParsed(null);
                setRows([]);
              }}
              className="shrink-0 rounded-xl px-3 py-2 text-[13px] font-semibold text-purple hover:bg-purple/10"
            >
              Cambiar
            </button>
          </div>

          {parsed.warnings.map((w) => (
            <p key={w} className="mb-3 flex gap-2 rounded-xl bg-warning/10 px-3.5 py-2.5 text-[12.5px] text-warning">
              <Info size={15} className="mt-0.5 shrink-0" /> {w}
            </p>
          ))}

          {rows.length > 0 && (
            <>
              <div className="mb-4 grid grid-cols-3 gap-2.5">
                <Stat value={stats.fresh} label="nuevos" tone="success" />
                <Stat value={stats.inVault} label="ya en tu vault" tone="warning" />
                <Stat value={parsed.skipped.length + stats.inFile} label="omitidos" tone="dim" />
              </div>

              {stats.inVault > 0 && (
                <p className="mb-4 text-[12.5px] leading-relaxed text-dim">
                  {stats.exact > 0 && <>{stats.exact} son idénticos a los que ya tienes. </>}
                  Los duplicados (mismo sitio y usuario) vienen desmarcados; márcalos si quieres importarlos igualmente.
                </p>
              )}

              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-dim">
                  {selected.size} de {rows.length} seleccionados
                </p>
                <div className="flex gap-3 text-[12.5px] font-semibold text-purple">
                  <button onClick={selectOnlyNew}>Solo nuevos</button>
                  <button onClick={selectAll}>Todos</button>
                </div>
              </div>

              <ul className="max-h-[46vh] space-y-1.5 overflow-y-auto rounded-2xl border border-line bg-surface p-2">
                {rows.slice(0, 300).map((r, i) => (
                  <li key={i}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white px-3 py-2.5 transition-colors hover:bg-purple/5">
                      <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} className="h-4 w-4 accent-purple" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-bold">{r.item.title}</span>
                        <span className="block truncate text-[11.5px] text-dim">
                          {r.item.username || 'sin usuario'}
                          {r.item.url ? ` · ${normalizeDomain(r.item.url)}` : ''}
                        </span>
                      </span>
                      {r.item.folder && (
                        <span className="hidden shrink-0 items-center gap-1 text-[11px] text-dim sm:flex">
                          <FolderOpen size={12} /> {r.item.folder}
                        </span>
                      )}
                      {r.item.totpSecret && <span className="shrink-0 rounded-full bg-purple/12 px-2 py-0.5 text-[10.5px] font-bold text-purple">2FA</span>}
                      {r.duplicate === 'existing' && (
                        <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[10.5px] font-bold text-warning">
                          {r.samePassword ? 'Idéntico' : 'Ya existe'}
                        </span>
                      )}
                      {r.duplicate === 'file' && (
                        <span className="shrink-0 rounded-full bg-line-strong px-2 py-0.5 text-[10.5px] font-bold text-dim">Repetido</span>
                      )}
                    </label>
                  </li>
                ))}
                {rows.length > 300 && (
                  <li className="px-3 py-2 text-center text-[12px] text-dim">…y {rows.length - 300} más (se importan según la selección)</li>
                )}
              </ul>
            </>
          )}

          {parsed.skipped.length > 0 && (
            <div className="mt-3">
              <button onClick={() => setShowSkipped((v) => !v)} className="flex items-center gap-1.5 px-1 text-[12.5px] font-semibold text-dim">
                {parsed.skipped.length} filas omitidas
                <ChevronDown size={14} className={`transition-transform ${showSkipped ? 'rotate-180' : ''}`} />
              </button>
              {showSkipped && (
                <ul className="nexor-rise mt-2 space-y-1 rounded-xl bg-surface p-3 text-[12px] text-dim">
                  {parsed.skipped.slice(0, 50).map((s) => (
                    <li key={s.line}>
                      Fila {s.line}: {s.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}

          <button onClick={runImport} disabled={selected.size === 0} className={`${primaryButtonClass} mt-5`}>
            Importar {selected.size} {selected.size === 1 ? 'acceso' : 'accesos'}
          </button>
        </div>
      )}

      {/* progreso */}
      {importing && (
        <div className="nexor-rise rounded-3xl border border-line bg-surface p-6 text-center">
          <p className="text-[15px] font-black">Cifrando e importando…</p>
          <p className="mt-1 text-[13px] text-dim">
            {progress.total ? `${progress.done} de ${progress.total}` : 'Preparando carpetas…'} · no cierres esta pestaña
          </p>
          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-purple transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: 'success' | 'warning' | 'dim' }) {
  const color = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-dim';
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5 text-center">
      <p className={`text-[24px] font-black ${color}`}>{value}</p>
      <p className="text-[11px] text-dim">{label}</p>
    </div>
  );
}
