// Generador de códigos TOTP (RFC 6238) 100% client-side vía Web Crypto —
// el secreto de un item nunca sale del navegador para calcular su código,
// igual que el resto del vault. Complementa lib/totp.ts (server-only, usado
// solo para el 2FA de la propia cuenta de Nexor Vault).

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD_SECONDS = 30;
const DIGITS = 6;

function base32Decode(str: string): Uint8Array {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(bytes);
}

function counterToBytes(counter: number): Uint8Array {
  const buf = new ArrayBuffer(8);
  new DataView(buf).setUint32(4, counter, false);
  return new Uint8Array(buf);
}

export interface TotpState {
  code: string;
  secondsRemaining: number;
}

export async function generateTotpCode(secretBase32: string, atTimeMs = Date.now()): Promise<TotpState> {
  const secretBytes = base32Decode(secretBase32);
  if (secretBytes.length === 0) throw new Error('Secreto TOTP inválido');

  const counter = Math.floor(atTimeMs / 1000 / PERIOD_SECONDS);
  const key = await crypto.subtle.importKey('raw', secretBytes as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterToBytes(counter) as BufferSource));
  const offset = sig[sig.length - 1] & 0x0f;
  const binary =
    ((sig[offset] & 0x7f) << 24) | ((sig[offset + 1] & 0xff) << 16) | ((sig[offset + 2] & 0xff) << 8) | (sig[offset + 3] & 0xff);

  return {
    code: String(binary % 10 ** DIGITS).padStart(DIGITS, '0'),
    secondsRemaining: PERIOD_SECONDS - (Math.floor(atTimeMs / 1000) % PERIOD_SECONDS),
  };
}

// Acepta lo que el usuario tenga a mano: el secreto base32 pelado (lo que
// se pega a mano hoy), o un link completo `otpauth://totp/...?secret=...`
// (lo que sale de escanear un QR, o de "no puedes escanear? copia este
// link" en la mayoría de webs) — le quita la complejidad de tener que
// localizar y copiar solo el trozo del secreto.
export function extractTotpSecret(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.toLowerCase().startsWith('otpauth://')) {
    try {
      const url = new URL(trimmed);
      const secret = url.searchParams.get('secret');
      return secret ? secret.toUpperCase() : null;
    } catch {
      return null;
    }
  }

  return trimmed.toUpperCase().replace(/\s+/g, '');
}
