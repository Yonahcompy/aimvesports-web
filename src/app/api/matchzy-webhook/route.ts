import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const ALL_MAPS = [
  "de_mirage",
  "de_inferno",
  "de_dust2",
  "de_nuke",
  "de_ancient",
  "de_anubis",
  "de_vertigo"
];

function getInitialCalibratedElo(wins: number): number {
  const table: Record<number, number> = { 0: 25, 1: 40, 2: 55, 3: 70, 4: 85, 5: 95, 6: 100 };
  return table[wins] ?? 55;
}

export async function POST(request: Request) {
  try {
    // 1. Validar llave secreta del servidor de Miami
    const secretHeader = request.headers.get("x-aimve-secret");
    const expectedSecret = process.env.MATCHZY_WEBHOOK_SECRET || "aimve_matchzy_secret_2026";

    if (secretHeader !== expectedSecret) {
      return NextResponse.json({ error: "No autorizado: firma invalida" }, { status: 401 });
    }

    const payload = await request.json();
    const eventType = payload.event || "map_result";

    // Ignorar eventos intermedios de MatchZy (round_end, going_live, series_start)
    if (eventType !== "map_result" && eventType !== "series_end") {
      return NextResponse.json({ ok: true, ignored_event: eventType });
    }

    const matchId = Number(payload.matchid);
    if (!matchId) {
      return NextResponse.json({ error: "Falta matchid en el payload" }, { status: 400 });
    }

    // 2. Buscar la partida en active_matches
    const { data: match, error: fetchErr } = await supabase
      .from("active_matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (fetchErr || !match) {
      return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
    }

    if (match.status === "finished" || match.status === "finishing") {
      return NextResponse.json({ ok: true, already_processed: true });
    }

    // 3. Candado atómico: pasar a 'finishing' para evitar doble cobro entre map_result y series_end
    const { data: lockedMatch, error: lockErr } = await supabase
      .from("active_matches")
      .update({ status: "finishing", turn_expires_at: null })
      .eq("id", matchId)
      .in("status", ["live", "veto", "ready_check"])
      .select()
      .single();

    if (lockErr || !lockedMatch) {
      return NextResponse.json({ ok: true, already_processed: true });
    }

    // 4. Extraer puntajes de Team Alpha (team1) y Team Omega (team2)
    const scoreA = Number(payload?.team1?.score ?? payload?.score_a ?? 13);
    const scoreB = Number(payload?.team2?.score ?? payload?.score_b ?? 0);
    const alphaWins = scoreA >= scoreB;
    const roundsLoser = Math.min(scoreA, scoreB);

    const capAlphaName = match.team_alpha?.[0]?.nickname || "Alpha";
    const capOmegaName = match.team_omega?.[0]?.nickname || "Omega";
    const teamAName = `Equipo ${capAlphaName}`;
    const teamBName = `Equipo ${capOmegaName}`;
    const winnerTeam = alphaWins ? teamAName : teamBName;

    const banned: string[] = match.banned_maps || [];
    const remaining = ALL_MAPS.filter((m) => !banned.includes(m));
    const playedMap = payload.map_name || (remaining.length === 1 ? remaining[0] : "de_mirage");

    // 5. Insertar resultado oficial en la tabla 'matches'
    await supabase.from("matches").insert([
      {
        team_a: teamAName,
        team_b: teamBName,
        selected_map: playedMap,
        banned_maps: banned,
        score_a: scoreA,
        score_b: scoreB,
        status: "PREMIER 5v5",
        winner: winnerTeam
      }
    ]);

    // 6. Actualizar ELO, Victorias y Derrotas en leaderboard_players para los jugadores registrados
    const { data: allLeaderboard } = await supabase.from("leaderboard_players").select("*");
    if (allLeaderboard && allLeaderboard.length > 0) {
      const stompBonus = roundsLoser <= 4 ? 4 : 0;

      const updateTeamElo = async (teamPlayers: any[], isWinner: boolean) => {
        for (const p of teamPlayers) {
          if (!p || String(p.steam_id).startsWith("bot_")) continue;
          const row = allLeaderboard.find(
            (lb: any) =>
              (p.steam_id && String(lb.steam_id) === String(p.steam_id)) ||
              lb.nickname === p.nickname
          );
          if (!row) continue;

          if (isWinner) {
            const newWins = (row.wins || 0) + 1;
            const newTotal = newWins + (row.losses || 0);
            const nextElo =
              newTotal < 6
                ? 0
                : newTotal === 6
                ? getInitialCalibratedElo(newWins)
                : (row.elo || 0) + 25 + stompBonus;

            await supabase
              .from("leaderboard_players")
              .update({ elo: nextElo, wins: newWins })
              .eq("id", row.id);
          } else {
            const newLosses = (row.losses || 0) + 1;
            const newTotal = (row.wins || 0) + newLosses;
            const nextElo =
              newTotal < 6
                ? 0
                : newTotal === 6
                ? getInitialCalibratedElo(row.wins || 0)
                : Math.max(25, (row.elo || 0) - 18);

            await supabase
              .from("leaderboard_players")
              .update({ elo: nextElo, losses: newLosses })
              .eq("id", row.id);
          }
        }
      };

      await updateTeamElo(match.team_alpha || [], alphaWins);
      await updateTeamElo(match.team_omega || [], !alphaWins);
    }

    // 7. Marcar partida como 'finished' y liberar el servidor de Miami en 'game_servers'
    await supabase
      .from("active_matches")
      .update({ status: "finished", turn_expires_at: null })
      .eq("id", matchId);

    await supabase
      .from("game_servers")
      .update({ status: "free", current_match_id: null })
      .eq("current_match_id", matchId);

    return NextResponse.json({
      ok: true,
      match_id: matchId,
      winner: winnerTeam,
      score: `${scoreA}:${scoreB}`,
      server_freed: true
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}