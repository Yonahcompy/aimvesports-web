"use client";

import React from "react";
import { MatchItem } from "@/lib/ranks";

interface Props {
  matches: MatchItem[];
}

export default React.memo(function RecentMatchesSection({ matches }: Props) {
  return (
    <section id="resultados" className="mt-24 text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
        <div>
          <div className="text-[#a4d007] text-xs font-black uppercase tracking-widest mb-1">
            HISTORIAL DEL DIA | MAXIMO 6 PARTIDAS DIARIAS EN PANTALLA
          </div>
          <h2 className="text-3xl font-black text-white">
            RESULTADOS DE PARTIDAS RECIENTES ({matches.length}/6 HOY)
          </h2>
        </div>
        <span className="text-xs text-[#8f98a0] mt-2 md:mt-0">
          Mostrando unicamente las ultimas 6 partidas del dia para mantener la web ligera.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {matches.slice(0, 6).map((m) => {
          const winnerLabel = m.winner
            ? m.winner.includes("ELO")
              ? m.winner
              : `${m.winner} (+25 ELO)`
            : "En curso";

          return (
            <div
              key={m.id}
              className="p-5 rounded-sm bg-[#1b2838]/80 border border-[#2a475e] flex items-center justify-between"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#66c0f4]">
                    MAPA: {m.selected_map}
                  </span>
                  {m.mvp_nickname && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-yellow-500/20 border border-yellow-400/50 text-yellow-300 font-black uppercase">
                      ★ MVP: {m.mvp_nickname}
                    </span>
                  )}
                </div>
                <div className="text-base font-black text-white mt-1">
                  {m.team_a} <span className="text-[#8f98a0] font-normal">vs</span> {m.team_b}
                </div>
                <span className="text-xs text-[#a4d007] font-bold mt-1">
                  Ganador: {winnerLabel}
                </span>
              </div>

              <div className="text-right">
                <div className="px-4 py-2 rounded-sm bg-[#171a21] border border-[#2a475e] font-mono text-xl font-black text-white">
                  <span className={m.score_a > m.score_b ? "text-[#a4d007]" : "text-[#8f98a0]"}>
                    {m.score_a}
                  </span>
                  {" : "}
                  <span className={m.score_b > m.score_a ? "text-[#a4d007]" : "text-[#8f98a0]"}>
                    {m.score_b}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold text-[#8f98a0] block mt-1">
                  {m.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});