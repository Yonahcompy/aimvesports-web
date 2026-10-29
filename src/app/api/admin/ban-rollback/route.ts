import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyRequestIdentity } from "@/lib/session";

const ADMIN_STEAM_IDS = ["76561199757155122", "76561199724566305"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { admin_steam_id, target_identifier, reason } = body;

    const identity = verifyRequestIdentity(request, admin_steam_id);
    if (!identity.steamId || !ADMIN_STEAM_IDS.includes(String(identity.steamId))) {
      return NextResponse.json(
        { error: "Acceso denegado: Solo Administradores pueden ejecutar ELO Rollback." },
        { status: 403 }
      );
    }

    const target = String(target_identifier || "").trim();
    if (!target) {
      return NextResponse.json({ error: "Ingresa el SteamID64 o Nickname del infractor." }, { status: 400 });
    }

    // 1. Buscar al jugador infractor en leaderboard_players
    const { data: cheater } = await supabase
      .from("leaderboard_players")
      .select("*")
      .or(`steam_id.eq.${target},nickname.ilike.${target}`)
      .limit(1)
      .maybeSingle();

    if (!cheater) {
      return NextResponse.json({ error: "No se encontro ningun jugador con ese SteamID o Nickname." }, { status: 404 });
    }

    if (ADMIN_STEAM_IDS.includes(String(cheater.steam_id))) {
      return NextResponse.json({ error: "No se puede aplicar baneo a una cuenta Administradora." }, { status: 400 });
    }

    // 2. Marcar al tramposo como baneado, resetear su ELO a 0 y sacarlo de la cola
    await supabase
      .from("leaderboard_players")
      .update({
        is_banned: true,
        ban_reason: reason || "Infraccion Anti-Cheat confirmada por Demo GOTV",
        elo: 0,
        season_prize: "CUENTA SUSPENDIDA (AC)",
      })
      .eq("id", cheater.id);

    if (cheater.steam_id) {
      await supabase.from("matchmaking_queue").delete().eq("steam_id", String(cheater.steam_id));
    }

    // 3. Buscar partidas de los ultimos 7 dias donde el tramposo estuvo en el equipo ganador y aun no se haya hecho rollback
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
    const { data: recentMatches } = await supabase
      .from("matches")
      .select("*")
      .gte("created_at", sevenDaysAgo)
      .eq("rollback_applied", false);

    const refundedPlayers = new Set<string>();
    let matchesReverted = 0;

    if (recentMatches && recentMatches.length > 0 && cheater.steam_id) {
      for (const m of recentMatches) {
        const winners: string[] = Array.isArray(m.winner_steam_ids) ? m.winner_steam_ids.map(String) : [];
        const losers: string[] = Array.isArray(m.loser_steam_ids) ? m.loser_steam_ids.map(String) : [];

        if (winners.includes(String(cheater.steam_id))) {
          matchesReverted++;
          for (const victimSteamId of losers) {
            if (!victimSteamId || victimSteamId.startsWith("bot_")) continue;
            const { data: victim } = await supabase
              .from("leaderboard_players")
              .select("*")
              .eq("steam_id", victimSteamId)
              .maybeSingle();

            if (victim && !victim.is_banned) {
              const totalGames = (victim.wins || 0) + (victim.losses || 0);
              const restoredElo = totalGames >= 6 ? (victim.elo || 25) + 18 : victim.elo;
              const restoredLosses = Math.max(0, (victim.losses || 1) - 1);

              await supabase
                .from("leaderboard_players")
                .update({ elo: restoredElo, losses: restoredLosses })
                .eq("id", victim.id);

              refundedPlayers.add(victim.nickname);
            }
          }

          await supabase
            .from("matches")
            .update({
              rollback_applied: true,
              status: "ANULADA (AC ROLLBACK)",
              winner: `ELO Devuelto (+18 ELO a afectados)`,
            })
            .eq("id", m.id);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      banned_nickname: cheater.nickname,
      matches_reverted: matchesReverted,
      refunded_players: Array.from(refundedPlayers),
      message: `Justicia AimVe: ${cheater.nickname} fue baneado permanentemente. Partidas revertidas: ${matchesReverted}. Jugadores compensados (+18 ELO): ${
        refundedPlayers.size > 0 ? Array.from(refundedPlayers).join(", ") : "Ninguno pendiente"
      }.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}