'use client';

import { useState } from 'react';
import { Check, ChevronDown, Copy, Eye, EyeOff, ShieldCheck, Wand2 } from 'lucide-react';
import { generatePassword } from '@/lib/crypto';
import PasswordGenerator from './PasswordGenerator';

// Estimación sencilla de fortaleza: tamaño del alfabeto usado × longitud, con
// penalización por repeticiones. Es orientativa (no sustituye a zxcvbn).
export function passwordStrength(pwd: string): { score: 0 | 1 | 2 | 3 | 4; label: string; hint: string } {
  if (!pwd) return { score: 0, label: '', hint: '' };
  let pool = 0;
  if (/[a-z]/.test(pwd)) pool += 26;
  if (/[A-Z]/.test(pwd)) pool += 26;
  if (/\d/.test(pwd)) pool += 10;
  if (/[^A-Za-z0-9]/.test(pwd)) pool += 32;
  const unique = new Set(pwd).size;
  const effectiveLen = Math.min(pwd.length, unique * 2);
  const bits = effectiveLen * Math.log2(Math.max(pool, 2));

  if (bits < 40) return { score: 1, label: 'Débil', hint: 'Muy fácil de adivinar. Genera una nueva.' };
  if (bits < 60) return { score: 2, label: 'Mejorable', hint: 'Añade longitud y símbolos.' };
  if (bits < 80) return { score: 3, label: 'Fuerte', hint: 'Buena contraseña.' };
  return { score: 4, label: 'Excelente', hint: 'Muy difícil de descifrar.' };
}

const TONES = ['bg-line-strong', 'bg-danger', 'bg-warning', 'bg-success', 'bg-success'];
const TEXT_TONES = ['text-dim', 'text-danger', 'text-warning', 'text-success', 'text-success'];

export default function PasswordField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const strength = passwordStrength(value);

  function quickGenerate() {
    try {
      onChange(generatePassword({ length: 20, uppercase: true, lowercase: true, digits: true, symbols: true, excludeAmbiguous: true }));
      setVisible(true);
    } catch {
      /* si algo falla, el usuario puede abrir las opciones avanzadas */
    }
  }

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* portapapeles no disponible */
    }
  }

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-line-strong bg-white px-3.5 py-2.5 transition-all focus-within:border-purple focus-within:ring-4 focus-within:ring-purple/15">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={15} className="shrink-0 text-dim" />
          <label className="text-[10.5px] font-semibold uppercase tracking-wide text-dim">Contraseña</label>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <input
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            spellCheck={false}
            placeholder="Escribe una o genérala"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-w-0 flex-1 bg-transparent font-mono text-[15px] text-foreground outline-none placeholder:font-sans placeholder:text-dim/60"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-dim transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button
            type="button"
            onClick={copy}
            disabled={!value}
            aria-label="Copiar contraseña"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-dim transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
          >
            {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
          </button>
          <button
            type="button"
            onClick={quickGenerate}
            aria-label="Generar contraseña segura"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-purple px-2.5 text-[12px] font-bold text-white transition-transform active:scale-95"
          >
            <Wand2 size={14} /> Generar
          </button>
        </div>
      </div>

      {/* medidor de fortaleza */}
      {value && (
        <div className="px-1" aria-live="polite">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((n) => (
              <span
                key={n}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${strength.score >= n ? TONES[strength.score] : 'bg-line-strong'}`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-dim">
            <b className={`font-bold ${TEXT_TONES[strength.score]}`}>{strength.label}</b> · {strength.hint}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setAdvanced((a) => !a)}
        aria-expanded={advanced}
        className="flex items-center gap-1.5 px-1 text-[12px] font-semibold text-purple"
      >
        Opciones del generador
        <ChevronDown size={14} className={`transition-transform ${advanced ? 'rotate-180' : ''}`} />
      </button>
      {advanced && (
        <div className="nexor-rise">
          <PasswordGenerator
            onUse={(pwd) => {
              onChange(pwd);
              setVisible(true);
            }}
          />
        </div>
      )}
    </div>
  );
}
