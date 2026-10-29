import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyRequestIdentity } from "@/lib/session";
import { sendSourceRconCommand } from "@/lib/rconBridge";
import { INITIAL_MISSIONS } from "@/lib/ranks";

const ADMIN_STEAM_IDS = ["76561199757155122", "76561199724566305"];

const WORKSHOP_MAP_BY_MODE: Record<string, { workshopId: string; label: string }> = {
  aim_botz: { workshopId: "3070244462", label: "Aim Botz (uLLeticaL)" },
  m_aimbotz: { workshopId: "3070244462", label: "Aim Botz (uLLeticaL)" },
  dm_ffa: { workshopId: "3100869952", label: "Recoil Master (Spray)" },
  m_dmffa: { workshopId: "3100869952", label: "Recoil Master (Spray)" },
  retakes: { workshopId: "3070389038", label: "5E Aimhub & CSStats" },
  m_retakes: { workshopId: "3070389038", label: "5E Aimhub & CSStats" },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, steam_id, mode_id, amount } = body;

    // 1. ACCION: CAMBIAR MAPA DE WORKSHOP EN MIAMI DESDE LA WEB
    if (action === "launch") {
      const target = WORKSHOP_MAP_BY_MODE[String(mode_id)] || WORKSHOP_MAP_BY_MODE.aim_botz;
      const host = process.env.CS2_SERVER_HOST || "207.246.79.56";
      const port = Number(process.env.CS2_SERVER_PORT) || 27025;
      const rconPass = process.env.CS2_RCON_PASSWORD || "AimVe_Rcon_Miami_2026";

      const rconRes = await sendSourceRconCommand(
        host,
        port,
        rconPass,
        `host_workshop_map ${target.workshopId}`,
        2000
      );

      return NextResponse.json({
        ok: true,
        launched: target.label,
        workshopId: target.workshopId,
        rconOk: rconRes.ok,
        connectUrl: `steam://connect/207.246.79.56:${port}`,
      });
    }

    // 2. ACCION: REGISTRAR PROGRESO DE MISION EN SUPABASE
    const authHeader = request.headers.get("Authorization");
    const secretHeader = request.headers.get("x-aimve-secret");
    const expectedSecret = process.env.MATCHZY_WEBHOOK_SECRET || "aimve_matchzy_secret_2026";

    const isServerAuthorized =
      authHeader === "Bearer AimVe_Server_Miami_1" || secretHeader === expectedSecret;

    if (!isServerAuthorized) {
      const identity = verifyRequestIdentity(request, steam_id);
      if (!identity.steamId || !ADMIN_STEAM_IDS.includes(String(identity.steamId))) {
        return NextResponse.json(
          { error: "No autorizado: Solo el servidor de practica de Miami puede reportar progreso." },
          { status: 401 }
        );
      }
    }

    if (!steam_id || !mode_id) {
      return NextResponse.json({ error: "Faltan parametros steam_id o mode_id" }, { status: 400 });
    }

    const addValue = Math.max(1, Number(amount) || 1);

    const { data: player } = await supabase
      .from("leaderboard_players")
      .select("*")
      .eq("steam_id", String(steam_id))
      .maybeSingle();

    if (!player) {
      return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
    }

    const currentData = player.mission_data || {
      missions: INITIAL_MISSIONS,
      eloShieldActive: Boolean(player.elo_shield),
      hotHandBonus: Boolean(player.hot_hand_bonus),
      weekExpiresAt: Date.now() + 7 * 86400 * 1000,
    };

    const updatedMissions = (currentData.missions || INITIAL_MISSIONS).map((m: any) => {
      const template = INITIAL_MISSIONS.find((t) => t.id === m.id || t.modeId === m.modeId);
      const syncedMission = template
        ? { ...m, title: template.title, targetText: template.targetText }
        : m;

      if (syncedMission.modeId === mode_id || syncedMission.id === mode_id) {
        const nextVal = Math.min(syncedMission.goal, (Number(syncedMission.current) || 0) + addValue);
        return { ...syncedMission, current: nextVal, penalized: false };
      }
      return syncedMission;
    });

    const newMissionData = {
      ...currentData,
      missions: updatedMissions,
    };

    await supabase
      .from("leaderboard_players")
      .update({ mission_data: newMissionData })
      .eq("id", player.id);

    return NextResponse.json({
      ok: true,
      steam_id,
      mode_id,
      missions: updatedMissions,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "active",
    endpoint: "AimVe Sports Workshop Practice & Missions Webhook (:27025)",
  });
}