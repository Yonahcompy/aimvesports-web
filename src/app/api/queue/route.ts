import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Obtener la lista de jugadores buscando partida actualmente (limpiando inactivos > 20 min)
export async function GET() {
  try {
    const limiteTiempo = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    await supabase
      .from('matchmaking_queue')
      .delete()
      .lt('joined_at', limiteTiempo);

    const { data, error } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .order('joined_at', { ascending: true })
      .limit(10);

    if (error) {
      return NextResponse.json({ queue: [], count: 0, error: error.message });
    }

    return NextResponse.json({
      queue: data || [],
      count: data ? data.length : 0,
    });
  } catch (err: any) {
    return NextResponse.json({ queue: [], count: 0, error: err.message }, { status: 500 });
  }
}

// Entrar a la cola 5v5 con la cuenta de Steam conectada
export async function POST(request: Request) {
  try {
    const { steam_id, nickname, elo, country } = await request.json();

    if (!steam_id || !nickname) {
      return NextResponse.json({ error: 'Debes conectar tu cuenta de Steam para buscar partida.' }, { status: 400 });
    }

    const { error } = await supabase
      .from('matchmaking_queue')
      .upsert(
        [
          {
            steam_id,
            nickname,
            elo: Number(elo) || 0,
            country: country || 'VE',
            joined_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'steam_id' }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .order('joined_at', { ascending: true })
      .limit(10);

    return NextResponse.json({
      ok: true,
      queue: data || [],
      count: data ? data.length : 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Salir de la cola 5v5
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const steamId = searchParams.get('steam_id');

    if (steamId) {
      await supabase.from('matchmaking_queue').delete().eq('steam_id', steamId);
    }

    const { data } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .order('joined_at', { ascending: true })
      .limit(10);

    return NextResponse.json({
      ok: true,
      queue: data || [],
      count: data ? data.length : 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}