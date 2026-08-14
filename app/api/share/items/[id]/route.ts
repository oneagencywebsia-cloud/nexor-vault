import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Borra un share pendiente: lo usa tanto "rechazar" (el receptor descarta
// sin guardar) como el paso de limpieza tras "aceptar" (el cliente ya
// guardó una copia descifrada+re-cifrada en su propio vault vía
// /api/vault/items, y luego llama aquí para quitar el pendiente).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;

  const { data: share } = await supabaseAdmin
    .from('shared_items')
    .select('from_user_id, to_user_id')
    .eq('id', id)
    .maybeSingle();

  if (!share || (share.from_user_id !== session.userId && share.to_user_id !== session.userId)) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from('shared_items').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'No se pudo borrar' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
