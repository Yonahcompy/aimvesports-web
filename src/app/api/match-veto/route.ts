import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { match_id, steam_id, map_id } = await request.json();

    if (!match_id || !steam_id || !map_id) {
      return NextResponse.json({ error: "Faltan datos requeridos" }, { status: 400 });
    }

    // 1. Leer el estado de la partida desde la base de datos (La Fuente de la Verdad)
    const { data: match, error: fetchErr } = await supabase
      .from("active_matches")
      .select("*")
      .eq("id", match_id)
      .single();

    if (fetchErr || !match) return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
    if (match.status !== "veto") return NextResponse.json({ error: "El veto ya no está activo" }, { status: 400 });

    const bannedMaps = match.banned_maps || [];
    if (bannedMaps.includes(map_id)) return NextResponse.json({ error: "Mapa ya vetado" }, { status: 400 });

    // 2. Determinar el turno matematicamente (Pares = Alpha, Impares = Omega)
    const isAlphaTurn = bannedMaps.length % 2 === 0;
    const currentCaptain = isAlphaTurn ? match.captain_alpha_steam_id : match.captain_omega_steam_id;

    if (String(steam_id) !== String(currentCaptain)) {
      return NextResponse.json({ error: "No es tu turno o no eres el capitan" }, { status: 403 });
    }

    // 3. Ejecutar baneo, cambiar a 'live' si es el ultimo mapa, o sumar 15s al Reloj Maestro
    const newBans = [...bannedMaps, map_id];
    const newStatus = newBans.length >= 6 ? "live" : "veto";
    const nextExpiration = new Date(Date.now() + 16000).toISOString(); // 15s de turno + 1s extra de margen de red

    const { data: updatedMatch, error: updateErr } = await supabase
      .from("active_matches")
      .update({ 
        banned_maps: newBans,
        turn_expires_at: nextExpiration,
        status: newStatus
      })
      .eq("id", match.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json({ ok: true, match: updatedMatch });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}