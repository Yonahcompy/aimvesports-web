import { broadcastMatchFoundToWarmupServers } from "@/lib/rconBridge";
import { verifySteamTrustGate } from "@/lib/steamTrust";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyRequestIdentity } from "@/lib/session";

export async function GET() {
  try {
    const { data: initialQueue, error } = await supabase
      .from("matchmaking_queue")
      .select("*")
      .order("joined_at", { ascending: true });

    if (error) throw error;

    // Si hay 10 o mas jugadores esperando en cola, verificar si la ventana de ELO ya se expandio
    if (initialQueue && initialQueue.length >= 10) {
      const { data: rpcResult } = await supabase.rpc("try_matchmake_atomic");
      if (rpcResult?.status === "matched" && rpcResult?.match) {
      const mObj = rpcResult.match;
      const allNicks = [
        ...(mObj.team_alpha || []).map((p: any) => p.nickname),
        ...(mObj.team_omega || []).map((p: any) => p.nickname),
      ];
      await broadcastMatchFoundToWarmupServers(allNicks).catch(() => {});
        const { data: postMatchQueue } = await supabase
          .from("matchmaking_queue")
          .select("*")
          .order("joined_at", { ascending: true });

        return NextResponse.json({
          status: "matched",
          match: rpcResult.match,
          window_delta: rpcResult.window_delta || 300,
          queue: postMatchQueue || [],
          count: (postMatchQueue || []).length,
        });
      }

      return NextResponse.json({
        status: rpcResult?.status || "expanding_window",
        window_delta: rpcResult?.window_delta || 300,
        next_expansion_in: rpcResult?.next_expansion_in ?? null,
        message: rpcResult?.message || null,
        queue: initialQueue,
        count: initialQueue.length,
      });
    }

    // Calcular ventana del jugador mas antiguo si hay menos de 10 en cola
    let currentDelta = 300;
    if (initialQueue && initialQueue.length > 0 && initialQueue[0].joined_at) {
      const waitSecs = Math.max(
        0,
        Math.floor((Date.now() - new Date(initialQueue[0].joined_at).getTime()) / 1000)
      );
      if (waitSecs >= 150) currentDelta = 5000;
      else if (waitSecs >= 90) currentDelta = 1200;
      else if (waitSecs >= 45) currentDelta = 600;
    }

    return NextResponse.json({
      status: "queued",
      window_delta: currentDelta,
      queue: initialQueue || [],
      count: (initialQueue || []).length,
    });
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

    if (!String(steamId).startsWith("bot_")) {
      const { data: existingPlayer } = await supabase
        .from("leaderboard_players")
        .select("id, steam_id, cooldown_until, is_banned, ban_reason")
        .or(`steam_id.eq.${steamId},nickname.eq.${nickname}`)
        .limit(1)
        .maybeSingle();

            if (existingPlayer?.is_banned) {
        return NextResponse.json(
          {
            error: `Cuenta Suspendida por Anti-Cheat: ${existingPlayer.ban_reason || "Infraccion competitiva"}.`,
          },
          { status: 403 }
        );
      }

      const trustCheck = await verifySteamTrustGate(String(steamId));
      if (!trustCheck.allowed) {
        return NextResponse.json(
          {
            error: trustCheck.reason || "No cumples los requisitos de Steam Trust Gate.",
          },
          { status: 403 }
        );
      }

      if (existingPlayer?.cooldown_until) {
        const cdTime = new Date(existingPlayer.cooldown_until).getTime();
        if (cdTime > Date.now()) {
          const secsLeft = Math.ceil((cdTime - Date.now()) / 1000);
          return NextResponse.json(
            {
              error: `Penalizacion por no aceptar partida (Queue Dodge): Podras volver a buscar en ${secsLeft}s.`,
              cooldown_seconds: secsLeft,
            },
            { status: 429 }
          );
        }
      }

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

    const { error: upsertErr } = await supabase
      .from("matchmaking_queue")
      .upsert(
        [{ steam_id: String(steamId), nickname, elo, country }],
        { onConflict: "steam_id" }
      );

    if (upsertErr) throw upsertErr;

    const { data: rpcResult, error: rpcErr } = await supabase.rpc("try_matchmake_atomic");
    if (rpcErr) throw rpcErr;

    const { data: queueList } = await supabase
      .from("matchmaking_queue")
      .select("*")
      .order("joined_at", { ascending: true });

    if (rpcResult?.status === "matched" && rpcResult?.match) {
      const mObj = rpcResult.match;
      const allNicks = [
        ...(mObj.team_alpha || []).map((p: any) => p.nickname),
        ...(mObj.team_omega || []).map((p: any) => p.nickname),
      ];
      await broadcastMatchFoundToWarmupServers(allNicks).catch(() => {});
      return NextResponse.json({
        status: "matched",
        match: rpcResult.match,
        window_delta: rpcResult.window_delta || 300,
        queue: queueList || [],
        count: (queueList || []).length,
      });
    }

    return NextResponse.json({
      status: rpcResult?.status || "queued",
      window_delta: rpcResult?.window_delta || 300,
      next_expansion_in: rpcResult?.next_expansion_in ?? null,
      message: rpcResult?.message || null,
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