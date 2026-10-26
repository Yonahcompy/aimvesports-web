import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { steam_id, nickname, country } = await request.json();

    if (!steam_id) {
      return NextResponse.json({ error: 'Falta steam_id' }, { status: 400 });
    }

    // 1. Verificar si ya existe un jugador con ese SteamID64
    const { data: existing } = await supabase
      .from('leaderboard_players')
      .select('*')
      .eq('steam_id', steam_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ player: existing, created: false });
    }

    // 2. Si es un jugador nuevo, crearlo en estado CALIBRANDO (0/6 partidas, 25 ELO base)
    const defaultNick = nickname || `Player_${steam_id.slice(-4)}`;
    const { data: createdPlayer, error } = await supabase
      .from('leaderboard_players')
      .insert([
        {
          nickname: defaultNick,
          steam_id: steam_id,
          elo: 25,
          wins: 0,
          losses: 0,
          country: country || 'VE',
          season_prize: 'En Calibracion (0/6)',
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ player: createdPlayer, created: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}