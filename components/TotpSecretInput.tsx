'use client';

import { useRef, useState } from 'react';
import jsQR from 'jsqr';
import { ScanLine } from 'lucide-react';
import { extractTotpSecret } from '@/lib/totp-client';
import { inputClass } from './AuthCard';

// Campo de secreto TOTP: acepta pegar el código a mano (como antes) o
// escanear/subir una foto del QR que enseña el sitio al activar el 2FA —
// se decodifica 100% en el navegador (jsQR sobre un <canvas>), nunca sube
// la imagen a ningún sitio.
export function TotpSecretInput({ value, onChange }: { value: string; onChange: (secret: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setScanError(null);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no-canvas');
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);
      if (!result) throw new Error('No se detectó ningún QR en la imagen');

      const secret = extractTotpSecret(result.data);
      if (!secret) throw new Error('El QR no contiene un secreto TOTP válido');
      onChange(secret);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'No se pudo leer el QR');
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          placeholder="Secreto 2FA / TOTP (opcional)"
          value={value}
          onChange={(e) => onChange(extractTotpSecret(e.target.value) ?? '')}
          className={`${inputClass} flex-1 font-mono`}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Escanear código QR"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line-strong text-dim active:scale-90"
        >
          <ScanLine size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>
      <p className="mt-1.5 px-1 text-[11px] text-dim">
        Pega el código, el link <span className="font-mono">otpauth://</span>, o toca{' '}
        <ScanLine size={11} className="inline" /> para escanear el QR del sitio.
      </p>
      {scanError && <p className="mt-1 px-1 text-[11.5px] text-danger">{scanError}</p>}
    </div>
  );
}
