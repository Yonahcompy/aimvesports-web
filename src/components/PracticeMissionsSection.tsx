"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  handleClaimMission,
}: Props) {
  const [weekSecondsLeft, setWeekSecondsLeft] = useState<number>(7 * 86400);
  const [launchingMode, setLaunchingMode] = useState<string | null>(null);
  const [serverBusyAlert, setServerBusyAlert] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<{
    prime_time_5v5: boolean;
    busy_rooms: number;
    max_rooms: number;
  }>({ prime_time_5v5: false, busy_rooms: 0, max_rooms: 2 });
  const [syncedMissions, setSyncedMissions] = useState<WeeklyMission[]>(missions);

  useEffect(() => {
    setSyncedMissions(missions);
  }, [missions]);

  const fetchLivePracticeState = useCallback(async () => {
    try {
      const res = await fetch("/api/practice-webhook", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.roomStatus) {
        setRoomStatus(data.roomStatus);
        if (data.roomStatus.busy_rooms < data.roomStatus.max_rooms) {
          setServerBusyAlert(null);
        }
      }
      if (Array.isArray(data?.liveMissions) && data.liveMissions.length > 0) {
        setSyncedMissions(data.liveMissions);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchLivePracticeState();
    const interval = setInterval(fetchLivePracticeState, 12000);
    const onFocus = () => fetchLivePracticeState();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchLivePracticeState]);

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
      setServerBusyAlert(null);
      setMissionBanner(
        `Buscando sala libre en Miami y cargando ${modeName}...`
      );
      const res = await fetch("/api/practice-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "launch", mode_id: modeId }),
      });
      const data = await res.json();

      if (res.status === 429 || data?.busy) {
        setLaunchingMode(null);
        setMissionBanner(null);
        setServerBusyAlert(
          data?.message ||
            "SERVIDORES DE PRACTICA OCUPADOS: Todas las salas individuales estÃƒÂ¡n en uso en este momento. Intenta en unos minutos."
        );
        fetchLivePracticeState();
        return;
      }

      const assignedPort = data?.port || 27025;
      const waitMs = data?.waitMs || 2000;
      const consoleCmd = `connect 207.246.79.56:${assignedPort}`;
      const connectUrl = `steam://run/730//+connect%20207.246.79.56:${assignedPort}`;
      try {
        await navigator.clipboard.writeText(consoleCmd);
      } catch {}

      setMissionBanner(
        `Sala lista en Miami (:${assignedPort}) con ${modeName}. Comando "${consoleCmd}" copiado al portapapeles (pegalo en consola ~ si ya tienes CS2 abierto).`
      );
      setTimeout(() => {
        setLaunchingMode(null);
        window.location.href = connectUrl;
      }, waitMs);
    } catch {
      setLaunchingMode(null);
      window.location.href = "steam://connect/207.246.79.56:27025";
    }
  };

  const allRoomsBusy = roomStatus.busy_rooms >= roomStatus.max_rooms;

  return (
    <section id="practica" className="mt-20 text-left">
      <div className="p-6 rounded-sm bg-gradient-to-r from-[#1b2838] via-[#171a21] to-[#1b2838] border border-[#66c0f4]/50 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#a4d007]">
                <span className="w-2 h-2 rounded-full bg-[#a4d007] animate-ping"></span>
                WORKSHOP TRAINING HUB MIAMI | SALAS BAJO DEMANDA
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm border ${
                  allRoomsBusy
                    ? "bg-red-950/80 border-red-500 text-red-300"
                    : "bg-[#111318] border-[#a4d007]/60 text-[#a4d007]"
                }`}
              >
                {allRoomsBusy
                  ? `SALAS OCUPADAS (${roomStatus.busy_rooms}/${roomStatus.max_rooms})`
                  : `SALAS DISPONIBLES (${roomStatus.busy_rooms}/${roomStatus.max_rooms} EN USO)`}
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-sm bg-[#111318] border border-[#66c0f4]/40 text-[#66c0f4]">
                {roomStatus.prime_time_5v5
                  ? "HORARIO PRIME TIME 5v5 ACTIVO (:27025 RESERVADO 5v5)"
                  : "HORARIO DIURNO (CAPACIDAD MAXIMA DE PRACTICA)"}
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-white">
              MAPA DE PRACTICA &amp; MISIONES SEMANALES
            </h2>
            <p className="text-xs text-[#8f98a0] mt-1 max-w-2xl">
              Entrena en tu propia sala privada sin interrumpir a otros jugadores. El progreso se audita en vivo desde los logs del servidor en Miami y se actualiza automÃƒÂ¡ticamente al hacer{" "}
              <span className="text-white font-bold">ALT+TAB</span>. Incumplir una misiÃƒÂ³n al cierre de los{" "}
              <span className="text-white font-bold">7 dias</span> descuenta{" "}
              <span className="text-red-400 font-bold">-13 ELO</span>.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              disabled={Boolean(launchingMode)}
              onClick={() => handleLaunchWorkshopServer(selectedPractice.id, selectedPractice.name)}
              className={`px-6 py-3.5 rounded-sm font-black text-xs uppercase tracking-wider text-center transition shadow-lg cursor-pointer ${
                allRoomsBusy
                  ? "bg-red-900/80 border border-red-500 text-red-200 hover:bg-red-800"
                  : "bg-gradient-to-r from-[#66c0f4] to-[#1a44c2] hover:brightness-110 text-white shadow-[#66c0f4]/25"
              }`}
            >
              {launchingMode === selectedPractice.id
                ? "ASIGNANDO SALA EN MIAMI (4s)..."
                : allRoomsBusy
                ? "SERVIDORES OCUPADOS (VERIFICAR CUPO)"
                : `> ENTRAR A PRACTICAR (${selectedPractice.name.split(" ")[0].toUpperCase()})`}
            </button>
          </div>
        </div>

        {serverBusyAlert && (
          <div className="mt-4 p-3.5 rounded-sm bg-red-950/90 border border-red-500 text-xs text-red-200 font-bold flex items-center justify-between">
            <span>Ã¢Å¡Â Ã¯Â¸Â {serverBusyAlert}</span>
            <button
              type="button"
              onClick={() => setServerBusyAlert(null)}
              className="text-red-300 hover:text-white font-black ml-4 cursor-pointer"
            >
              X
            </button>
          </div>
        )}

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
                    POOL DINAMICO MIAMI
                  </span>
                  <span className="text-[#a4d007]">
                    {allRoomsBusy ? "En Uso" : "Sala Libre"}
                  </span>
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
                MISIONES SEMANALES DE ENTRENAMIENTO (AUDITORIA EN TIEMPO REAL)
              </span>
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-sm bg-[#111318] border border-[#66c0f4]/50 text-[#66c0f4]">
                CIERRE EN: {formatWeekRemaining(weekSecondsLeft)} (PLAZO 7 DIAS)
              </span>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-sm bg-red-950/70 border border-red-500/50 text-red-300">
                INCUMPLIMIENTO: -13 ELO POR MISION
              </span>
            </div>
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
            {syncedMissions.map((rawMission) => {
              const template = INITIAL_MISSIONS.find(
                (t) => t.id === rawMission.id || t.modeId === rawMission.modeId
              );
              const m = template
                ? {
                    ...rawMission,
                    title: template.title,
                    targetText: template.targetText,
                    goal: template.goal,
                  }
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
                      <span className="text-[#66c0f4]">META SEMANAL</span>
                      {m.claimed && completed ? (
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
                          Progreso Real: {m.current} / {m.goal}
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
                        ? "Asignando Sala en Miami (4s)..."
                        : "> Entrar al Servidor a Progresar"}
                    </button>

                    {completed && !m.claimed && (
                      <button
                        type="button"
                        onClick={() => handleClaimMission(m.id)}
                        className="w-full py-1.5 rounded-sm bg-[#a4d007] hover:brightness-110 text-[#171a21] text-[11px] font-black uppercase transition cursor-pointer"
                      >
                        Reclamar +{m.eloReward} ELO y Bono
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