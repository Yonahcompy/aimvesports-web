import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  attachSessionCookie,
  readVerifiedSteamIdsFromRequest,
} from "@/lib/session";

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const claimedId = body?.steam_id ? String(body.steam_id).trim() : null;
    if (!claimedId) {
      return NextResponse.json({ error: "Falta steam_id" }, { status: 400 });
    }
    const existingIds = readVerifiedSteamIdsFromRequest(request);
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