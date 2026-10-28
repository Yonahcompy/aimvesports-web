import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyRequestIdentity } from "@/lib/session";

const ADMIN_STEAM_IDS = ["76561199757155122", "76561199724566305"];

const MISSION_REWARDS: Record<string, { reward: number; goal: number }> = {
  m_aimbotz: { reward: 10, goal: 100 },
  m_dmffa: { reward: 15, goal: 40 },
  m_retakes: { reward: 5, goal: 10 },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, player_id, steam_id, mission_id, penalty_amount } = body;

    if (!player_id) {
      return NextResponse.json({ error: "Falta player_id" }, { status: 400 });
    }

    const { data: jugador, error: fetchErr } = await supabase
      .from("leaderboard_players")
      .select("*")
      .eq("id", player_id)
      .single();

    if (fetchErr || !jugador) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
    }

    // Validar identidad criptografica del solicitante
    const identity = verifyRequestIdentity(request, steam_id || jugador.steam_id);
    if (identity.error || !identity.steamId) {
      return NextResponse.json({ error: identity.error || "No autorizado" }, { status: 403 });
    }

    const callerIsAdmin = ADMIN_STEAM_IDS.includes(String(identity.steamId));
    const callerIsOwner = String(identity.steamId) === String(jugador.steam_id);

    if (!callerIsOwner && !callerIsAdmin) {
      return NextResponse.json(
        { error: "Alerta de Seguridad: No puedes modificar el ELO de otro jugador." },
        { status: 403 }
      );
    }

    const partidasActuales = (jugador.wins || 0) + (jugador.losses || 0);

    // Accion B: Reclamo Idempotente de Mision Semanal
    if (action === "mission_claim") {
      const mId = String(mission_id || "");
      const rule = MISSION_REWARDS[mId];
      if (!rule) {
        return NextResponse.json({ error: "Mision invalida" }, { status: 400 });
      }

      const mData = jugador.mission_data || { missions: [] };
      const dbMission = Array.isArray(mData.missions)
        ? mData.missions.find((m: any) => m.id === mId)
        : null;

      if (dbMission?.claimed) {
        return NextResponse.json(
          { error: "Esta mision ya fue reclamada esta semana." },
          { status: 409 }
        );
      }

      if (!callerIsAdmin && (!dbMission || Number(dbMission.current) < rule.goal)) {
        return NextResponse.json(
          { error: "Aun no has completado el objetivo en el servidor de practica." },
          { status: 403 }
        );
      }

      const nextHotHand = mId === "m_aimbotz" ? true : Boolean(jugador.hot_hand_bonus || mData.hotHandBonus);
      const nextShield = mId === "m_retakes" ? true : Boolean(jugador.elo_shield || mData.eloShieldActive);

      const updatedMissions = Array.isArray(mData.missions)
        ? mData.missions.map((m: any) =>
            m.id === mId ? { ...m, current: rule.goal, claimed: true } : m
          )
        : [];

      const updatedMissionData = {
        ...mData,
        missions: updatedMissions,
        hotHandBonus: nextHotHand,
        eloShieldActive: nextShield,
      };

      const nuevoElo = partidasActuales >= 6 ? jugador.elo + rule.reward : jugador.elo;

      const { data: actualizado } = await supabase
        .from("leaderboard_players")
        .update({
          elo: nuevoElo,
          elo_shield: nextShield,
          hot_hand_bonus: nextHotHand,
          mission_data: updatedMissionData,
        })
        .eq("id", jugador.id)
        .select()
        .single();

      return NextResponse.json({
        ok: true,
        calibrating: partidasActuales < 6,
        player: actualizado,
      });
    }

    // Accion C: Penalizacion de 7 dias (Solo Admin o corte real de semana vencida)
    if (action === "weekly_penalty") {
      if (!callerIsAdmin) {
        const exp = Number(jugador.mission_data?.weekExpiresAt || 0);
        if (exp > Date.now()) {
          return NextResponse.json({ error: "La semana aun sigue activa" }, { status: 403 });
        }
      }

      if (partidasActuales < 6) {
        return NextResponse.json({ ok: true, calibrating: true, player: jugador });
      }

      const castigoSeguro = Math.max(13, Math.min(39, Number(penalty_amount) || 13));
      const nuevoElo = Math.max(25, jugador.elo - castigoSeguro);

      const { data: actualizado } = await supabase
        .from("leaderboard_players")
        .update({ elo: nuevoElo })
        .eq("id", jugador.id)
        .select()
        .single();

      return NextResponse.json({ ok: true, player: actualizado });
    }

    return NextResponse.json({ error: "Accion no permitida desde el navegador" }, { status: 403 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}