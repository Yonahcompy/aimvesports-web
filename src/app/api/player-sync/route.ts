import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

async function fetchRealSteamPersonaName(steamId64: string): Promise<string | null> {
  try {
    const res = await fetch(`https://steamcommunity.com/profiles/${steamId64}/?xml=1`, {
      cache: 'no-store',
    });
    const xml = await res.text();
    const matchCdata = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/);
    if (matchCdata && matchCdata[1]) {
      return matchCdata[1].trim();
    }
    const matchPlain = xml.match(/<steamID>(.*?)<\/steamID>/);
    if (matchPlain && matchPlain[1]) {
      return matchPlain[1].trim();
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { steam_id, country } = await request.json();

    if (!steam_id) {
      return NextResponse.json({ error: 'Falta steam_id' }, { status: 400 });
    }

    // 1. Obtener el nombre real actual desde el perfil publico de Valve / Steam
    const realSteamName = await fetchRealSteamPersonaName(steam_id);

    // 2. Verificar si ya existe el jugador en Supabase
    const { data: existing } = await supabase
      .from('leaderboard_players')
      .select('*')
      .eq('steam_id', steam_id)
      .maybeSingle();

    if (existing) {
      // Si el nombre en Steam cambio o era distinto, actualizarlo automaticamente en Supabase
      if (realSteamName && existing.nickname !== realSteamName) {
        const { data: updated } = await supabase
          .from('leaderboard_players')
          .update({ nickname: realSteamName })
          .eq('id', existing.id)
          .select()
          .single();

        return NextResponse.json({ player: updated || existing, created: false, syncedName: realSteamName });
      }
      return NextResponse.json({ player: existing, created: false });
    }

    // 3. Si es un jugador nuevo, crearlo con su nombre oficial de Steam en estado CALIBRANDO (0/6)
    const finalNick = realSteamName || `Player_${steam_id.slice(-4)}`;
    const { data: createdPlayer, error } = await supabase
      .from('leaderboard_players')
      .insert([
        {
          nickname: finalNick,
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

    return NextResponse.json({ player: createdPlayer, created: true, syncedName: finalNick });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}