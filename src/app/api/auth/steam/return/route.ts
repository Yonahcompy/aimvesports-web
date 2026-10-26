import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const claimedId = params.get('openid.claimed_id') || '';
  const match = claimedId.match(/\/id\/(\d+)$/) || claimedId.match(/\/profiles\/(\d+)$/) || claimedId.match(/(\d{17})$/);
  const steamId64 = match ? match[1] : null;

  if (!steamId64) {
    return NextResponse.redirect(${url.origin}/?steam_error=1);
  }

  return NextResponse.redirect(${url.origin}/?steam_id=);
}
