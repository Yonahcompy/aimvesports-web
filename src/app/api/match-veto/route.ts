import { autoLoadMatchZyOnServer } from "@/lib/rconBridge";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyRequestIdentity } from "@/lib/session";

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { match_id, map_id, action, is_timeout } = body;

    const identityCheck = verifyRequestIdentity(request, body.steam_id);
    if (identityCheck.error) {
      return NextResponse.json({ error: identityCheck.error }, { status: 403 });
    }
    const steam_id = identityCheck.steamId;
    const isCallerAdmin = Boolean(steam_id && ADMIN_STEAM_IDS.includes(String(steam_id)));

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

    const isSenderAlpha =
      Array.isArray(match.team_alpha) &&
      match.team_alpha.some((p: any) => String(p?.steam_id) === String(steam_id));
    const isSenderOmega =
      Array.isArray(match.team_omega) &&
      match.team_omega.some((p: any) => String(p?.steam_id) === String(steam_id));
    const isParticipant = isSenderAlpha || isSenderOmega;

    // 0) Enviar mensaje en vivo al Chat Privado del Equipo
    if (action === "chat") {
      const { sender, text } = body;
      if (!text || !String(text).trim()) {
        return NextResponse.json({ error: "Mensaje vacio" }, { status: 400 });
      }
      if (!isParticipant && !isCallerAdmin) {
        return NextResponse.json({ error: "No perteneces a esta sala" }, { status: 403 });
      }

      const currentChat = Array.isArray(match.chat_messages) ? match.chat_messages : [];
      const resolvedTeam = isSenderOmega ? "omega" : "alpha";

      const newMsg = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        sender: sender || "Jugador",
        team: resolvedTeam,
        text: String(text).trim().slice(0, 180),
        time: new Date().toLocaleTimeString("es-VE", {
          timeZone: "America/Caracas",
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      const updatedChat = [...currentChat.slice(-29), newMsg];

      const { data: updatedMatch, error: chatErr } = await supabase
        .from("active_matches")
        .update({ chat_messages: updatedChat })
        .eq("id", match.id)
        .select()
        .single();

      if (chatErr) throw chatErr;
      return NextResponse.json({ ok: true, match: updatedMatch });
    }

    // 0A) Jugador presiona "ACEPTAR PARTIDA" durante el Ready Check
    if (action === "accept_match") {
      if (match.status !== "ready_check") {
        return NextResponse.json({ ok: false, reason: "La fase de confirmacion ya termino" });
      }
      if (!steam_id || (!isParticipant && !String(steam_id).startsWith("bot_"))) {
        return NextResponse.json({ error: "No perteneces a esta partida" }, { status: 403 });
      }

      const currentAccepted: string[] = Array.isArray(match.accepted_players)
        ? match.accepted_players.map(String)
        : [];
      const updatedAccepted = Array.from(new Set([...currentAccepted, String(steam_id)]));
      const allReady = updatedAccepted.length >= 10;

      const nextStatus = allReady ? "veto" : "ready_check";
      const nextExpiration = allReady
        ? new Date(Date.now() + 16000).toISOString()
        : match.turn_expires_at;

      const { data: updatedMatch, error: accErr } = await supabase
        .from("active_matches")
        .update({
          accepted_players: updatedAccepted,
          status: nextStatus,
          turn_expires_at: nextExpiration,
        })
        .eq("id", match.id)
        .select()
        .single();

      if (accErr) throw accErr;
      return NextResponse.json({ ok: true, match: updatedMatch });
    }

    // 0B) Se agotaron los 20s del Ready Check: Penalizar con 3 min (Queue Dodge) a los AFK y devolver activos a la cola
    if (action === "ready_timeout") {
      if (match.status !== "ready_check") {
        return NextResponse.json({ ok: false, reason: "No esta en ready_check" });
      }

      const exp = match.turn_expires_at ? new Date(match.turn_expires_at).getTime() : 0;
      if (Date.now() < exp - 500) {
        return NextResponse.json({ ok: false, reason: "Aun quedan segundos para aceptar" });
      }

      const { data: cancelledMatch, error: cancelErr } = await supabase
        .from("active_matches")
        .update({ status: "finished", turn_expires_at: null })
        .eq("id", match.id)
        .eq("status", "ready_check")
        .select()
        .single();

      if (cancelErr || !cancelledMatch) {
        return NextResponse.json({ ok: false, already_handled: true });
      }

      const acceptedSet = new Set((match.accepted_players || []).map(String));
      const allPlayers = [...(match.team_alpha || []), ...(match.team_omega || [])];

      // 1. Castigar con 3 minutos de Cooldown a los humanos que NO aceptaron (Queue Dodge)
      const dodgers = allPlayers.filter(
        (p: any) =>
          p?.steam_id &&
          !String(p.steam_id).startsWith("bot_") &&
          !acceptedSet.has(String(p.steam_id))
      );

      if (dodgers.length > 0) {
        const cooldownIso = new Date(Date.now() + 3 * 60 * 1000).toISOString();
        for (const d of dodgers) {
          await supabase
            .from("leaderboard_players")
            .update({ cooldown_until: cooldownIso })
            .eq("steam_id", String(d.steam_id));
        }
      }

      // 2. Devolver a la cola automaticamente a los jugadores reales que SI aceptaron
      const activePlayersToRequeue = allPlayers
        .filter(
          (p: any) =>
            acceptedSet.has(String(p.steam_id)) && !String(p.steam_id).startsWith("bot_")
        )
        .map((p: any) => ({
          steam_id: String(p.steam_id),
          nickname: p.nickname || "Jugador",
          elo: Number(p.elo) || 0,
          country: p.country || "VE",
        }));

      if (activePlayersToRequeue.length > 0) {
        await supabase
          .from("matchmaking_queue")
          .upsert(activePlayersToRequeue, { onConflict: "steam_id" });
      }

      // 3. Liberar el servidor de Miami
      await supabase
        .from("game_servers")
        .update({ status: "free", current_match_id: null })
        .eq("current_match_id", match.id);

      return NextResponse.json({
        ok: true,
        cancelled: true,
        requeued: activePlayersToRequeue.length,
        penalized_dodgers: dodgers.length,
      });
    }

    // Acciones exclusivas de Administrador (lock_finish, finish, reset)
    if (action === "lock_finish" || action === "finish" || action === "reset") {
      if (!isCallerAdmin) {
        return NextResponse.json(
          { error: "Acceso denegado: Accion exclusiva de Administrador" },
          { status: 403 }
        );
      }

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

      if (action === "finish") {
        const { data: finishedMatch, error: finErr } = await supabase
          .from("active_matches")
          .update({ status: "finished", turn_expires_at: null })
          .eq("id", match.id)
          .select()
          .single();

        if (finErr) throw finErr;
        await supabase
          .from("game_servers")
          .update({ status: "free", current_match_id: null })
          .eq("current_match_id", match.id);
        return NextResponse.json({ ok: true, match: finishedMatch });
      }

      if (action === "reset") {
        const nextExpiration = new Date(Date.now() + 16000).toISOString();
        const { data: resetMatch, error: rstErr } = await supabase
          .from("active_matches")
          .update({
            banned_maps: [],
            status: "veto",
            turn_expires_at: nextExpiration,
          })
          .eq("id", match.id)
          .select()
          .single();

        if (rstErr) throw rstErr;
        return NextResponse.json({ ok: true, match: resetMatch });
      }
    }

    if (match.status !== "veto") {
      return NextResponse.json({ error: "El veto ya no esta activo" }, { status: 400 });
    }

    const bannedMaps: string[] = match.banned_maps || [];

    // C) Auto-Veto por Timeout
    if (is_timeout) {
      const exp = match.turn_expires_at ? new Date(match.turn_expires_at).getTime() : 0;
      if (Date.now() < exp - 500) {
        return NextResponse.json({
          ok: false,
          reason: "El turno aun no ha expirado en el servidor",
        });
      }

      const available = ALL_MAPS.filter((m) => !bannedMaps.includes(m));
      if (available.length <= 1) {
        return NextResponse.json({ ok: false, reason: "Ya existe un mapa definitivo" });
      }

      const randomMap = available[Math.floor(Math.random() * available.length)];
      const newBans = [...bannedMaps, randomMap];
      const newStatus = newBans.length >= 6 ? "live" : "veto";
      const nextExpiration =
        newStatus === "live" ? null : new Date(Date.now() + 16000).toISOString();

      const { data: updatedMatch, error: updErr } = await supabase
        .from("active_matches")
        .update({
          banned_maps: newBans,
          turn_expires_at: nextExpiration,
          status: newStatus,
        })
        .eq("id", match.id)
        .select()
        .single();

      if (updErr) throw updErr; if (newStatus === "live") { autoLoadMatchZyOnServer(updatedMatch.server_connect, updatedMatch.id).catch(() => {}); }
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
    const currentCaptain = isAlphaTurn
      ? match.captain_alpha_steam_id
      : match.captain_omega_steam_id;

    if (String(steam_id) !== String(currentCaptain)) {
      return NextResponse.json(
        { error: "No es tu turno o no eres el capitan" },
        { status: 403 }
      );
    }

    const newBans = [...bannedMaps, map_id];
    const newStatus = newBans.length >= 6 ? "live" : "veto";
    const nextExpiration =
      newStatus === "live" ? null : new Date(Date.now() + 16000).toISOString();

    const { data: updatedMatch, error: updateErr } = await supabase
      .from("active_matches")
      .update({
        banned_maps: newBans,
        turn_expires_at: nextExpiration,
        status: newStatus,
      })
      .eq("id", match.id)
      .select()
      .single();

    if (updateErr) throw updateErr; if (newStatus === "live") { autoLoadMatchZyOnServer(updatedMatch.server_connect, updatedMatch.id).catch(() => {}); }

    return NextResponse.json({ ok: true, match: updatedMatch });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}