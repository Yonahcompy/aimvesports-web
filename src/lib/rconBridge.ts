import net from "net";
import crypto from "crypto";

const SERVERDATA_AUTH = 3;
const SERVERDATA_EXECCOMMAND = 2;

function getConfigSecret(): string {
  return (
    process.env.MATCHZY_WEBHOOK_SECRET ||
    process.env.SESSION_SECRET ||
    "aimve_matchzy_secret_2026"
  );
}

export function signMatchConfigToken(matchId: number | string): string {
  return crypto
    .createHmac("sha256", getConfigSecret())
    .update(`match_cfg_${String(matchId)}`)
    .digest("hex")
    .slice(0, 24);
}

export function verifyMatchConfigToken(
  matchId: number | string,
  token?: string | null
): boolean {
  if (!token) return false;
  const expected = signMatchConfigToken(matchId);
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

function createRconPacket(id: number, type: number, body: string): Buffer {
  const bodyBuf = Buffer.from(body, "utf8");
  const size = 4 + 4 + bodyBuf.length + 2;
  const buf = Buffer.alloc(4 + size);
  buf.writeInt32LE(size, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  bodyBuf.copy(buf, 12);
  buf.writeInt16LE(0, 12 + bodyBuf.length);
  return buf;
}

export function sendSourceRconCommand(
  host: string,
  port: number,
  password: string,
  command: string,
  timeoutMs: number = 1200
): Promise<{ ok: boolean; response?: string }> {
  return new Promise((resolve) => {
    if (!host || !password) {
      return resolve({ ok: false });
    }

    const socket = new net.Socket();
    let settled = false;
    let authed = false;

    const finish = (ok: boolean, response?: string) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {}
      resolve({ ok, response });
    };

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      socket.write(createRconPacket(1, SERVERDATA_AUTH, password));
    });

    socket.on("data", (data) => {
      if (!authed) {
        const respId = data.length >= 8 ? data.readInt32LE(4) : -1;
        if (respId === -1) {
          return finish(false, "RCON Auth Failed");
        }
        authed = true;
        socket.write(createRconPacket(2, SERVERDATA_EXECCOMMAND, command));
        setTimeout(() => finish(true, "Command Dispatched"), 150);
      }
    });

    socket.on("timeout", () => finish(false, "RCON Timeout"));
    socket.on("error", () => finish(false, "RCON Unreachable"));
  });
}

export async function broadcastMatchFoundToWarmupServers(playerNicknames: string[]) {
  const rconPassword = process.env.CS2_RCON_PASSWORD || "";
  const warmupHost = process.env.CS2_SERVER_HOST || "miami1.aimvesports.com";
  if (!rconPassword) return;

  const namesText = playerNicknames.slice(0, 5).join(", ");
  const cmd = `say [AIMVE PREMIER] ¡PARTIDA 5v5 ENCONTRADA (${namesText}...)! Haz ALT+TAB y ACEPTA en la web (20s).`;

  const warmupPorts = [27015, 27016, 27017, 27018];
  await Promise.allSettled(
    warmupPorts.map((port) =>
      sendSourceRconCommand(warmupHost, port, rconPassword, cmd, 900)
    )
  );
}

export async function autoLoadMatchZyOnServer(serverConnect: string, matchId: number) {
  const rconPassword = process.env.CS2_RCON_PASSWORD || "";
  if (!rconPassword) return;

  const clean = (serverConnect || "miami1.aimvesports.com:27025")
    .replace("connect ", "")
    .trim();
  const [hostPart, portPart] = clean.split(":");
  const host = hostPart || process.env.CS2_SERVER_HOST || "miami1.aimvesports.com";
  const port = Number(portPart) || 27025;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.aimvesports.com";
  const sig = signMatchConfigToken(matchId);
  const configUrl = `${siteUrl}/api/match-config?match_id=${matchId}&sig=${sig}`;
  const rconCmd = `matchzy_load_match_url "${configUrl}"`;

  await sendSourceRconCommand(host, port, rconPassword, rconCmd, 1200);
}