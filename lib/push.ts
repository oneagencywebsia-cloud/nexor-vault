import 'server-only';
import webpush from 'web-push';
import { supabaseAdmin } from './supabase-admin';

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;
  webpush.setVapidDetails('mailto:soporte@nexor-vault.app', publicKey, privateKey);
  configured = true;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// Envía una notificación push a todas las suscripciones activas de un
// usuario. Si una suscripción devuelve 404/410 (navegador la invalidó) se
// borra en vez de reintentar indefinidamente.
export async function sendPushToUser(userId: string, payload: PushPayload) {
  ensureConfigured();
  if (!configured) return;

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);
  if (!subs?.length) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    }),
  );
}

// Notifica a todos los miembros de un equipo salvo al que disparó la acción
// (p.ej. quien añadió el item/carpeta no necesita que se lo digan a sí mismo).
export async function sendPushToTeamMembers(teamId: string, excludeUserId: string, payload: PushPayload) {
  const { data: members } = await supabaseAdmin
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .neq('user_id', excludeUserId);
  if (!members?.length) return;

  await Promise.all(members.map((m) => sendPushToUser(m.user_id, payload)));
}
