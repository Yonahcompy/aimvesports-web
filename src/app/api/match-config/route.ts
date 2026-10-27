import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const map = searchParams.get('map') || 'de_mirage';
  const matchId = searchParams.get('id') || '1001';
  const captainSteamId = searchParams.get('steam_id') || '76561199724566305';
  const captainNick = searchParams.get('nick') || 'YonathanDHC';

  const matchZyConfig = {
    matchid: Number(matchId),
    num_maps: 1,
    maplist: [map],
    skip_veto: true,
    side_type: 'standard',
    players_per_team: 5,
    min_players_to_ready: 1,
    team1: {
      name: `Equipo ${captainNick}`,
      tag: 'ALPHA',
      flag: 'VE',
      players: {
        [captainSteamId]: captainNick,
      },
    },
    team2: {
      name: 'Equipo Viper_CCS',
      tag: 'OMEGA',
      flag: 'VE',
      players: {},
    },
    cvars: {
      hostname: `AimVe Sports #1 | ${map.toUpperCase()} | 5v5 Competitivo`,
      mp_overtime_enable: '1',
      sv_lan: '0',
      matchzy_whitelist_enabled_default: 'false',
    },
  };

  return NextResponse.json(matchZyConfig);
}