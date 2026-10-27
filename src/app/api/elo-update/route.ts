import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function calcularEloCalibrado(victoriasEnSeis: number): number {
  const tabla: Record<number, number> = {
    0: 25,
    1: 35,
    2: 50,
    3: 65,
    4: 80,
    5: 90,
    6: 100,
  };
  const ajustado = Math.max(0, Math.min(6, victoriasEnSeis));
  return tabla[ajustado] ?? 25;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, player_id, steam_id, won, rounds_loser, hot_hand, shield_active, mission_reward, penalty_amount } = body;

    if (!player_id) {
      return NextResponse.json({ error: 'Falta player_id' }, { status: 400 });
    }

    const { data: jugador, error: fetchErr } = await supabase
      .from('leaderboard_players')
      .select('*')
      .eq('id', player_id)
      .single();

    if (fetchErr || !jugador) {
      return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 });
    }

    const partidasActuales = (jugador.wins || 0) + (jugador.losses || 0);

    // Accion A: Resultado de partida 5v5
    if (action === 'match_result') {
      const nuevasVictorias = won ? jugador.wins + 1 : jugador.wins;
      const nuevasDerrotas = won ? jugador.losses : jugador.losses + 1;
      const nuevoTotal = nuevasVictorias + nuevasDerrotas;

      let nuevoElo = jugador.elo;
      if (nuevoTotal < 6) {
        nuevoElo = 0;
      } else if (nuevoTotal === 6) {
        nuevoElo = calcularEloCalibrado(nuevasVictorias);
      } else if (won) {
        const bonoPaliza = Number(rounds_loser) <= 4 ? 4 : 0;
        const bonoManoCaliente = hot_hand ? 10 : 0;
        nuevoElo = jugador.elo + 25 + bonoPaliza + bonoManoCaliente;
      } else {
        nuevoElo = shield_active ? jugador.elo : Math.max(25, jugador.elo - 18);
      }

      const { data: actualizado } = await supabase
        .from('leaderboard_players')
        .update({ elo: nuevoElo, wins: nuevasVictorias, losses: nuevasDerrotas })
        .eq('id', jugador.id)
        .select()
        .single();

      // Sacar al jugador de la cola activa al terminar su partida
      if (steam_id || jugador.steam_id) {
        await supabase
          .from('matchmaking_queue')
          .delete()
          .eq('steam_id', steam_id || jugador.steam_id);
      }

      return NextResponse.json({ ok: true, player: actualizado });
    }

    // Accion B: Reclamo de Mision Semanal (tope validado de +5 a +15 ELO, solo si ya calibro 6 partidas)
    if (action === 'mission_claim') {
      if (partidasActuales < 6) {
        return NextResponse.json({ ok: true, calibrating: true, player: jugador });
      }
      const recompensaSegura = Math.max(5, Math.min(15, Number(mission_reward) || 5));
      const nuevoElo = jugador.elo + recompensaSegura;

      const { data: actualizado } = await supabase
        .from('leaderboard_players')
        .update({ elo: nuevoElo })
        .eq('id', jugador.id)
        .select()
        .single();

      return NextResponse.json({ ok: true, player: actualizado });
    }

    // Accion C: Penalizacion de 7 dias (-13 ELO por mision incompleta, solo si ya calibro 6 partidas)
    if (action === 'weekly_penalty') {
      if (partidasActuales < 6) {
        return NextResponse.json({ ok: true, calibrating: true, player: jugador });
      }
      const castigoSeguro = Math.max(13, Math.min(39, Number(penalty_amount) || 13));
      const nuevoElo = Math.max(25, jugador.elo - castigoSeguro);

      const { data: actualizado } = await supabase
        .from('leaderboard_players')
        .update({ elo: nuevoElo })
        .eq('id', jugador.id)
        .select()
        .single();

      return NextResponse.json({ ok: true, player: actualizado });
    }

    return NextResponse.json({ error: 'Accion no valida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}