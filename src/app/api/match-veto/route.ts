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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { match_id, steam_id, map_id, action, is_timeout } = body;

    if (!match_id) {
      return NextResponse.json({ error: "Falta match_id" }, { status: 400 });
    }

    const { data: match, error: fetchErr } = await supabase
      .from("active_matches")
      .select("*")
      .eq("id", match_id)
      .single();

    if (fetchErr || !match) {
      return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
    }

    // A1) Bloquear partida mientras se guarda el marcador (evita duplicados)
    if (action === "lock_finish") {
      if (match.status === "finished" || match.status === "finishing") {
        return NextResponse.json({ ok: false, already_finished: true });
      }
      const { data: lockedMatch, error: lockErr } = await supabase
        .from("active_matches")
        .update({ status: "finishing", turn_expires_at: null })
        .eq("id", match.id)
        .eq("status", "live")
        .select()
        .single();

      if (lockErr || !lockedMatch) {
        return NextResponse.json({ ok: false, already_finished: true });
      }
      return NextResponse.json({ ok: true, match: lockedMatch });
    }

    // A2) Confirmar cierre definitivo una vez que el marcador ya fue insertado en 'matches'
    if (action === "finish") {
      const { data: finishedMatch, error: finErr } = await supabase
        .from("active_matches")
        .update({ status: "finished", turn_expires_at: null })
        .eq("id", match.id)
        .select()
        .single();

      if (finErr) throw finErr;
      return NextResponse.json({ ok: true, match: finishedMatch });
    }

    // B) Reiniciar el Veto desde el servidor
    if (action === "reset") {
      const nextExpiration = new Date(Date.now() + 16000).toISOString();
      const { data: resetMatch, error: rstErr } = await supabase
        .from("active_matches")
        .update({
          banned_maps: [],
          status: "veto",
          turn_expires_at: nextExpiration
        })
        .eq("id", match.id)
        .select()
        .single();

      if (rstErr) throw rstErr;
      return NextResponse.json({ ok: true, match: resetMatch });
    }

    if (match.status !== "veto") {
      return NextResponse.json({ error: "El veto ya no está activo" }, { status: 400 });
    }

    const bannedMaps: string[] = match.banned_maps || [];

    // C) Auto-Veto por Timeout (Funciona aunque el capitan en turno no tenga luz/internet)
    if (is_timeout) {
      const exp = match.turn_expires_at ? new Date(match.turn_expires_at).getTime() : 0;
      if (Date.now() < exp - 500) {
        return NextResponse.json({ ok: false, reason: "El turno aun no ha expirado en el servidor" });
      }

      const available = ALL_MAPS.filter((m) => !bannedMaps.includes(m));
      if (available.length <= 1) {
        return NextResponse.json({ ok: false, reason: "Ya existe un mapa definitivo" });
      }

      const randomMap = available[Math.floor(Math.random() * available.length)];
      const newBans = [...bannedMaps, randomMap];
      const newStatus = newBans.length >= 6 ? "live" : "veto";
      const nextExpiration = newStatus === "live" ? null : new Date(Date.now() + 16000).toISOString();

      const { data: updatedMatch, error: updErr } = await supabase
        .from("active_matches")
        .update({
          banned_maps: newBans,
          turn_expires_at: nextExpiration,
          status: newStatus
        })
        .eq("id", match.id)
        .select()
        .single();

      if (updErr) throw updErr;
      return NextResponse.json({ ok: true, auto_banned: randomMap, match: updatedMatch });
    }

    // D) Veto Manual del Capitan en Turno
    if (!map_id || !steam_id) {
      return NextResponse.json({ error: "Faltan datos para vetar" }, { status: 400 });
    }

    if (bannedMaps.includes(map_id)) {
      return NextResponse.json({ error: "Mapa ya vetado" }, { status: 400 });
    }

    const isAlphaTurn = bannedMaps.length % 2 === 0;
    const currentCaptain = isAlphaTurn ? match.captain_alpha_steam_id : match.captain_omega_steam_id;

    if (String(steam_id) !== String(currentCaptain)) {
      return NextResponse.json({ error: "No es tu turno o no eres el capitan" }, { status: 403 });
    }

    const newBans = [...bannedMaps, map_id];
    const newStatus = newBans.length >= 6 ? "live" : "veto";
    const nextExpiration = newStatus === "live" ? null : new Date(Date.now() + 16000).toISOString();

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