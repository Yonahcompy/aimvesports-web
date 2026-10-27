import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: Obtener lista actual limpiando inactivos
export async function GET() {
  try {
    const limiteTiempo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await supabase.from('matchmaking_queue').delete().lt('joined_at', limiteTiempo);

    const { data, error } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .order('joined_at', { ascending: true })
      .limit(10);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ queue: data || [], count: data ? data.length : 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Entrar a la cola y formar partida automatica al llegar a 10
export async function POST(request: Request) {
  try {
    const { steam_id, nickname, elo, country } = await request.json();

    if (!steam_id || !nickname) {
      return NextResponse.json({ error: 'Faltan datos de Steam' }, { status: 400 });
    }

    // 1. Registrar jugador
    await supabase.from('matchmaking_queue').upsert(
      [{ steam_id, nickname, elo: Number(elo || 0), country: country || 'VE', joined_at: new Date().toISOString() }],
      { onConflict: 'steam_id' }
    );

    // 2. Verificar si llegamos a 10 jugadores
    const { data: queueList } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .order('joined_at', { ascending: true })
      .limit(10);

    if (queueList && queueList.length >= 10) {
      // 3. Ordenar por ELO (mayor a menor)
      const sortedPlayers = [...queueList].sort((a, b) => b.elo - a.elo);
      
      // 4. Reparticion justa (Snake Draft)
      const team_alpha = [sortedPlayers[0], sortedPlayers[3], sortedPlayers[4], sortedPlayers[7], sortedPlayers[8]];
      const team_omega = [sortedPlayers[1], sortedPlayers[2], sortedPlayers[5], sortedPlayers[6], sortedPlayers[9]];

      const captain_alpha_steam_id = team_alpha[0].steam_id;
      const captain_omega_steam_id = team_omega[0].steam_id;

      // 5. Crear la partida oficial en active_matches
      const { data: matchData, error: matchErr } = await supabase
        .from('active_matches')
        .insert([{
          team_alpha,
          team_omega,
          captain_alpha_steam_id,
          captain_omega_steam_id,
          status: 'veto',
          banned_maps: []
        }])
        .select()
        .single();

      if (!matchErr && matchData) {
        // 6. Limpiar la cola vaciando a los 10 jugadores emparejados
        const steamIds = sortedPlayers.map(p => p.steam_id);
        await supabase.from('matchmaking_queue').delete().in('steam_id', steamIds);
        
        return NextResponse.json({ ok: true, match_created: true, match: matchData, queue: queueList, count: 10 });
      }
    }

    return NextResponse.json({ ok: true, queue: queueList || [], count: queueList ? queueList.length : 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Salir de la cola
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const steam_id = searchParams.get('steam_id');
    if (steam_id) await supabase.from('matchmaking_queue').delete().eq('steam_id', steam_id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}