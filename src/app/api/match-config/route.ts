import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyMatchConfigToken } from "@/lib/rconBridge";
import { readVerifiedSteamIdsFromRequest } from "@/lib/session";

const ADMIN_STEAM_IDS = ["76561199757155122", "76561199724566305"];

const ALL_MAPS = [
  "de_mirage",
  "de_inferno",
  "de_dust2",
  "de_nuke",
  "de_ancient",
  "de_anubis",
  "de_vertigo",
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("match_id");
    const sig = searchParams.get("sig");

    let query = supabase.from("active_matches").select("*");
    if (matchId) {
      query = query.eq("id", matchId);
    } else {
      query = query
        .in("status", ["live", "veto", "finished"])
        .order("id", { ascending: false })
        .limit(1);
    }

    const { data: matches, error } = await query;
    const match = matches && matches.length > 0 ? matches[0] : null;

    if (error || !match) {
      return NextResponse.json(
        { error: "No se encontro una partida valida en la base de datos" },
        { status: 404 }
      );
    }

    const verifiedIds = readVerifiedSteamIdsFromRequest(request);
    const isCallerAdmin = verifiedIds.some((id) => ADMIN_STEAM_IDS.includes(String(id)));
    const isSignedServerRequest = verifyMatchConfigToken(match.id, sig);

    const banned: string[] = match.banned_maps || [];
    const remainingMaps = ALL_MAPS.filter((m) => !banned.includes(m));
    const chosenMap =
      remainingMaps.length === 1
        ? remainingMaps[0]
        : searchParams.get("map") || "de_mirage";

    const alphaPlayers: Record<string, string> = {};
    (match.team_alpha || []).forEach((p: any) => {
      if (p?.steam_id) alphaPlayers[String(p.steam_id)] = p.nickname || "Player";
    });

    const omegaPlayers: Record<string, string> = {};
    (match.team_omega || []).forEach((p: any) => {
      if (p?.steam_id) omegaPlayers[String(p.steam_id)] = p.nickname || "Player";
    });

    const capAlphaName = match.team_alpha?.[0]?.nickname || "Alpha";
    const capOmegaName = match.team_omega?.[0]?.nickname || "Omega";

    const webhookSecretValue =
      isSignedServerRequest || isCallerAdmin
        ? process.env.MATCHZY_WEBHOOK_SECRET || "aimve_matchzy_secret_2026"
        : "[PROTEGIDO_POR_AIMVE_HMAC]";

    const matchZyConfig = {
      matchid: Number(match.id),
      team1: {
        name: `Equipo ${capAlphaName}`,
        players: alphaPlayers,
      },
      team2: {
        name: `Equipo ${capOmegaName}`,
        players: omegaPlayers,
      },
      num_maps: 1,
      maplist: [chosenMap],
      map_sides: ["knife"],
      clinch_series: true,
      players_per_team: 5,
      min_players_to_ready: 1,
      cvars: {
        hostname: `AimVe Sports | Premier 5v5 #${match.id} | Miami 128-Tick`,
        mp_overtime_enable: "1",
        mp_overtime_maxrounds: "6",
        mp_overtime_startmoney: "10000",
        matchzy_gg_enabled: "1",
        matchzy_gg_min_score_diff: "0",
        matchzy_remote_log_url: "https://www.aimvesports.com/api/matchzy-webhook",
        matchzy_remote_log_header_key: "x-aimve-secret",
        matchzy_remote_log_header_value: webhookSecretValue,
      },
    };

    return NextResponse.json(matchZyConfig, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}