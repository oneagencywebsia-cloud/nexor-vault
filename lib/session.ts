import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = 'kc_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h — solo autentica la API, no da acceso a la vault key
const PENDING_TOTP_TTL_SECONDS = 5 * 60; // 5 min para completar el 2FA

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Falta SESSION_SECRET en el entorno');
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  email: string;
}

async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload, purpose: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== 'session') return null; // rechaza tokens pendientes de 2FA
    return { userId: payload.userId as string, email: payload.email as string };
  } catch {
    return null;
  }
}

/**
 * Crea la sesión: setea la cookie httpOnly (web app) y devuelve el token crudo
 * para que el caller lo incluya en el JSON de respuesta — lo necesita la
 * extensión de navegador, que no puede depender de la cookie (SameSite=lax
 * bloquea el envío de cookies en fetch cross-site desde chrome-extension://).
 */
export async function createSessionCookie(payload: SessionPayload): Promise<string> {
  const token = await signSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return token;
}

/**
 * Resuelve la sesión desde la cookie (web app) o desde `Authorization: Bearer`
 * (extensión / clientes API). Pasar `req` cuando esté disponible en el route
 * handler para soportar ambos.
 */
export async function getSession(req?: NextRequest): Promise<SessionPayload | null> {
  const authHeader = req?.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return verifySessionToken(authHeader.slice(7));
  }
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Token de corta duración emitido tras verificar authHash cuando el usuario
 * tiene 2FA activado. Solo sirve para completar /api/auth/totp/verify-login
 * — nunca es aceptado por getSession() como sesión válida.
 */
export async function signPendingTotpToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload, purpose: 'totp-pending' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_TOTP_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyPendingTotpToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== 'totp-pending') return null;
    return { userId: payload.userId as string, email: payload.email as string };
  } catch {
    return null;
  }
}
