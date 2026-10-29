const ADMIN_WHITELIST = ["76561199757155122", "76561199724566305"];

export interface SteamTrustResult {
  allowed: boolean;
  reason?: string;
  vacBanned?: boolean;
  privacyState?: string;
}

export async function verifySteamTrustGate(steamId64: string): Promise<SteamTrustResult> {
  const cleanId = String(steamId64).trim();

  // Permitir siempre bots de prueba y cuentas de Administrador
  if (cleanId.startsWith("bot_") || ADMIN_WHITELIST.includes(cleanId)) {
    return { allowed: true };
  }

  try {
    const res = await fetch(`https://steamcommunity.com/profiles/${cleanId}/?xml=1`, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AimVeSportsTrustGate/1.0",
        Accept: "application/xml,text/xml,*/*",
      },
    });

    if (!res.ok) {
      return { allowed: true };
    }

    const xml = await res.text();

    const vacMatch = xml.match(/<vacBanned>(\d+)<\/vacBanned>/);
    if (vacMatch && vacMatch[1] === "1") {
      return {
        allowed: false,
        vacBanned: true,
        reason: "Steam Trust Gate: Tu cuenta posee un bloqueo VAC registrado en Steam y no puede competir en AimVe Sports.",
      };
    }

    const privacyMatch = xml.match(/<privacyState>(.*?)<\/privacyState>/);
    const privacyState = privacyMatch ? privacyMatch[1].trim() : "public";
    if (privacyState !== "public") {
      return {
        allowed: false,
        privacyState,
        reason: "Steam Trust Gate: Debes configurar tu perfil de Steam como PUBLICO para verificar tu integridad antes de buscar partida.",
      };
    }

    return { allowed: true, vacBanned: false, privacyState };
  } catch {
    // Si la comunidad de Steam no responde temporalmente, no bloquear la cola
    return { allowed: true };
  }
}