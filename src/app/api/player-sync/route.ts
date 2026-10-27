import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

async function fetchRealSteamPersonaName(steamId64: string): Promise<string | null> {
  try {
    const res = await fetch(`https://steamcommunity.com/profiles/${steamId64}/?xml=1`, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/xml,text/xml,*/*',
      },
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
    const finalNick = realSteamName || `Steam_${steam_id.slice(-4)}`;

    // 2. Verificar si ya existe el jugador en Supabase
    const { data: existingRows } = await supabase
      .from('leaderboard_players')
      .select('*')
      .eq('steam_id', steam_id)
      .order('id', { ascending: true })
      .limit(1);

    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    if (existing) {
      if (realSteamName && existing.nickname !== realSteamName) {
        const { data: updated } = await supabase
          .from('leaderboard_players')
          .update({ nickname: realSteamName })
          .eq('id', existing.id)
          .select()
          .single();

        return NextResponse.json({
          player: updated || { ...existing, nickname: realSteamName },
          created: false,
          syncedName: realSteamName,
        });
      }
      return NextResponse.json({ player: existing, created: false });
    }

    // 3. Si es un jugador nuevo, crearlo en Supabase en estado CALIBRANDO (0/6) con 25 ELO
    const newPlayerPayload = {
      nickname: finalNick,
      steam_id: steam_id,
      elo: 0,
      wins: 0,
      losses: 0,
      country: country || 'VE',
      season_prize: 'En Calibracion (0/6)',
    };

    const { data: createdPlayer, error } = await supabase
      .from('leaderboard_players')
      .insert([newPlayerPayload])
      .select()
      .single();

    if (error || !createdPlayer) {
      // Fallback en memoria para que el frontend siempre muestre la cuenta real conectada
      return NextResponse.json({
        player: { id: Date.now(), ...newPlayerPayload },
        created: false,
        rlsWarning: error?.message || null,
      });
    }

    return NextResponse.json({ player: createdPlayer, created: true, syncedName: finalNick });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}