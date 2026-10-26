import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const teamA = body.team1?.name || body.team_a || 'Equipo Alpha';
    const teamB = body.team2?.name || body.team_b || 'Equipo Omega';
    const scoreA = Number(body.team1?.score ?? body.score_a ?? 13);
    const scoreB = Number(body.team2?.score ?? body.score_b ?? 9);
    const mapName = body.map_name || body.selected_map || 'de_mirage';
    const winner = scoreA > scoreB ? teamA : teamB;

    const { data, error } = await supabase
      .from('matches')
      .insert([
        {
          team_a: teamA,
          team_b: teamB,
          selected_map: mapName,
          score_a: scoreA,
          score_b: scoreB,
          status: 'FINALIZADA',
          winner: winner,
        },
      ])
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Resultado de CS2 registrado en AimVe Sports',
      match: data,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Error procesando webhook del servidor CS2' },
      { status: 500 }
    );
  }
}
