import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyRequestIdentity } from "@/lib/session";

const ADMIN_STEAM_IDS = ["76561199757155122", "76561199724566305"];

const DEFAULT_MISSIONS = [
  {
    id: "m_aimbotz",
    modeId: "aim_botz",
    title: "Calentamiento de Acero (Aim Botz :27016)",
    targetText: "Elimina 100 Bots con Headshot en el servidor de practica",
    current: 0,
    goal: 100,
    eloReward: 10,
    eloPenalty: 13,
    bonusLabel: "+10 ELO & Bono Mano Caliente (+10 ELO en tu prox. victoria 5v5)",
    claimed: false,
    penalized: false,
  },
  {
    id: "m_dmffa",
    modeId: "dm_ffa",
    title: "Dominio de Duelos (Deathmatch FFA :27017)",
    targetText: "Consigue 40 bajas con AK-47, M4 o Deagle en FFA",
    current: 0,
    goal: 40,
    eloReward: 15,
    eloPenalty: 13,
    bonusLabel: "+15 ELO Directos + 150 Pts Sorteo Mensual Skins",
    claimed: false,
    penalized: false,
  },
  {
    id: "m_retakes",
    modeId: "retakes",
    title: "Especialista en Defuse (Retakes 5v5 :27018)",
    targetText: "Gana 10 rondas de Retake plantando o desactivando C4",
    current: 0,
    goal: 10,
    eloReward: 5,
    eloPenalty: 13,
    bonusLabel: "+5 ELO & 1 Escudo Protector (0 ELO perdido en tu prox. derrota)",
    claimed: false,
    penalized: false,
  },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { steam_id, mode_id, amount } = body;

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
      missions: DEFAULT_MISSIONS,
      eloShieldActive: Boolean(player.elo_shield),
      hotHandBonus: Boolean(player.hot_hand_bonus),
      weekExpiresAt: Date.now() + 7 * 86400 * 1000,
    };

    const updatedMissions = (currentData.missions || DEFAULT_MISSIONS).map((m: any) => {
      if (m.modeId === mode_id || m.id === mode_id) {
        const nextVal = Math.min(m.goal, (Number(m.current) || 0) + addValue);
        return { ...m, current: nextVal, penalized: false };
      }
      return m;
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
    endpoint: "AimVe Sports Practice Servers Webhook (:27016, :27017, :27018)",
  });
}