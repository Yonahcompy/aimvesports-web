import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("matchmaking_queue")
      .select("*")
      .order("joined_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ queue: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const leaveSteamId = url.searchParams.get("leave_steam_id");
    if (leaveSteamId) {
      await supabase.from("matchmaking_queue").delete().eq("steam_id", leaveSteamId);
      return NextResponse.json({ ok: true, left: true });
    }

    const body = await request.json();
    const { steam_id, nickname, elo, country } = body;

    if (!steam_id || !nickname) {
      return NextResponse.json({ error: "Faltan datos del jugador" }, { status: 400 });
    }

    // Auto-registrar jugador real en leaderboard_players si es nuevo
    if (!String(steam_id).startsWith("bot_")) {
      const { data: existingPlayer } = await supabase
        .from("leaderboard_players")
        .select("id, steam_id")
        .or(`steam_id.eq.${steam_id},nickname.eq.${nickname}`)
        .limit(1)
        .maybeSingle();

      if (!existingPlayer) {
        await supabase.from("leaderboard_players").insert([{
          steam_id: String(steam_id),
          nickname: nickname || "Jugador",
          country: country || "VE",
          elo: 0,
          wins: 0,
          losses: 0
        }]);
      } else if (!existingPlayer.steam_id) {
        await supabase.from("leaderboard_players").update({ steam_id: String(steam_id) }).eq("id", existingPlayer.id);
      }
    }

    // 1. Insertar o actualizar jugador en la cola
    const { error: upsertErr } = await supabase
      .from("matchmaking_queue")
      .upsert(
        [{ steam_id: String(steam_id), nickname, elo: Number(elo) || 0, country: country || "VE" }],
        { onConflict: "steam_id" }
      );

    if (upsertErr) throw upsertErr;

    // 2. Consultar si ya hay 10 jugadores esperando
    const { data: queueList, error: qErr } = await supabase
      .from("matchmaking_queue")
      .select("*")
      .order("joined_at", { ascending: true });

    if (qErr) throw qErr;

    if (queueList && queueList.length >= 10) {
      // A. Verificar y reservar atomicamente un servidor Premier 5v5 libre en Miami
      const { data: candidateServer } = await supabase
        .from("game_servers")
        .select("*")
        .eq("server_type", "premier_5v5")
        .eq("status", "free")
        .order("port", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!candidateServer) {
        // Si todos los puertos estan ocupados, mantener en cola esperando el primer servidor libre
        return NextResponse.json({
          status: "waiting_server",
          message: "Todos los servidores de Miami estan en partida activa. Entraras apenas se libere un puerto.",
          queue: queueList
        });
      }

      const { data: lockedServer } = await supabase
        .from("game_servers")
        .update({ status: "busy" })
        .eq("id", candidateServer.id)
        .eq("status", "free")
        .select()
        .maybeSingle();

      if (!lockedServer) {
        return NextResponse.json({ status: "queued", queue: queueList });
      }

      // B. Extraer atomicamente a los primeros 10 jugadores de la cola (evita partidas duplicadas)
      const selectedTen = queueList.slice(0, 10);
      const idsToRemove = selectedTen.map((p: any) => String(p.steam_id));

      const { data: poppedPlayers, error: delErr } = await supabase
        .from("matchmaking_queue")
        .delete()
        .in("steam_id", idsToRemove)
        .select();

      if (delErr || !poppedPlayers || poppedPlayers.length < 10) {
        // Si otra peticion simultanea ya tomo a estos jugadores, liberar el servidor y salir
        await supabase.from("game_servers").update({ status: "free", current_match_id: null }).eq("id", lockedServer.id);
        return NextResponse.json({ status: "queued", queue: queueList });
      }

      // C. Ordenar por ELO (Mayor a Menor) y armar Snake Draft (1-4-5-8-9 vs 2-3-6-7-10)
      const sorted = [...poppedPlayers].sort((a: any, b: any) => (Number(b.elo) || 0) - (Number(a.elo) || 0));
      const alphaIndices = [0, 3, 4, 7, 8];
      const omegaIndices = [1, 2, 5, 6, 9];

      const team_alpha = alphaIndices.map((i) => sorted[i]);
      const team_omega = omegaIndices.map((i) => sorted[i]);

      const captain_alpha_steam_id = String(team_alpha[0].steam_id);
      const captain_omega_steam_id = String(team_omega[0].steam_id);

      const expirationTime = new Date(Date.now() + 21000).toISOString();
      const autoAcceptedBots = [...team_alpha, ...team_omega]
        .map((p: any) => String(p.steam_id))
        .filter((id: string) => id.startsWith("bot_"));

      const assignedConnect = `connect ${lockedServer.ip}:${lockedServer.port}`;
      const initialChat = [
        {
          id: Date.now(),
          sender: "SISTEMA",
          text: `Sala Premier #${lockedServer.port} asignada en Miami. Confirmen asistencia para iniciar el Veto.`,
          time: "Ahora",
          isSystem: true
        }
      ];

      const { data: matchData, error: matchErr } = await supabase
        .from("active_matches")
        .insert([{
          team_alpha,
          team_omega,
          captain_alpha_steam_id,
          captain_omega_steam_id,
          status: "ready_check",
          banned_maps: [],
          accepted_players: autoAcceptedBots,
          turn_expires_at: expirationTime,
          server_connect: assignedConnect,
          chat_messages: initialChat
        }])
        .select()
        .single();

      if (matchErr || !matchData) {
        await supabase.from("game_servers").update({ status: "free", current_match_id: null }).eq("id", lockedServer.id);
        throw matchErr;
      }

      await supabase
        .from("game_servers")
        .update({ status: "busy", current_match_id: matchData.id })
        .eq("id", lockedServer.id);

      return NextResponse.json({ status: "matched", match: matchData });
    }

    return NextResponse.json({ status: "queued", queue: queueList });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const steam_id = searchParams.get("steam_id");
    if (steam_id) {
      await supabase.from("matchmaking_queue").delete().eq("steam_id", steam_id);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}