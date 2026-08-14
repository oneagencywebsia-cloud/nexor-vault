'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, X, ChevronRight, Users2, Plus } from 'lucide-react';
import { wrapRawKey } from '@/lib/sharing';
import { useVaultStore } from '@/lib/store';
import { AppShell } from '@/components/AppShell';
import { inputClass, primaryButtonClass } from '@/components/AuthCard';

interface TeamRow {
  role: string;
  wrapped_team_key: string;
  team: { id: string; name: string; owner_id: string } | { id: string; name: string; owner_id: string }[];
}

interface InviteRow {
  id: string;
  role: string;
  team: { id: string; name: string } | { id: string; name: string }[];
}

function one<T>(v: T | T[]): T {
  return Array.isArray(v) ? v[0] : v;
}

export default function TeamsPage() {
  const router = useRouter();
  const { vaultKey, unlocked } = useVaultStore();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [myPublicKey, setMyPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (unlocked) return;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => router.replace(data.user ? '/unlock' : '/login'));
  }, [unlocked, router]);

  async function reload() {
    const [meRes, teamsRes, invitesRes] = await Promise.all([
      fetch('/api/auth/me'),
      fetch('/api/teams'),
      fetch('/api/teams/invites'),
    ]);
    const { user } = await meRes.json();
    setMyPublicKey(user?.publicKey ?? null);
    const { teams: t } = await teamsRes.json();
    setTeams(t ?? []);
    const { invites: i } = await invitesRes.json();
    setInvites(i ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (!unlocked || !vaultKey) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, vaultKey]);

  async function onCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!vaultKey || !myPublicKey) return;
    setError(null);
    setCreating(true);
    try {
      const teamKeyRaw = crypto.getRandomValues(new Uint8Array(32));
      const wrappedTeamKey = await wrapRawKey(myPublicKey, teamKeyRaw);
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTeamName, wrappedTeamKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo crear el equipo');
      setNewTeamName('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setCreating(false);
    }
  }

  async function onAcceptInvite(inviteId: string) {
    await fetch(`/api/teams/invites/${inviteId}`, { method: 'POST' });
    await reload();
  }

  async function onDeclineInvite(inviteId: string) {
    await fetch(`/api/teams/invites/${inviteId}`, { method: 'DELETE' });
    await reload();
  }

  if (!unlocked || !vaultKey) {
    return <div className="flex flex-1 items-center justify-center bg-void text-dim">Cargando…</div>;
  }

  return (
    <AppShell title="Equipos">
      {invites.length > 0 && (
        <section className="mb-8">
          <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-dim">Invitaciones pendientes</p>
          <ul className="space-y-2">
            {invites.map((invite) => {
              const team = one(invite.team);
              return (
                <li key={invite.id} className="rounded-2xl border border-line bg-surface/70 p-4">
                  <p className="mb-3 text-[13.5px] text-foreground">
                    <strong>{team.name}</strong> — rol {invite.role}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onAcceptInvite(invite.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-purple py-2.5 text-[13px] font-bold text-white active:scale-95"
                    >
                      <Check size={15} /> Aceptar
                    </button>
                    <button
                      onClick={() => onDeclineInvite(invite.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-strong py-2.5 text-[13px] font-semibold text-foreground active:scale-95"
                    >
                      <X size={15} /> Rechazar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mb-8">
        <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-dim">Tus equipos</p>
        {loading ? (
          <p className="text-[13px] text-dim">Cargando…</p>
        ) : teams.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-dim">
            Aún no perteneces a ningún equipo.
          </div>
        ) : (
          <ul className="space-y-2">
            {teams.map((row) => {
              const team = one(row.team);
              return (
                <li key={team.id}>
                  <Link
                    href={`/teams/${team.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-surface/70 p-4 active:bg-surface-2"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple/15 text-purple">
                      <Users2 size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-semibold text-foreground">{team.name}</p>
                      <p className="text-[11.5px] capitalize text-dim">{row.role}</p>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-dim" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-dim">Crear equipo</p>
        <form onSubmit={onCreateTeam} className="space-y-3 rounded-2xl border border-line bg-surface/70 p-4">
          <input
            required
            placeholder="Nombre del equipo"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            className={inputClass}
          />
          {error && <p className="text-[13px] text-danger">{error}</p>}
          <button type="submit" disabled={creating} className={`${primaryButtonClass} flex items-center justify-center gap-2`}>
            <Plus size={16} /> {creating ? 'Creando…' : 'Crear equipo'}
          </button>
        </form>
      </section>
    </AppShell>
  );
}
