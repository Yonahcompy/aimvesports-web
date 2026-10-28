import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const secretHeader = request.headers.get("x-aimve-secret");
  const expectedSecret = process.env.MATCHZY_WEBHOOK_SECRET || "aimve_matchzy_secret_2026";

  if (authHeader !== "Bearer AimVe_Server_Miami_1" && secretHeader !== expectedSecret) {
    return NextResponse.json(
      { error: "Acceso denegado: Se requiere firma del servidor dedicado de Miami." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    deprecated: true,
    message: "Utilizar /api/matchzy-webhook para cierres idempotentes oficiales.",
  });
}

export async function GET() {
  return NextResponse.json({
    status: "protected",
    endpoint: "AimVe Legacy Webhook Redirected to /api/matchzy-webhook",
  });
}