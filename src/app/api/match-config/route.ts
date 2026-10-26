import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const map = searchParams.get('map') || 'de_mirage';
  const matchId = searchParams.get('id') || '1001';

  // Configuracion oficial estandar para MatchZy / CS2 Dedicated Server
  const matchZyConfig = {
    matchid: Number(matchId),
    num_maps: 1,
    maplist: [map],
    skip_veto: true,
    side_type: "standard",
    players_per_team: 5,
    min_players_to_ready: 1,
    team1: {
      name: "Equipo Alpha",
      tag: "ALPHA",
      flag: "VE",
      players: {
        "76561199724566305": "YonathanDHC"
      }
    },
    team2: {
      name: "Equipo Omega",
      tag: "OMEGA",
      flag: "VE",
      players: {}
    },
    cvars: {
      hostname: `AimVe Sports #1 | ${map.toUpperCase()} | 5v5 Competitivo`,
      mp_overtime_enable: "1",
      sv_lan: "0"
    }
  };

  return NextResponse.json(matchZyConfig);
}