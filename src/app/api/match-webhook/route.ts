import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function getCalibratedElo(winsInSix: number): number {
  const table: Record<number, number> = {
    0: 25,
    1: 35,
    2: 50,
    3: 65,
    4: 80,
    5: 90,
    6: 100,
  };
  const clamped = Math.max(0, Math.min(6, winsInSix));
  return table[clamped] ?? 25;
}

export async function POST(request: Request) {
  try {
    // 1. Verificar token de seguridad del servidor CS2 de Miami
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader !== 'Bearer AimVe_Server_Miami_1') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await request.json();
    const eventType = payload.event || 'series_end';

    // 2. Procesar fin de mapa o serie enviado por MatchZy
    if (eventType === 'map_result' || eventType === 'series_end') {
      const team1Name = payload.team1?.name || 'Equipo Alpha';
      const team2Name = payload.team2?.name || 'Equipo Omega';
      const scoreA = Number(payload.team1?.score ?? payload.team1_score ?? 13);
      const scoreB = Number(payload.team2?.score ?? payload.team2_score ?? 9);
      const mapName = payload.map_name || payload.selected_map || 'de_mirage';

      const team1Won = scoreA >= scoreB;
      const winnerLabel = team1Won ? team1Name : team2Name;

      // Insertar resultado oficial en la tabla matches de Supabase
      await supabase.from('matches').insert([
        {
          team_a: team1Name,
          team_b: team2Name,
          selected_map: mapName,
          score_a: scoreA,
          score_b: scoreB,
          status: 'OFICIAL CS2',
          winner: winnerLabel,
        },
      ]);

      // Actualizar ELO de los jugadores reportados con su SteamID64
      const team1Players: string[] = payload.team1?.players_steamids || [];
      const team2Players: string[] = payload.team2?.players_steamids || [];

      const stompBonus = Math.min(scoreA, scoreB) <= 4 ? 4 : 0;

      for (const steamId of team1Players) {
        const { data: p } = await supabase
          .from('leaderboard_players')
          .select('*')
          .eq('steam_id', steamId)
          .maybeSingle();

        if (p) {
          const newWins = team1Won ? p.wins + 1 : p.wins;
          const newLosses = team1Won ? p.losses : p.losses + 1;
          const total = newWins + newLosses;
          const nextElo =
            total <= 6
              ? getCalibratedElo(newWins)
              : team1Won
              ? p.elo + 25 + stompBonus
              : Math.max(25, p.elo - 18);

          await supabase
            .from('leaderboard_players')
            .update({ elo: nextElo, wins: newWins, losses: newLosses })
            .eq('id', p.id);
        }
      }

      for (const steamId of team2Players) {
        const { data: p } = await supabase
          .from('leaderboard_players')
          .select('*')
          .eq('steam_id', steamId)
          .maybeSingle();

        if (p) {
          const newWins = !team1Won ? p.wins + 1 : p.wins;
          const newLosses = !team1Won ? p.losses : p.losses + 1;
          const total = newWins + newLosses;
          const nextElo =
            total <= 6
              ? getCalibratedElo(newWins)
              : !team1Won
              ? p.elo + 25 + stompBonus
              : Math.max(25, p.elo - 18);

          await supabase
            .from('leaderboard_players')
            .update({ elo: nextElo, wins: newWins, losses: newLosses })
            .eq('id', p.id);
        }
      }

      return NextResponse.json({ ok: true, recorded: true, winner: winnerLabel });
    }

    return NextResponse.json({ ok: true, event: eventType });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: 'AimVe Sports MatchZy Webhook',
    ready: true,
  });
}