"use client";

import React, { useState } from "react";
import { LeaderboardPlayer, getEloTierStyle } from "@/lib/ranks";

interface Props {
  leaderboard: LeaderboardPlayer[];
  loggedSteamId: string | null;
  isAdmin?: boolean;
  onRefresh?: () => void;
}

function getDynamicSeasonPrize(index: number, totalGames: number, dbPrize: string): string {
  if (totalGames < 6) {
    return `En Calibracion (${totalGames}/6)`;
  }
  if (dbPrize && !dbPrize.startsWith("En Calibracion")) {
    return dbPrize;
  }
  if (index === 0) return "AK-47 | Asiimov + $50 Pool";
  if (index === 1) return "M4A1-S | Printstream + $30";
  if (index === 2) return "AWP | Redline + $20";
  if (index < 10) return "Pase Sorteo Skins Top 10";
  return "Clasificado Temporada 1";
}

function getNextRankProgress(elo: number, totalGames: number) {
  if (totalGames < 6) {
    return {
      nextTier: "Fin de Calibracion",
      needed: `${6 - totalGames} partidas mas`,
      pct: Math.round((totalGames / 6) * 100),
    };
  }
  const brackets = [
    { name: "BRONCE ACTIVO", min: 25, target: 101 },
    { name: "ZAFIRO", min: 101, target: 500 },
    { name: "AMATISTA", min: 500, target: 1000 },
    { name: "FENIX CARMESI", min: 1000, target: 2000 },
    { name: "ORO IMPERIAL", min: 2000, target: 3500 },
    { name: "LEYENDA 5K+", min: 3500, target: 5000 },
  ];
  for (const b of brackets) {
    if (elo < b.target) {
      const span = Math.max(1, b.target - b.min);
      const currentInSpan = Math.max(0, elo - b.min);
      return {
        nextTier: b.name,
        needed: `Faltan ${b.target - elo} ELO para ${b.name} (${b.target} ELO)`,
        pct: Math.min(99, Math.round((currentInSpan / span) * 100)),
      };
    }
  }
  return {
    nextTier: "RANGO MAXIMO ALCANZADO",
    needed: "Cima del Circuito LATAM (5,000+ ELO)",
    pct: 100,
  };
}

export default React.memo(function LeaderboardSection({
  leaderboard,
  loggedSteamId,
  isAdmin = false,
  onRefresh,
}: Props) {
  const [banTarget, setBanTarget] = useState("");
  const [banReason, setBanReason] = useState("Aimbot / Wallhack confirmado en Demo GOTV");
  const [rollbackMsg, setRollbackMsg] = useState<string | null>(null);
  const [processingBan, setProcessingBan] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<{
    player: LeaderboardPlayer;
    rankIndex: number;
  } | null>(null);

  const activeLeaderboard = leaderboard.filter((p: any) => !p.is_banned);

  const handleExecuteRollback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banTarget.trim() || processingBan) return;
    setProcessingBan(true);
    setRollbackMsg(null);

    try {
      const res = await fetch("/api/admin/ban-rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_steam_id: loggedSteamId,
          target_identifier: banTarget.trim(),
          reason: banReason.trim(),
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        setRollbackMsg(data.message);
        setBanTarget("");
        if (onRefresh) onRefresh();
      } else {
        setRollbackMsg(data?.error || "Error al ejecutar el Rollback.");
      }
    } catch {
      setRollbackMsg("Error de red al conectar con /api/admin/ban-rollback.");
    } finally {
      setProcessingBan(false);
    }
  };

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
          HAZ CLIC EN CUALQUIER JUGADOR PARA VER SU FICHA PRO (PLAYER CARD)
        </span>
      </div>

      {isAdmin && (
        <div className="mb-6 p-4 rounded-sm bg-[#171a21] border border-red-500/60 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm bg-red-600 text-white mr-2">
                ADMIN ANTI-CHEAT
              </span>
              <span className="text-xs font-black text-white uppercase">
                SISTEMA DE BANEO &amp; ELO ROLLBACK AUTOMATICO (ULTIMOS 7 DIAS)
              </span>
            </div>
            <span className="text-[11px] text-[#8f98a0]">
              Devuelve +18 ELO automaticamente a las victimas que perdieron contra el infractor.
            </span>
          </div>

          <form onSubmit={handleExecuteRollback} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={banTarget}
              onChange={(e) => setBanTarget(e.target.value)}
              placeholder="SteamID64 o Nickname a banear..."
              className="px-3 py-2 bg-[#111318] border border-[#2a475e] rounded-sm text-xs text-white focus:outline-none focus:border-red-500"
            />
            <input
              type="text"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Motivo del baneo (Demo GOTV)..."
              className="px-3 py-2 bg-[#111318] border border-[#2a475e] rounded-sm text-xs text-white focus:outline-none focus:border-red-500"
            />
            <button
              type="submit"
              disabled={processingBan}
              className="px-4 py-2 rounded-sm bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider transition cursor-pointer"
            >
              {processingBan ? "REVIRTIENDO PARTIDAS..." : "BANEAR Y DEVOLVER ELO (ROLLBACK)"}
            </button>
          </form>

          {rollbackMsg && (
            <div className="mt-3 p-2.5 rounded-sm bg-[#111318] border border-[#a4d007] text-xs text-[#a4d007] font-bold">
              {rollbackMsg}
            </div>
          )}
        </div>
      )}

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
            {activeLeaderboard.map((player, index) => {
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
              const prizeLabel = getDynamicSeasonPrize(index, totalGames, player.season_prize);

              return (
                <tr
                  key={player.id}
                  onClick={() => setSelectedProfile({ player, rankIndex: index })}
                  className={`cursor-pointer transition hover:bg-[#2a475e]/35 ${
                    isMe
                      ? "bg-gradient-to-r from-[#a4d007]/20 via-[#1b2838] to-transparent"
                      : index === 0
                      ? "bg-gradient-to-r from-[#FF5500]/15 to-transparent"
                      : ""
                  }`}
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
                    <span className="hover:text-[#66c0f4] underline decoration-[#2a475e] underline-offset-4">
                      {player.nickname}
                    </span>{" "}
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
                      index === 0
                        ? "text-[#FF5500]"
                        : index === 1
                        ? "text-[#66c0f4]"
                        : index === 2
                        ? "text-[#a4d007]"
                        : "text-white"
                    }`}
                  >
                    {prizeLabel}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL DE FICHA COMPETITIVA DEL JUGADOR (PLAYER CARD ESTILO FACEIT) */}
      {selectedProfile && (() => {
        const p = selectedProfile.player;
        const idx = selectedProfile.rankIndex;
        const totalGames = (p.wins || 0) + (p.losses || 0);
        const winrate = totalGames > 0 ? Math.round((p.wins / totalGames) * 100) : 0;
        const tier = getEloTierStyle(p.elo, totalGames);
        const progress = getNextRankProgress(p.elo, totalGames);

        const kills = Number(p.kills || 0);
        const deaths = Number(p.deaths || 0);
        const headshots = Number(p.headshots || 0);
        const totalDmg = Number(p.total_damage || 0);
        const roundsPlayed = Number(p.rounds_played || 0);
        const mvpCount = Number(p.mvp_count || 0);

        const kdRatio =
          deaths > 0 ? (kills / deaths).toFixed(2) : kills > 0 ? kills.toFixed(2) : "1.00";
        const adr = roundsPlayed > 0 ? Math.round(totalDmg / roundsPlayed) : 0;
        const hsPct = kills > 0 ? Math.round((headshots / kills) * 100) : 0;
        const prize = getDynamicSeasonPrize(idx, totalGames, p.season_prize);

        return (
          <div
            onClick={() => setSelectedProfile(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#171a21] border border-[#66c0f4]/60 rounded-sm max-w-lg w-full p-6 relative shadow-2xl"
            >
              <button
                onClick={() => setSelectedProfile(null)}
                className="absolute top-4 right-4 text-[#8f98a0] hover:text-white text-sm font-black cursor-pointer"
              >
                X
              </button>

              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#a4d007] mb-1">
                <span>✓ STEAM TRUST GATE VERIFICADO</span>
                <span>•</span>
                <span className="text-[#66c0f4]">POSICION GLOBAL #{idx + 1}</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#2a475e]">
                <div>
                  <h3 className="text-2xl font-black text-white flex items-center gap-2">
                    <span>{p.nickname}</span>
                    <span className="text-xs px-2 py-0.5 rounded-sm bg-[#1b2838] border border-[#2a475e] text-[#66c0f4]">
                      {p.country}
                    </span>
                  </h3>
                  {p.steam_id && (
                    <a
                      href={`https://steamcommunity.com/profiles/${p.steam_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-[#8f98a0] hover:text-[#66c0f4] font-mono underline mt-0.5 inline-block"
                    >
                      SteamID64: {p.steam_id} ↗
                    </a>
                  )}
                </div>

                <div className="text-right">
                  <div className={`font-mono text-2xl font-black ${tier.textClass}`}>
                    {totalGames < 6 ? "CALIBRANDO" : `${p.elo} ELO`}
                  </div>
                  <span
                    className={`inline-block mt-1 text-[10px] px-2.5 py-0.5 rounded-sm font-black uppercase ${tier.badgeClass}`}
                  >
                    {tier.tierName}
                  </span>
                </div>
              </div>

              {/* Barra de Progreso al Siguiente Rango */}
              <div className="my-4 p-3 rounded-sm bg-[#111318] border border-[#2a475e]">
                <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                  <span className="text-[#c7d5e0]">{progress.needed}</span>
                  <span className="text-[#66c0f4] font-mono">{progress.pct}%</span>
                </div>
                <div className="w-full h-2 bg-[#171a21] rounded-sm overflow-hidden border border-[#2a475e]/60">
                  <div
                    className="h-full bg-gradient-to-r from-[#66c0f4] to-[#a4d007]"
                    style={{ width: `${progress.pct}%` }}
                  />
                </div>
              </div>

              {/* Cuadricula de 6 Estadisticas de Combate */}
              <div className="grid grid-cols-3 gap-2.5 my-4">
                <div className="p-3 rounded-sm bg-[#1b2838]/70 border border-[#2a475e] text-center">
                  <div className="text-[10px] font-bold text-[#8f98a0] uppercase">K/D RATIO</div>
                  <div className="text-lg font-mono font-black text-white mt-0.5">{kdRatio}</div>
                  <div className="text-[10px] text-[#8f98a0]">
                    {kills}K / {deaths}D
                  </div>
                </div>
                <div className="p-3 rounded-sm bg-[#1b2838]/70 border border-[#2a475e] text-center">
                  <div className="text-[10px] font-bold text-[#8f98a0] uppercase">DAÑO MEDIO</div>
                  <div className="text-lg font-mono font-black text-[#66c0f4] mt-0.5">
                    {adr} ADR
                  </div>
                  <div className="text-[10px] text-[#8f98a0]">{roundsPlayed} Rondas</div>
                </div>
                <div className="p-3 rounded-sm bg-[#1b2838]/70 border border-[#2a475e] text-center">
                  <div className="text-[10px] font-bold text-[#8f98a0] uppercase">HEADSHOTS</div>
                  <div className="text-lg font-mono font-black text-[#a4d007] mt-0.5">{hsPct}%</div>
                  <div className="text-[10px] text-[#8f98a0]">{headshots} HS</div>
                </div>
                <div className="p-3 rounded-sm bg-[#1b2838]/70 border border-[#2a475e] text-center">
                  <div className="text-[10px] font-bold text-[#8f98a0] uppercase">WINRATE</div>
                  <div className="text-lg font-mono font-black text-white mt-0.5">{winrate}%</div>
                  <div className="text-[10px] text-[#8f98a0]">
                    {p.wins}W - {p.losses}L
                  </div>
                </div>
                <div className="p-3 rounded-sm bg-[#1b2838]/70 border border-[#2a475e] text-center">
                  <div className="text-[10px] font-bold text-[#8f98a0] uppercase">ESTRELLAS MVP</div>
                  <div className="text-lg font-mono font-black text-yellow-300 mt-0.5">
                    ★ {mvpCount}
                  </div>
                  <div className="text-[10px] text-[#8f98a0]">Impacto Pro</div>
                </div>
                <div className="p-3 rounded-sm bg-[#1b2838]/70 border border-[#2a475e] text-center">
                  <div className="text-[10px] font-bold text-[#8f98a0] uppercase">PREMIO ACTUAL</div>
                  <div className="text-[11px] font-black text-[#FF5500] mt-1 leading-tight">
                    {prize}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProfile(null)}
                className="w-full py-2.5 rounded-sm bg-[#2a475e] hover:bg-[#66c0f4] hover:text-[#171a21] text-white font-black text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Cerrar Ficha Competitiva
              </button>
            </div>
          </div>
        );
      })()}
    </section>
  );
});