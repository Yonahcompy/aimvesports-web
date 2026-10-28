import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyRequestIdentity } from "@/lib/session";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("matchmaking_queue")
      .select("*")
      .order("joined_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ queue: data || [], count: (data || []).length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const leaveSteamId = url.searchParams.get("leave_steam_id");
    if (leaveSteamId) {
      const { steamId, error: authErr } = verifyRequestIdentity(request, leaveSteamId);
      if (authErr || !steamId) {
        return NextResponse.json({ error: authErr || "No autorizado" }, { status: 403 });
      }
      await supabase.from("matchmaking_queue").delete().eq("steam_id", steamId);
      return NextResponse.json({ ok: true, left: true });
    }

    const body = await request.json();
    const { steamId, error: authErr } = verifyRequestIdentity(request, body.steam_id);
    if (authErr || !steamId) {
      return NextResponse.json({ error: authErr || "Sesion invalida" }, { status: 403 });
    }

    const nickname = body.nickname || "Jugador";
    const elo = Number(body.elo) || 0;
    const country = body.country || "VE";

    // Auto-registrar jugador real en leaderboard_players si es su primera vez
    if (!String(steamId).startsWith("bot_")) {
      const { data: existingPlayer } = await supabase
        .from("leaderboard_players")
        .select("id, steam_id")
        .or(`steam_id.eq.${steamId},nickname.eq.${nickname}`)
        .limit(1)
        .maybeSingle();

      if (!existingPlayer) {
        await supabase.from("leaderboard_players").insert([
          {
            steam_id: String(steamId),
            nickname,
            country,
            elo: 0,
            wins: 0,
            losses: 0,
          },
        ]);
      } else if (!existingPlayer.steam_id) {
        await supabase
          .from("leaderboard_players")
          .update({ steam_id: String(steamId) })
          .eq("id", existingPlayer.id);
      }
    }

    // 1. Insertar o actualizar jugador en la cola
    const { error: upsertErr } = await supabase
      .from("matchmaking_queue")
      .upsert(
        [{ steam_id: String(steamId), nickname, elo, country }],
        { onConflict: "steam_id" }
      );

    if (upsertErr) throw upsertErr;

    // 2. Ejecutar emparejamiento atomico en PostgreSQL (FOR UPDATE SKIP LOCKED)
    const { data: rpcResult, error: rpcErr } = await supabase.rpc("try_matchmake_atomic");
    if (rpcErr) throw rpcErr;

    const { data: queueList } = await supabase
      .from("matchmaking_queue")
      .select("*")
      .order("joined_at", { ascending: true });

    if (rpcResult?.status === "matched" && rpcResult?.match) {
      return NextResponse.json({
        status: "matched",
        match: rpcResult.match,
        queue: queueList || [],
        count: (queueList || []).length,
      });
    }

    if (rpcResult?.status === "waiting_server") {
      return NextResponse.json({
        status: "waiting_server",
        message: rpcResult.message,
        queue: queueList || [],
        count: (queueList || []).length,
      });
    }

    return NextResponse.json({
      status: "queued",
      queue: queueList || [],
      count: (queueList || []).length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedId = searchParams.get("steam_id");
    const { steamId, error: authErr } = verifyRequestIdentity(request, requestedId);

    if (authErr) {
      return NextResponse.json({ error: authErr }, { status: 403 });
    }

    if (steamId) {
      await supabase.from("matchmaking_queue").delete().eq("steam_id", String(steamId));
    }

    const { data: updatedQueue } = await supabase
      .from("matchmaking_queue")
      .select("*")
      .order("joined_at", { ascending: true });

    return NextResponse.json({
      ok: true,
      queue: updatedQueue || [],
      count: (updatedQueue || []).length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}