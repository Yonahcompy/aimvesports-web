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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("match_id");

    // Buscar por match_id exacto o tomar la partida activa mas reciente
    let query = supabase.from("active_matches").select("*");
    if (matchId) {
      query = query.eq("id", matchId);
    } else {
      query = query.in("status", ["live", "veto", "finished"]).order("id", { ascending: false }).limit(1);
    }

    const { data: matches, error } = await query;
    const match = matches && matches.length > 0 ? matches[0] : null;

    if (error || !match) {
      return NextResponse.json({ error: "No se encontro una partida valida en la base de datos" }, { status: 404 });
    }

    // Determinar el mapa ganador (el unico no incluido en banned_maps)
    const banned: string[] = match.banned_maps || [];
    const remainingMaps = ALL_MAPS.filter((m) => !banned.includes(m));
    const chosenMap = remainingMaps.length === 1 ? remainingMaps[0] : (searchParams.get("map") || "de_mirage");

    // Construir diccionarios de jugadores { "SteamID64": "Nickname" } para MatchZy
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

    const matchZyConfig = {
      matchid: Number(match.id),
      team1: {
        name: `Equipo ${capAlphaName}`,
        players: alphaPlayers
      },
      team2: {
        name: `Equipo ${capOmegaName}`,
        players: omegaPlayers
      },
      num_maps: 1,
      maplist: [chosenMap],
      map_sides: ["knife"],
      clinch_series: true,
      players_per_team: 5,
      cvars: {
        hostname: `AimVe Sports | Premier 5v5 #${match.id} | Miami 128-Tick`,
        mp_overtime_enable: "1",
        mp_overtime_maxrounds: "6",
        mp_overtime_startmoney: "10000",
        matchzy_remote_log_url: "https://www.aimvesports.com/api/matchzy-webhook",
        matchzy_remote_log_header_key: "x-aimve-secret",
        matchzy_remote_log_header_value: process.env.MATCHZY_WEBHOOK_SECRET || "aimve_matchzy_secret_2026"
      }
    };

    return NextResponse.json(matchZyConfig, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}