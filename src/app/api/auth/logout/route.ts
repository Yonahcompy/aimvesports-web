import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  attachSessionCookie,
  readVerifiedSteamIdsFromRequest,
} from "@/lib/session";
import { supabase } from "@/lib/supabase";

export async function PUT(request: Request) {
  try {
    const existingIds = readVerifiedSteamIdsFromRequest(request);
    const body = await request.json();
    const claimedId = body?.steam_id ? String(body.steam_id).trim() : null;

    if (!claimedId || !/^\d{17}$/.test(claimedId)) {
      return NextResponse.json({ error: "SteamID64 invalido" }, { status: 400 });
    }

    // Si ya tiene cookies firmadas, solo permitir refrescar una que ya le pertenezca
    if (existingIds.length > 0 && !existingIds.includes(claimedId)) {
      return NextResponse.json(
        { error: "Debes iniciar sesion a traves de Steam OpenID para agregar otra cuenta." },
        { status: 403 }
      );
    }

    // Verificar que el jugador exista previamente en leaderboard_players
    const { data: exists } = await supabase
      .from("leaderboard_players")
      .select("steam_id")
      .eq("steam_id", claimedId)
      .maybeSingle();

    if (!exists) {
      return NextResponse.json({ error: "Sesion requiere autenticacion OpenID" }, { status: 401 });
    }

    return attachSessionCookie(
      NextResponse.json({ ok: true, steam_id: claimedId }),
      claimedId,
      existingIds
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}