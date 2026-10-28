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
    const secretHeader = request.headers.get("x-aimve-secret");
    const expectedSecret = process.env.MATCHZY_WEBHOOK_SECRET || "aimve_matchzy_secret_2026";

    if (secretHeader !== expectedSecret) {
      return NextResponse.json({ error: "No autorizado: firma invalida" }, { status: 401 });
    }

    const payload = await request.json();
    const eventType = payload.event || "map_result";

    if (eventType !== "map_result" && eventType !== "series_end" && eventType !== "surrender") {
      return NextResponse.json({ ok: true, ignored_event: eventType });
    }

    const matchId = Number(payload.matchid);
    if (!matchId) {
      return NextResponse.json({ error: "Falta matchid en el payload" }, { status: 400 });
    }

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

    // Extraer rondas jugadas y determinar fase de ELO Proporcional
    const scoreA = Number(payload?.team1?.score ?? payload?.score_a ?? 0);
    const scoreB = Number(payload?.team2?.score ?? payload?.score_b ?? 0);
    const totalRounds = scoreA + scoreB;
    const maxScore = Math.max(scoreA, scoreB);

    // Determinar quien gano (si hubo surrender explicito de un equipo, gana el contrario)
    const surrenderedTeam = payload.surrendered_team; // "alpha" | "omega" | undefined
    const alphaWins = surrenderedTeam
      ? surrenderedTeam === "omega"
      : scoreA >= scoreB;

    // Escala de ELO segun rondas jugadas al momento de rendirse o terminar:
    // - 0 a 3 rondas (ej. 3-0 o antes): 0 ELO (+0 / -0) -> REMAKE
    // - 4 a 9 rondas (ej. 7-2 o antes): 50% ELO (+13 / -9) -> RENDICION TEMPRANA
    // - 10+ rondas (ej. 10-8 o partida completa): 100% ELO (+25 / -18) -> COMPLETA
    let winEloDelta = 25;
    let lossEloDelta = 18;
    let matchStatusLabel = "PREMIER 5v5";

    if (totalRounds <= 3 && maxScore < 13) {
      winEloDelta = 0;
      lossEloDelta = 0;
      matchStatusLabel = "REMAKE (0 ELO)";
    } else if (totalRounds <= 9 && maxScore < 13) {
      winEloDelta = 13;
      lossEloDelta = 9;
      matchStatusLabel = "RENDICION (50% ELO)";
    } else {
      const roundsLoser = Math.min(scoreA, scoreB);
      const stompBonus = maxScore >= 13 && roundsLoser <= 4 ? 4 : 0;
      winEloDelta = 25 + stompBonus;
      lossEloDelta = 18;
      matchStatusLabel = maxScore < 13 ? "RENDICION (100% ELO)" : "PREMIER 5v5";
    }

    const capAlphaName = match.team_alpha?.[0]?.nickname || "Alpha";
    const capOmegaName = match.team_omega?.[0]?.nickname || "Omega";
    const teamAName = `Equipo ${capAlphaName}`;
    const teamBName = `Equipo ${capOmegaName}`;
    const winnerTeam =
      winEloDelta === 0
        ? "Anulada por Remake (0 ELO)"
        : alphaWins
        ? `${teamAName} (+${winEloDelta} ELO)`
        : `${teamBName} (+${winEloDelta} ELO)`;

    const banned: string[] = match.banned_maps || [];
    const remaining = ALL_MAPS.filter((m) => !banned.includes(m));
    const playedMap = payload.map_name || (remaining.length === 1 ? remaining[0] : "de_mirage");

    // Insertar resultado oficial en la tabla 'matches'
    await supabase.from("matches").insert([
      {
        team_a: teamAName,
        team_b: teamBName,
        selected_map: playedMap,
        banned_maps: banned,
        score_a: scoreA,
        score_b: scoreB,
        status: matchStatusLabel,
        winner: winnerTeam
      }
    ]);

    // Actualizar ELO solo si se jugaron 4 o mas rondas (winEloDelta > 0)
    if (winEloDelta > 0) {
      const { data: allLeaderboard } = await supabase.from("leaderboard_players").select("*");
      if (allLeaderboard && allLeaderboard.length > 0) {
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
              const bonusHotHand = row.hot_hand_bonus ? 10 : 0;
              const nextElo =
                newTotal < 6
                  ? 0
                  : newTotal === 6
                  ? getInitialCalibratedElo(newWins)
                  : (row.elo || 0) + winEloDelta + bonusHotHand;

              await supabase
                .from("leaderboard_players")
                .update({ elo: nextElo, wins: newWins, hot_hand_bonus: false })
                .eq("id", row.id);
            } else {
              const newLosses = (row.losses || 0) + 1;
              const newTotal = (row.wins || 0) + newLosses;
              const protectedByShield = Boolean(row.elo_shield);
              const nextElo =
                newTotal < 6
                  ? 0
                  : newTotal === 6
                  ? getInitialCalibratedElo(row.wins || 0)
                  : protectedByShield
                  ? row.elo || 0
                  : Math.max(25, (row.elo || 0) - lossEloDelta);

              await supabase
                .from("leaderboard_players")
                .update({ elo: nextElo, losses: newLosses, elo_shield: false })
                .eq("id", row.id);
            }
          }
        };

        await updateTeamElo(match.team_alpha || [], alphaWins);
        await updateTeamElo(match.team_omega || [], !alphaWins);
      }
    }

    // Marcar partida como 'finished' y liberar el servidor de Miami
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
      tier: matchStatusLabel,
      elo_awarded: winEloDelta,
      elo_deducted: lossEloDelta,
      score: `${scoreA}:${scoreB}`,
      server_freed: true
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}