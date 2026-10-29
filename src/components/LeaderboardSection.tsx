"use client";

import React from "react";
import { LeaderboardPlayer, getEloTierStyle } from "@/lib/ranks";

interface Props {
  leaderboard: LeaderboardPlayer[];
  loggedSteamId: string | null;
}

export default React.memo(function LeaderboardSection({ leaderboard, loggedSteamId }: Props) {
  return (
    <section id="premios" className="mt-24 text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6">
        <div>
          <div className="text-[#FF5500] text-xs font-black uppercase tracking-widest mb-1">
            PROGRESION DE RANGOS, K/D, ADR &amp; AMORTIGUADOR MVP | TEMPORADA FUNDADORES
          </div>
          <h2 className="text-3xl font-black text-white">
            LEADERBOARD TOP ELO &amp; ESTADISTICAS PRO
          </h2>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 bg-[#FF5500]/15 text-[#FF5500] border border-[#FF5500]/40 rounded-sm mt-2 md:mt-0">
          MVP EN DERROTA SOLO PIERDE -6 ELO (AMORTIGUADOR DE IMPACTO ACTIVO)
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mb-6 p-4 rounded-sm bg-[#111318] border border-[#2a475e]">
        <div className="p-2.5 rounded-sm bg-[#171a21] border border-dashed border-[#8f98a0]/50 text-center">
          <div className="text-[10px] font-black text-[#8f98a0]">CALIBRACION</div>
          <div className="text-xs font-mono font-bold text-white mt-0.5">1 a 6 Partidas</div>
          <div className="text-[9px] text-[#8f98a0]">Asigna 25-100 ELO</div>
        </div>
        <div className="p-2.5 rounded-sm bg-[#1c2026] border border-[#52606d] text-center">
          <div className="text-[10px] font-black text-[#9aa5b1]">HIERRO</div>
          <div className="text-xs font-mono font-bold text-[#9aa5b1] mt-0.5">25 - 100 ELO</div>
          <div className="text-[9px] text-[#8f98a0]">Gris Acero</div>
        </div>
        <div className="p-2.5 rounded-sm bg-[#a4d007]/15 border border-[#a4d007]/60 text-center">
          <div className="text-[10px] font-black text-[#a4d007]">BRONCE</div>
          <div className="text-xs font-mono font-bold text-[#a4d007] mt-0.5">101 - 499 ELO</div>
          <div className="text-[9px] text-[#c7d5e0]">Verde Tactico</div>
        </div>
        <div className="p-2.5 rounded-sm bg-[#66c0f4]/15 border border-[#66c0f4] text-center shadow-sm shadow-[#66c0f4]/30">
          <div className="text-[10px] font-black text-[#66c0f4]">ZAFIRO</div>
          <div className="text-xs font-mono font-bold text-[#66c0f4] mt-0.5">500 - 999 ELO</div>
          <div className="text-[9px] text-[#c7d5e0]">Azul Electrico</div>
        </div>
        <div className="p-2.5 rounded-sm bg-purple-500/20 border border-purple-400 text-center shadow-md shadow-purple-500/30">
          <div className="text-[10px] font-black text-purple-300">AMATISTA</div>
          <div className="text-xs font-mono font-bold text-purple-300 mt-0.5">1,000 - 1,999</div>
          <div className="text-[9px] text-purple-200">Neon Purpura</div>
        </div>
        <div className="p-2.5 rounded-sm bg-[#FF5500]/25 border border-[#FF5500] text-center shadow-lg shadow-[#FF5500]/30">
          <div className="text-[10px] font-black text-[#ff8547]">FENIX</div>
          <div className="text-xs font-mono font-bold text-[#FF5500] mt-0.5">2,000 - 4,999</div>
          <div className="text-[9px] text-orange-200">Fuego Imperial</div>
        </div>
        <div className="p-2.5 rounded-sm bg-gradient-to-r from-yellow-400/30 via-[#FF5500]/30 to-[#66c0f4]/30 border border-yellow-300 text-center shadow-xl shadow-yellow-400/40">
          <div className="text-[10px] font-black text-yellow-300">LEYENDA 5K+</div>
          <div className="text-xs font-mono font-black text-white mt-0.5">5,000+ ELO</div>
          <div className="text-[9px] text-yellow-200">Radiante Supremo</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-sm border border-[#2a475e] bg-[#1b2838]/70">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-[#171a21] text-[#8f98a0] text-xs uppercase border-b border-[#2a475e]">
              <th className="py-3.5 px-5">Posicion</th>
              <th className="py-3.5 px-5">Jugador</th>
              <th className="py-3.5 px-5">Rango &amp; Brillo ELO</th>
              <th className="py-3.5 px-5">K/D | ADR | HS%</th>
              <th className="py-3.5 px-5">Partidas &amp; Winrate</th>
              <th className="py-3.5 px-5 text-right">Premio de Temporada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a475e]/40">
            {leaderboard.map((player, index) => {
              const totalGames = player.wins + player.losses;
              const winrate = totalGames > 0 ? Math.round((player.wins / totalGames) * 100) : 0;
              const isMe = Boolean(loggedSteamId && player.steam_id === loggedSteamId);
              const tier = getEloTierStyle(player.elo, totalGames);

              const kills = Number(player.kills || 0);
              const deaths = Number(player.deaths || 0);
              const headshots = Number(player.headshots || 0);
              const totalDmg = Number(player.total_damage || 0);
              const roundsPlayed = Number(player.rounds_played || 0);
              const mvpCount = Number(player.mvp_count || 0);

              const kdRatio =
                deaths > 0 ? (kills / deaths).toFixed(2) : kills > 0 ? kills.toFixed(2) : "1.00";
              const adr = roundsPlayed > 0 ? Math.round(totalDmg / roundsPlayed) : 0;
              const hsPct = kills > 0 ? Math.round((headshots / kills) * 100) : 0;

              return (
                <tr
                  key={player.id}
                  className={
                    isMe
                      ? "bg-gradient-to-r from-[#a4d007]/20 via-[#1b2838] to-transparent"
                      : index === 0
                      ? "bg-gradient-to-r from-[#FF5500]/15 to-transparent"
                      : ""
                  }
                >
                  <td
                    className={`py-4 px-5 font-black ${
                      index === 0
                        ? "text-[#FF5500]"
                        : index === 1
                        ? "text-[#c7d5e0]"
                        : "text-[#8f98a0]"
                    }`}
                  >
                    #{index + 1}
                  </td>
                  <td className="py-4 px-5 font-bold text-white">
                    {player.nickname}{" "}
                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-sm bg-[#171a21] border border-[#2a475e] text-[#66c0f4]">
                      {player.country}
                    </span>
                    {mvpCount > 0 && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-sm bg-yellow-500/20 border border-yellow-400/50 text-yellow-300 font-black">
                        ★ {mvpCount} MVP
                      </span>
                    )}
                    {isMe && (
                      <span className="ml-2 text-[10px] px-2 py-0.5 rounded-sm bg-[#a4d007] text-[#171a21] font-black uppercase">
                        TU PERFIL
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2.5">
                      <span className={`font-mono text-sm font-black ${tier.textClass}`}>
                        {totalGames < 6 ? "SIN ELO" : `${player.elo.toLocaleString()} ELO`}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-sm font-black uppercase ${tier.badgeClass}`}
                      >
                        {tier.tierName}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-5 font-mono text-xs">
                    <span
                      className={`font-black ${
                        Number(kdRatio) >= 1.15
                          ? "text-[#a4d007]"
                          : Number(kdRatio) < 0.9
                          ? "text-red-400"
                          : "text-white"
                      }`}
                    >
                      {kdRatio} K/D
                    </span>
                    <span className="text-[#8f98a0] mx-1.5">|</span>
                    <span className="text-[#66c0f4] font-bold">{adr} ADR</span>
                    <span className="text-[#8f98a0] mx-1.5">|</span>
                    <span className="text-[#c7d5e0]">{hsPct}% HS</span>
                  </td>
                  <td className="py-4 px-5 text-xs font-mono text-[#c7d5e0]">
                    <span className="text-[#a4d007] font-bold">{player.wins}W</span> -{" "}
                    <span className="text-red-400">{player.losses}L</span>{" "}
                    <span className="text-[#a4d007] font-bold ml-1.5">({winrate}%)</span>
                  </td>
                  <td
                    className={`py-4 px-5 text-right font-bold ${
                      index === 0 ? "text-[#FF5500]" : "text-white"
                    }`}
                  >
                    {player.season_prize}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
});