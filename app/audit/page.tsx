'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { decryptJson, EncryptedBlob } from '@/lib/crypto';
import { useVaultStore } from '@/lib/store';
import { checkPwned, scoreStrength, Strength } from '@/lib/audit';
import { buildAlerts, SEVERITY_LABEL, type Severity } from '@/lib/alerts';
import { AppShell } from '@/components/AppShell';

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
  encrypted_blob: string;
  updated_at: string;
}

interface AuditRow {
  id: string;
  title: string;
  password: string;
  strength: Strength;
  reused: boolean;
  reusedWith: string[];
  hasTotp: boolean;
  updatedAt: string;
  pwnedCount: number | null; // null = no comprobado aún
}

export default function AuditPage() {
  const router = useRouter();
  const { vaultKey, unlocked } = useVaultStore();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingPwned, setCheckingPwned] = useState(false);
  const [pwnedError, setPwnedError] = useState<string | null>(null);

  useEffect(() => {
    if (unlocked) return;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => router.replace(data.user ? '/unlock' : '/login'));
  }, [unlocked, router]);

  useEffect(() => {
    if (!unlocked || !vaultKey) return;
    (async () => {
      setLoading(true);
      const res = await fetch('/api/vault/items');
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const { items: raw } = (await res.json()) as { items: RawItem[] };
      const decrypted: { id: string; title: string; password: string; hasTotp: boolean; updatedAt: string }[] = [];
      for (const item of raw) {
        try {
          const blob = JSON.parse(item.encrypted_blob) as EncryptedBlob;
          const data = await decryptJson<VaultItemData>(vaultKey, blob);
          decrypted.push({
            id: item.id,
            title: data.title || '(sin título)',
            password: data.password,
            hasTotp: !!data.totpSecret,
            updatedAt: item.updated_at,
          });
        } catch {
          // omitido: no descifrable con esta vault key
        }
      }
      // grupos de contraseña repetida: cada item sabe con cuáles comparte
      const byPassword = new Map<string, string[]>();
      for (const d of decrypted) {
        if (!d.password) continue;
        byPassword.set(d.password, [...(byPassword.get(d.password) ?? []), d.id]);
      }
      setRows(
        decrypted.map((item) => {
          const group = item.password ? (byPassword.get(item.password) ?? []) : [];
          const reusedWith = group.filter((id) => id !== item.id);
          return {
            id: item.id,
            title: item.title,
            password: item.password,
            strength: scoreStrength(item.password),
            reused: reusedWith.length > 0,
            reusedWith,
            hasTotp: item.hasTotp,
            updatedAt: item.updatedAt,
            pwnedCount: null,
          };
        }),
      );
      setLoading(false);
    })();
  }, [unlocked, vaultKey]);

  const summary = useMemo(() => {
    const total = rows.length;
    const weak = rows.filter((r) => r.strength === 'weak').length;
    const reused = rows.filter((r) => r.reused).length;
    const pwned = rows.filter((r) => (r.pwnedCount ?? 0) > 0).length;
    const penalized = new Set<string>();
    rows.forEach((r) => {
      if (r.strength === 'weak' || r.reused || (r.pwnedCount ?? 0) > 0) penalized.add(r.id);
    });
    const score = total === 0 ? 100 : Math.round(100 * (1 - penalized.size / total));
    return { total, weak, reused, pwned, score };
  }, [rows]);

  // Alertas priorizadas: qué arreglar primero, con el porqué y la acción
  const alerts = useMemo(
    () => buildAlerts(rows, new Map(rows.map((r) => [r.id, r.title]))),
    [rows],
  );
  const pwnedChecked = rows.some((r) => r.pwnedCount !== null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const visibleAlerts = showAllAlerts ? alerts : alerts.slice(0, 5);

  const scoreLabel = summary.score >= 90 ? 'Excelente' : summary.score >= 70 ? 'Bien' : summary.score >= 40 ? 'Mejorable' : 'Riesgo';
  const scoreTone = summary.score >= 90 ? '#059669' : summary.score >= 70 ? '#6c5ce7' : summary.score >= 40 ? '#d97706' : '#e11d48';

  async function runPwnedCheck() {
    setCheckingPwned(true);
    setPwnedError(null);
    try {
      // Secuencial a propósito: HIBP pide no ráfagas de requests paralelos.
      for (const row of rows) {
        if (!row.password) continue;
        const count = await checkPwned(row.password);
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, pwnedCount: count } : r)));
      }
    } catch (err) {
      setPwnedError(err instanceof Error ? err.message : 'Error consultando Have I Been Pwned');
    } finally {
      setCheckingPwned(false);
    }
  }

  if (!unlocked || !vaultKey) {
    return <div className="flex flex-1 items-center justify-center bg-void text-dim">Cargando…</div>;
  }

  const circumference = 2 * Math.PI * 42;
  const dashoffset = circumference * (1 - summary.score / 100);

  return (
    <AppShell title="Auditoría">
      {loading ? (
        <p className="text-[13px] text-dim">Descifrando vault…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong px-4 py-10 text-center text-[13px] text-dim">
          Tu vault está vacío — nada que auditar.
        </div>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-5 rounded-2xl border border-line bg-surface/70 p-5">
            <div className="relative grid h-24 w-24 shrink-0 place-items-center">
              <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
                <circle cx="48" cy="48" r="42" fill="none" stroke="var(--nexor-surface-2)" strokeWidth="8" />
                <circle
                  cx="48"
                  cy="48"
                  r="42"
                  fill="none"
                  stroke={scoreTone}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashoffset}
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <span className="absolute text-[20px] font-black text-foreground">{summary.score}%</span>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[15px] font-bold text-foreground">
                <ShieldCheck size={16} style={{ color: scoreTone }} /> {scoreLabel}
              </p>
              <p className="mt-0.5 text-[12.5px] text-dim">Puntuación de seguridad del vault</p>
            </div>
          </div>

          {/* qué arreglar primero */}
          <section className="mb-6">
            <h2 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-dim">Qué arreglar primero</h2>
            {alerts.length === 0 ? (
              <div className="rounded-2xl border border-success/30 bg-success/10 px-4 py-4 text-[13.5px] text-success">
                Todo en orden: no hay contraseñas débiles, repetidas ni antiguas.
                {!pwnedChecked && ' Comprueba también las filtraciones más abajo.'}
              </div>
            ) : (
              <ul className="space-y-2.5">
                {visibleAlerts.map((a, i) => (
                  <li
                    key={a.id}
                    className="nexor-rise relative overflow-hidden rounded-2xl border border-line bg-surface p-4 pl-5"
                    style={{ ['--i' as string]: i }}
                  >
                    <span aria-hidden className={`absolute inset-y-0 left-0 w-1.5 ${SEVERITY_BAR[a.severity]}`} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-black">{a.title}</p>
                        <p className="mt-0.5 text-[13px] font-semibold text-foreground">{a.headline}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${SEVERITY_BADGE[a.severity]}`}>
                        {SEVERITY_LABEL[a.severity]}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-0.5 text-[12.5px] leading-relaxed text-dim">
                      {a.details.map((d) => (
                        <li key={d}>· {d}</li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-[12.5px] font-semibold text-mist">{a.action}</p>
                      <Link
                        href={`/vault?open=${a.id}`}
                        className="flex shrink-0 items-center gap-1 rounded-xl bg-purple px-3.5 py-2 text-[13px] font-bold text-white transition-transform active:scale-95"
                      >
                        Abrir <ArrowRight size={14} />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {alerts.length > 5 && (
              <button onClick={() => setShowAllAlerts((v) => !v)} className="mt-3 w-full text-center text-[13px] font-semibold text-purple">
                {showAllAlerts ? 'Ver menos' : `Ver las ${alerts.length - 5} restantes`}
              </button>
            )}
            {!pwnedChecked && alerts.length > 0 && (
              <p className="mt-3 px-1 text-[12px] leading-relaxed text-dim">
                Aún no se han comprobado las filtraciones: pulsa «Comprobar filtraciones» para ver el riesgo completo.
              </p>
            )}
          </section>

          <div className="mb-5 grid grid-cols-3 gap-3">
            <StatTile value={summary.weak} label="débiles" />
            <StatTile value={summary.reused} label="reutilizadas" />
            <StatTile value={summary.pwned} label="filtradas" />
          </div>

          <button onClick={runPwnedCheck} disabled={checkingPwned} className="mb-2 w-full rounded-2xl bg-purple py-3.5 text-[14px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(108,92,231,0.7)] transition-transform active:scale-[0.97] disabled:opacity-50">
            {checkingPwned ? 'Consultando Have I Been Pwned…' : 'Comprobar filtraciones (HIBP)'}
          </button>
          <p className="mb-5 text-[11.5px] leading-relaxed text-dim">
            Solo se envían los 5 primeros caracteres del hash SHA-1 de cada contraseña (k-anonimato) — la
            contraseña real nunca sale de tu navegador.
          </p>
          {pwnedError && <p className="mb-4 text-[13px] text-danger">{pwnedError}</p>}

          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between rounded-2xl border border-line bg-surface/70 px-4 py-3">
                <span className="truncate text-[14px] font-medium text-foreground">{row.title}</span>
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  <Badge
                    label={row.strength === 'weak' ? 'Débil' : row.strength === 'fair' ? 'Aceptable' : 'Fuerte'}
                    tone={row.strength === 'weak' ? 'danger' : row.strength === 'fair' ? 'warning' : 'success'}
                  />
                  {row.reused && <Badge label="Reutilizada" tone="warning" />}
                  {row.pwnedCount !== null && row.pwnedCount > 0 && (
                    <Badge label={`Filtrada ${row.pwnedCount.toLocaleString()}x`} tone="danger" />
                  )}
                  {row.pwnedCount === 0 && <Badge label="Sin filtraciones" tone="success" />}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}

const SEVERITY_BAR: Record<Severity, string> = {
  critical: 'bg-danger',
  high: 'bg-warning',
  medium: 'bg-purple',
  low: 'bg-line-strong',
};
const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'bg-danger/15 text-danger',
  high: 'bg-warning/15 text-warning',
  medium: 'bg-purple/15 text-purple',
  low: 'bg-line-strong text-dim',
};

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/70 p-3.5 text-center">
      <p className="text-[22px] font-black text-foreground">{value}</p>
      <p className="text-[11px] text-dim">{label}</p>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: 'danger' | 'warning' | 'success' }) {
  const toneClass =
    tone === 'danger' ? 'bg-danger/15 text-danger' : tone === 'warning' ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClass}`}>{label}</span>;
}
