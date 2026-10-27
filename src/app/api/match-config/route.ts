import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const map = searchParams.get('map') || 'de_mirage';
  const matchId = searchParams.get('id') || '1001';
  const fallbackSteamId = searchParams.get('steam_id') || '76561199724566305';
  const fallbackNick = searchParams.get('nick') || 'YonathanDHC';

  const { data: queuedPlayers } = await supabase
    .from('matchmaking_queue')
    .select('*')
    .order('joined_at', { ascending: true })
    .limit(10);

  const team1Players: Record<string, string> = {};
  const team2Players: Record<string, string> = {};

  if (queuedPlayers && queuedPlayers.length > 0) {
    queuedPlayers.slice(0, 5).forEach((p) => {
      if (p.steam_id) team1Players[p.steam_id] = p.nickname;
    });
    queuedPlayers.slice(5, 10).forEach((p) => {
      if (p.steam_id) team2Players[p.steam_id] = p.nickname;
    });
  } else {
    team1Players[fallbackSteamId] = fallbackNick;
  }

  const captainAlpha =
    queuedPlayers && queuedPlayers[0] ? queuedPlayers[0].nickname : fallbackNick;
  const captainOmega =
    queuedPlayers && queuedPlayers[5] ? queuedPlayers[5].nickname : 'Viper_CCS';

  const matchZyConfig = {
    matchid: Number(matchId),
    num_maps: 1,
    maplist: [map],
    skip_veto: true,
    side_type: 'standard',
    players_per_team: 5,
    min_players_to_ready: 1,
    team1: {
      name: `Equipo ${captainAlpha}`,
      tag: 'ALPHA',
      flag: 'VE',
      players: team1Players,
    },
    team2: {
      name: `Equipo ${captainOmega}`,
      tag: 'OMEGA',
      flag: 'VE',
      players: team2Players,
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