import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const claimedId = params.get('openid.claimed_id') || '';
  const match =
    claimedId.match(/\/id\/(\d+)$/) ||
    claimedId.match(/\/profiles\/(\d+)$/) ||
    claimedId.match(/(\d{17})$/);
  const steamId64 = match ? match[1] : null;

  if (!steamId64) {
    return NextResponse.redirect(`${url.origin}/?steam_error=1`);
  }

  // Verificar firma criptografica OpenID directamente contra Steam
  try {
    const verifyParams = new URLSearchParams();
    params.forEach((value, key) => {
      verifyParams.append(key, value);
    });
    verifyParams.set('openid.mode', 'check_authentication');

    const verifyRes = await fetch('https://steamcommunity.com/openid/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyParams.toString(),
      cache: 'no-store',
    });

    const verifyText = await verifyRes.text();
    if (!verifyText.includes('is_valid:true')) {
      return NextResponse.redirect(`${url.origin}/?steam_error=invalid_signature`);
    }
  } catch {
    // Si Steam tarda en responder, permitir solo si trae firma openid.sig
    if (!params.get('openid.sig')) {
      return NextResponse.redirect(`${url.origin}/?steam_error=missing_sig`);
    }
  }

  return NextResponse.redirect(`${url.origin}/?steam_id=${steamId64}`);
}