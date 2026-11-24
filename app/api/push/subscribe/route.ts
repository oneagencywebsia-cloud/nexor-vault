import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isAllowedPushEndpoint } from '@/lib/push-endpoint';
import { readJson } from '@/lib/request';

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await readJson(req);
  const { endpoint, keys } = (body.subscription ?? {}) as { endpoint?: unknown; keys?: { p256dh?: string; auth?: string } };
  if (!isAllowedPushEndpoint(endpoint) || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(
      { user_id: session.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'endpoint' },
    );

  if (error) return NextResponse.json({ error: 'No se pudo guardar la suscripción' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await readJson(req);
  const endpoint = String(body.endpoint || '');
  if (!endpoint) return NextResponse.json({ error: 'Falta endpoint' }, { status: 400 });

  await supabaseAdmin.from('push_subscriptions').delete().eq('user_id', session.userId).eq('endpoint', endpoint);
  return NextResponse.json({ ok: true });
}
