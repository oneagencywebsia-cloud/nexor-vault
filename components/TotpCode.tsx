'use client';

import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { generateTotpCode, type TotpState } from '@/lib/totp-client';

const RADIUS = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Código 2FA en vivo para un item del vault (login que además guarda su
// secreto TOTP). Se recalcula cada segundo en el navegador — el secreto
// nunca se manda al server para esto.
export function TotpCode({ secret }: { secret: string }) {
  const [state, setState] = useState<TotpState | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const result = await generateTotpCode(secret);
        if (!cancelled) setState(result);
      } catch {
        if (!cancelled) setState(null);
      }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [secret]);

  if (!state) return null;
  const progress = state.secondsRemaining / 30;

  return (
    <button
      onClick={() => navigator.clipboard.writeText(state.code)}
      className="mt-2 flex w-full items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2 text-left active:scale-[0.98]"
    >
      <span className="font-mono text-[15px] font-bold tracking-[0.15em] text-foreground">
        {state.code.slice(0, 3)} {state.code.slice(3)}
      </span>
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 -rotate-90">
        <circle cx="10" cy="10" r={RADIUS} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2.5" />
        <circle
          cx="10"
          cy="10"
          r={RADIUS}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          className={state.secondsRemaining <= 5 ? 'text-danger' : 'text-purple'}
        />
      </svg>
      <span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] font-semibold text-purple">
        <Copy size={12} /> Copiar
      </span>
    </button>
  );
}
