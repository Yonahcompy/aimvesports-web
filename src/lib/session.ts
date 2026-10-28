import crypto from "crypto";
import { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "aimve_session";

function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "aimve_hmac_secret_key_2026_shopysof";
}

export function signSteamSession(steamId: string): string {
  const cleanId = String(steamId).trim();
  const sig = crypto.createHmac("sha256", getSecret()).update(cleanId).digest("hex");
  return `${cleanId}.${sig}`;
}

export function verifySteamSession(token: string | undefined | null): string | null {
  if (!token || !token.includes(".")) return null;
  const [steamId, sig] = token.split(".");
  if (!steamId || !sig) return null;
  const expectedSig = crypto.createHmac("sha256", getSecret()).update(steamId).digest("hex");
  if (sig.length !== expectedSig.length) return null;
  const valid = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  return valid ? steamId : null;
}

export function readVerifiedSteamIdsFromRequest(request: Request): string[] {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) return [];
  const rawVal = decodeURIComponent(match.substring(SESSION_COOKIE_NAME.length + 1));
  const parts = rawVal.split("|");
  const verified: string[] = [];
  for (const part of parts) {
    const id = verifySteamSession(part);
    if (id && !verified.includes(id)) verified.push(id);
  }
  return verified;
}

export function readSessionCookieFromRequest(request: Request): string | null {
  const list = readVerifiedSteamIdsFromRequest(request);
  return list[0] || null;
}

export function verifyRequestIdentity(
  request: Request,
  claimedSteamId?: string | null
): { steamId: string | null; error?: string } {
  const claimed = claimedSteamId ? String(claimedSteamId).trim() : null;

  // Permitir bots de prueba (bot_1 .. bot_9)
  if (claimed && claimed.startsWith("bot_")) {
    return { steamId: claimed };
  }

  const verifiedIds = readVerifiedSteamIdsFromRequest(request);

  if (verifiedIds.length > 0) {
    if (claimed) {
      if (verifiedIds.includes(claimed)) {
        return { steamId: claimed };
      }
      return {
        steamId: null,
        error: "Alerta de Seguridad: Intento de suplantacion de SteamID bloqueado (Spoofing F12).",
      };
    }
    return { steamId: verifiedIds[0] };
  }

  return { steamId: claimed };
}

export function attachSessionCookie(
  response: NextResponse,
  steamId: string,
  existingIds: string[] = []
): NextResponse {
  const allIds = Array.from(new Set([...existingIds, String(steamId).trim()])).slice(-4);
  const signedList = allIds.map((id) => signSteamSession(id)).join("|");
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: signedList,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}