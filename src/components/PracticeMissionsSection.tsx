"use client";

import React, { useState, useEffect } from "react";
import { PRACTICE_MODES, INITIAL_MISSIONS, WeeklyMission } from "@/lib/ranks";

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
  const [launchingMode, setLaunchingMode] = useState<string | null>(null);

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

  const handleLaunchWorkshopServer = async (modeId: string, modeName: string) => {
    try {
      setLaunchingMode(modeId);
      setMissionBanner(
        `Enviando orden RCON a Miami (207.246.79.56:27025) para cargar ${modeName}... Abriendo CS2 en 4 segundos.`
      );
      const res = await fetch("/api/practice-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "launch", mode_id: modeId }),
      });
      const data = await res.json();
      const connectUrl = data?.connectUrl || "steam://connect/207.246.79.56:27025";

      setTimeout(() => {
        setLaunchingMode(null);
        window.location.href = connectUrl;
      }, 3800);
    } catch {
      setLaunchingMode(null);
      window.location.href = "steam://connect/207.246.79.56:27025";
    }
  };

  return (
    <section id="practica" className="mt-20 text-left">
      <div className="p-6 rounded-sm bg-gradient-to-r from-[#1b2838] via-[#171a21] to-[#1b2838] border border-[#66c0f4]/50 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#a4d007] mb-1">
              <span className="w-2 h-2 rounded-full bg-[#a4d007] animate-ping"></span>
              WORKSHOP TRAINING HUB MIAMI (:27025) | NO PIERDES TU LUGAR EN LA COLA 5v5
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white">
              MAPA DE PRACTICA &amp; MISIONES SEMANALES
            </h2>
            <p className="text-xs text-[#8f98a0] mt-1 max-w-2xl">
              Elige tu mapa oficial de la Workshop (Aim Botz, Recoil Master o 5E Aimhub). Al hacer clic, el servidor de Miami cambia de mapa en caliente y registra tu progreso de mision. Tienes{" "}
              <span className="text-white font-bold">7 dias</span> para completar las
              misiones semanales o se descuenta{" "}
              <span className="text-red-400 font-bold">-13 ELO</span>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              disabled={Boolean(launchingMode)}
              onClick={() => handleLaunchWorkshopServer(selectedPractice.id, selectedPractice.name)}
              className="px-6 py-3.5 rounded-sm bg-gradient-to-r from-[#66c0f4] to-[#1a44c2] hover:brightness-110 disabled:opacity-60 text-white font-black text-xs uppercase tracking-wider text-center transition shadow-lg shadow-[#66c0f4]/25 cursor-pointer"
            >
              {launchingMode === selectedPractice.id
                ? "CARGANDO MAPA EN MIAMI (4s)..."
                : `> CARGAR Y ENTRAR (${selectedPractice.name.split(" ")[0].toUpperCase()})`}
            </button>
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
                    MIAMI :{mode.port}
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExpireWeekCheck}
                  className="text-[11px] px-3 py-1.5 rounded-sm bg-[#2a475e]/70 hover:bg-red-600/80 text-white font-bold transition cursor-pointer"
                >
                  Simular Corte de 7 Dias (Admin)
                </button>
              </div>
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
            {missions.map((rawMission) => {
              // Sincronizar siempre el titulo y descripcion con los 3 mapas de Workshop nuevos
              const template = INITIAL_MISSIONS.find(
                (t) => t.id === rawMission.id || t.modeId === rawMission.modeId
              );
              const m = template
                ? { ...rawMission, title: template.title, targetText: template.targetText }
                : rawMission;

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
                      <span className="text-[#66c0f4]">MIAMI :27025</span>
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

                  <div className="mt-4 pt-3 border-t border-[#2a475e]/40 flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={Boolean(launchingMode)}
                      onClick={() => handleLaunchWorkshopServer(m.modeId, m.title)}
                      className="w-full text-center py-1.5 rounded-sm bg-[#1b2838] hover:bg-[#66c0f4] hover:text-[#171a21] text-[#66c0f4] border border-[#66c0f4]/50 text-[11px] font-bold uppercase transition cursor-pointer"
                    >
                      {launchingMode === m.modeId
                        ? "Cargando Mapa en Miami (4s)..."
                        : "> Cargar Mapa en Miami y Entrar"}
                    </button>

                    {m.claimed ? (
                      <span className="w-full text-center py-1 rounded-sm bg-[#a4d007]/15 text-[#a4d007] text-[10px] font-black uppercase">
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
                      isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleAdvanceMissionProgress(m.id)}
                          className="w-full py-1 rounded-sm bg-[#2a475e]/60 hover:bg-[#66c0f4] hover:text-[#171a21] text-white text-[10px] font-bold uppercase transition cursor-pointer"
                        >
                          Simular Mision (Admin {m.goal}/{m.goal})
                        </button>
                      )
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