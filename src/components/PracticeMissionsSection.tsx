"use client";

import React, { useState, useEffect } from "react";
import { PRACTICE_MODES, WeeklyMission } from "@/lib/ranks";

interface Props {
  selectedPractice: (typeof PRACTICE_MODES)[0];
  setSelectedPractice: (mode: (typeof PRACTICE_MODES)[0]) => void;
  missions: WeeklyMission[];
  weekExpiresAt: number;
  missionBanner: string | null;
  setMissionBanner: (msg: string | null) => void;
  handleExpireWeekCheck: () => void;
  handleClaimMission: (id: string) => void;
  handleAdvanceMissionProgress: (id: string) => void;
  isAdmin: boolean;
}

export default React.memo(function PracticeMissionsSection({
  selectedPractice,
  setSelectedPractice,
  missions,
  weekExpiresAt,
  missionBanner,
  setMissionBanner,
  handleExpireWeekCheck,
  handleClaimMission,
  handleAdvanceMissionProgress,
  isAdmin,
}: Props) {
  const [weekSecondsLeft, setWeekSecondsLeft] = useState<number>(7 * 86400);

  useEffect(() => {
    if (!weekExpiresAt) return;
    const updateClock = () => {
      const remaining = Math.max(0, Math.floor((weekExpiresAt - Date.now()) / 1000));
      setWeekSecondsLeft(remaining);
    };
    updateClock();
    const t = setInterval(updateClock, 1000);
    return () => clearInterval(t);
  }, [weekExpiresAt]);

  const formatWeekRemaining = (secs: number) => {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  return (
    <section id="practica" className="mt-20 text-left">
      <div className="p-6 rounded-sm bg-gradient-to-r from-[#1b2838] via-[#171a21] to-[#1b2838] border border-[#66c0f4]/50 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#a4d007] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#a4d007] animate-ping"></span>
              WARMUP SERVER 24/7 | NO PIERDES TU LUGAR EN LA COLA 5v5
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white">
              MAPA DE PRACTICA &amp; MISIONES SEMANALES
            </h2>
            <p className="text-xs text-[#8f98a0] mt-1 max-w-2xl">
              Entrena punteria mientras se llena el Lobby 5v5. Tienes{" "}
              <span className="text-white font-bold">7 dias</span> para completar las
              misiones semanales: ganarás ELO directo y escudos, pero cada mision no
              completada al cierre de la semana descuenta{" "}
              <span className="text-red-400 font-bold">-13 ELO</span>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <a
              href={`steam://connect/miami1.aimvesports.com:${selectedPractice.port}`}
              className="px-6 py-3.5 rounded-sm bg-gradient-to-r from-[#66c0f4] to-[#1a44c2] hover:brightness-110 text-white font-black text-xs uppercase tracking-wider text-center transition shadow-lg shadow-[#66c0f4]/25"
            >
              &gt; ENTRAR A PRACTICAR ({selectedPractice.name.split(" ")[0].toUpperCase()})
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5 pt-5 border-t border-[#2a475e]/60">
          {PRACTICE_MODES.map((mode) => {
            const active = selectedPractice.id === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSelectedPractice(mode)}
                className={`p-4 rounded-sm border text-left transition cursor-pointer ${
                  active
                    ? "bg-[#66c0f4]/15 border-[#66c0f4] shadow-md shadow-[#66c0f4]/20"
                    : "bg-[#171a21]/80 border-[#2a475e] hover:border-[#66c0f4]/50"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-black uppercase mb-1">
                  <span className={active ? "text-[#66c0f4]" : "text-[#8f98a0]"}>
                    PUERTO :{mode.port}
                  </span>
                  <span className="text-[#a4d007]">{mode.slots}</span>
                </div>
                <div className="text-sm font-black text-white">{mode.name}</div>
                <p className="text-[11px] text-[#8f98a0] mt-1">{mode.desc}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-6 pt-6 border-t border-[#2a475e]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-white">
                MISIONES SEMANALES DE ENTRENAMIENTO
              </span>
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-sm bg-[#111318] border border-[#66c0f4]/50 text-[#66c0f4]">
                CIERRE EN: {formatWeekRemaining(weekSecondsLeft)} (PLAZO 7 DIAS)
              </span>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-sm bg-red-950/70 border border-red-500/50 text-red-300">
                INCUMPLIMIENTO: -13 ELO POR MISION
              </span>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={handleExpireWeekCheck}
                className="text-[11px] px-3 py-1.5 rounded-sm bg-[#2a475e]/70 hover:bg-red-600/80 text-white font-bold transition cursor-pointer"
              >
                Simular Corte de 7 Dias (Admin)
              </button>
            )}
          </div>

          {missionBanner && (
            <div className="mb-4 p-3 rounded-sm bg-[#111318] border border-[#a4d007] text-xs text-[#a4d007] font-bold flex items-center justify-between">
              <span>{missionBanner}</span>
              <button
                type="button"
                onClick={() => setMissionBanner(null)}
                className="text-[#8f98a0] hover:text-white font-black ml-4 cursor-pointer"
              >
                X
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {missions.map((m) => {
              const pct = Math.min(100, Math.round((m.current / m.goal) * 100));
              const completed = m.current >= m.goal;

              return (
                <div
                  key={m.id}
                  className={`p-4 rounded-sm border flex flex-col justify-between ${
                    m.claimed
                      ? "bg-[#111318]/90 border-[#a4d007]/60"
                      : m.penalized
                      ? "bg-red-950/25 border-red-500/60"
                      : completed
                      ? "bg-[#171a21] border-[#a4d007]"
                      : "bg-[#171a21] border-[#2a475e]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase mb-1">
                      <span className="text-[#66c0f4]">PLAZO: 7 DIAS</span>
                      {m.claimed ? (
                        <span className="text-[#a4d007]">RECLAMADA (+{m.eloReward} ELO)</span>
                      ) : m.penalized ? (
                        <span className="text-red-400">VENCIDA (-{m.eloPenalty} ELO)</span>
                      ) : completed ? (
                        <span className="text-[#a4d007] animate-pulse">LISTA PARA RECLAMAR</span>
                      ) : (
                        <span className="text-red-300">SI NO CUMPLES: -{m.eloPenalty} ELO</span>
                      )}
                    </div>

                    <div className="text-sm font-black text-white">{m.title}</div>
                    <p className="text-[11px] text-[#8f98a0] mt-1">{m.targetText}</p>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] font-mono font-bold mb-1">
                        <span className="text-[#c7d5e0]">
                          Progreso: {m.current} / {m.goal}
                        </span>
                        <span className={completed ? "text-[#a4d007]" : "text-[#66c0f4]"}>
                          {pct}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#111318] rounded-sm overflow-hidden border border-[#2a475e]/60">
                        <div
                          className={`h-full transition-all duration-500 ${
                            completed ? "bg-[#a4d007]" : "bg-[#66c0f4]"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-2.5 text-[10px] font-bold text-[#a4d007]">
                      Recompensa: {m.bonusLabel}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#2a475e]/40 flex items-center gap-2">
                    {m.claimed ? (
                      <span className="w-full text-center py-1.5 rounded-sm bg-[#a4d007]/15 text-[#a4d007] text-[11px] font-black uppercase">
                        Mision Semanal Completada OK
                      </span>
                    ) : completed ? (
                      <button
                        type="button"
                        onClick={() => handleClaimMission(m.id)}
                        className="w-full py-1.5 rounded-sm bg-[#a4d007] hover:brightness-110 text-[#171a21] text-[11px] font-black uppercase transition cursor-pointer"
                      >
                        Reclamar +{m.eloReward} ELO y Bono
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAdvanceMissionProgress(m.id)}
                        className="w-full py-1.5 rounded-sm bg-[#2a475e] hover:bg-[#66c0f4] hover:text-[#171a21] text-white text-[11px] font-bold uppercase transition cursor-pointer"
                      >
                        Completar en Practica ({m.goal}/{m.goal})
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
});