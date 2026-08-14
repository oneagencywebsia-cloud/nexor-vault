'use client';

import { useState } from 'react';
import { generatePassword } from '@/lib/crypto';

export default function PasswordGenerator({ onUse }: { onUse: (password: string) => void }) {
  const [length, setLength] = useState(20);
  const [uppercase, setUppercase] = useState(true);
  const [lowercase, setLowercase] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(true);
  const [preview, setPreview] = useState('');

  function regenerate() {
    try {
      setPreview(generatePassword({ length, uppercase, lowercase, digits, symbols, excludeAmbiguous }));
    } catch {
      setPreview('');
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line-strong bg-surface-2 p-4">
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={preview}
          placeholder="Genera una contraseña…"
          className="min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 py-2.5 font-mono text-[13px] text-foreground"
        />
        <button
          type="button"
          onClick={regenerate}
          className="shrink-0 rounded-xl bg-line-strong px-3 py-2.5 text-[13px] font-semibold text-foreground active:scale-95"
        >
          Generar
        </button>
        <button
          type="button"
          disabled={!preview}
          onClick={() => onUse(preview)}
          className="shrink-0 rounded-xl bg-purple px-3.5 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
        >
          Usar
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="shrink-0 text-[11px] font-medium text-dim">Longitud: {length}</label>
        <input
          type="range"
          min={8}
          max={64}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="flex-1 accent-purple"
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11.5px] text-mist">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} className="accent-purple" />
          Mayúsculas
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={lowercase} onChange={(e) => setLowercase(e.target.checked)} className="accent-purple" />
          Minúsculas
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={digits} onChange={(e) => setDigits(e.target.checked)} className="accent-purple" />
          Números
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={symbols} onChange={(e) => setSymbols(e.target.checked)} className="accent-purple" />
          Símbolos
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={excludeAmbiguous}
            onChange={(e) => setExcludeAmbiguous(e.target.checked)}
            className="accent-purple"
          />
          Excluir ambiguos (l, I, 1, O, 0)
        </label>
      </div>
    </div>
  );
}
