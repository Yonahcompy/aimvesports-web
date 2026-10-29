import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyRequestIdentity } from "@/lib/session";
import { sendSourceRconCommand } from "@/lib/rconBridge";
import { INITIAL_MISSIONS } from "@/lib/ranks";

const ORCHESTRATOR_URL = "http://207.246.79.56:8085";

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

    // 1. SOLICITAR SALA DE PRACTICA AL ORQUESTADOR DE MIAMI (CON SEMAFORO DE CUPOS)
    if (action === "launch") {
      const target = WORKSHOP_MAP_BY_MODE[String(mode_id)] || WORKSHOP_MAP_BY_MODE.aim_botz;

      try {
        const orchRes = await fetch(ORCHESTRATOR_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode_id: String(mode_id) }),
          signal: AbortSignal.timeout(3500),
        });
        const orchData = await orchRes.json();

        if (orchRes.status === 429 || orchData.busy) {
          return NextResponse.json(
            {
              ok: false,
              busy: true,
              activeRooms: orchData.activeRooms || 2,
              maxRooms: orchData.maxRooms || 2,
              message:
                orchData.message ||
                "SERVIDORES DE PRACTICA OCUPADOS: Todas las salas individuales estan en uso en este momento. Intenta en unos minutos.",
            },
            { status: 429 }
          );
        }

        return NextResponse.json({
          ok: true,
          busy: false,
          launched: target.label,
          port: orchData.port || 27025, waitMs: orchData.waitMs || 4000,
          connectUrl: orchData.connectUrl || "steam://connect/207.246.79.56:27025",
        });
      } catch {
        // Fallback directo por RCON a la Sala 1 (:27025) si el puerto HTTP 8085 no responde
        const host = process.env.CS2_SERVER_HOST || "207.246.79.56";
        const rconPass = process.env.CS2_RCON_PASSWORD || "AimVe_Rcon_Miami_2026";
        await sendSourceRconCommand(
          host,
          27025,
          rconPass,
          `host_workshop_map ${target.workshopId}`,
          2000
        );
        return NextResponse.json({
          ok: true,
          busy: false,
          launched: target.label,
          port: 27025,
          connectUrl: "steam://connect/207.246.79.56:27025",
        });
      }
    }

    // 2. RECIBIR PROGRESO REAL AUDITADO POR EL SERVIDOR DE MIAMI
    const authHeader = request.headers.get("Authorization");
    const secretHeader = request.headers.get("x-aimve-secret");
    const expectedSecret = process.env.MATCHZY_WEBHOOK_SECRET || "aimve_matchzy_secret_2026";

    const isServerAuthorized =
      authHeader === "Bearer AimVe_Server_Miami_1" || secretHeader === expectedSecret;

    if (!isServerAuthorized) {
      return NextResponse.json(
        { error: "No autorizado: Solo el servidor dedicado de Miami puede reportar bajas reales." },
        { status: 401 }
      );
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
      const goal = template ? template.goal : m.goal;
      const syncedMission = template
        ? {
            ...m,
            title: template.title,
            targetText: template.targetText,
            goal,
            claimed: (Number(m.current) || 0) >= goal ? m.claimed : false,
          }
        : m;

      if (syncedMission.modeId === mode_id || syncedMission.id === mode_id) {
        const nextVal = Math.min(goal, (Number(syncedMission.current) || 0) + addValue);
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

export async function GET(request: Request) {
  let roomStatus = {
    prime_time_5v5: false,
    busy_rooms: 0,
    max_rooms: 2,
  };

  try {
    const orchRes = await fetch(ORCHESTRATOR_URL, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    if (orchRes.ok) {
      const data = await orchRes.json();
      roomStatus = {
        prime_time_5v5: Boolean(data.prime_time_5v5),
        busy_rooms: Number(data.busy_rooms) || 0,
        max_rooms: Number(data.max_rooms) || 2,
      };
    }
  } catch {}

  // Si el usuario tiene sesion activa, devolvemos tambien su progreso actualizado desde Supabase
  let liveMissions = null;
  try {
    const identity = verifyRequestIdentity(request);
    if (identity?.steamId) {
      const { data: player } = await supabase
        .from("leaderboard_players")
        .select("mission_data")
        .eq("steam_id", String(identity.steamId))
        .maybeSingle();
      if (player?.mission_data?.missions) {
        liveMissions = player.mission_data.missions;
      }
    }
  } catch {}

  return NextResponse.json({
    status: "active",
    roomStatus,
    liveMissions,
  });
}