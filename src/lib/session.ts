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

export function readSessionCookieFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) return null;
  const rawVal = decodeURIComponent(match.substring(SESSION_COOKIE_NAME.length + 1));
  return verifySteamSession(rawVal);
}

export function verifyRequestIdentity(
  request: Request,
  claimedSteamId?: string | null
): { steamId: string | null; error?: string } {
  const claimed = claimedSteamId ? String(claimedSteamId).trim() : null;

  // Permitir inyeccion de bots de prueba (bot_1 .. bot_9)
  if (claimed && claimed.startsWith("bot_")) {
    return { steamId: claimed };
  }

  const cookieSteamId = readSessionCookieFromRequest(request);

  // Si existe cookie criptografica, exigir que coincida con el steam_id reclamado (Anti-Spoofing F12)
  if (cookieSteamId) {
    if (claimed && claimed !== cookieSteamId) {
      return {
        steamId: null,
        error: "Alerta de Seguridad: Intento de suplantacion de SteamID bloqueado (Spoofing detectado).",
      };
    }
    return { steamId: cookieSteamId };
  }

  // Fallback transicional mientras la pestaña sincroniza su cookie en /api/player-sync
  return { steamId: claimed };
}

export function attachSessionCookie(response: NextResponse, steamId: string): NextResponse {
  const signed = signSteamSession(steamId);
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: signed,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });
  return response;
}