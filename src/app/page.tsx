"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const CS2_MAPS = [
  { id: "de_mirage", name: "Mirage", tag: "Clasico 5v5" },
  { id: "de_inferno", name: "Inferno", tag: "Control tactico" },
  { id: "de_dust2", name: "Dust II", tag: "Duelos de Aim" },
  { id: "de_nuke", name: "Nuke", tag: "Doble planta" },
  { id: "de_ancient", name: "Ancient", tag: "Selva / Medio" },
  { id: "de_anubis", name: "Anubis", tag: "Rotacion rapida" },
  { id: "de_vertigo", name: "Vertigo", tag: "Combate corto" },
];

const PRACTICE_MODES = [
  {
    id: "aim_botz",
    name: "Aim Botz & Recoil Master",
    desc: "Calentamiento individual de punteria y spray mientras esperas cola",
    slots: "18/24 Activos",
    port: "27016",
  },
  {
    id: "dm_ffa",
    name: "Deathmatch FFA Multi-CFG",
    desc: "Todos contra todos (AK47 / M4 / AWP / Pistol HS) en Mirage",
    slots: "14/20 Activos",
    port: "27017",
  },
  {
    id: "retakes",
    name: "Retakes 5v5 Competitivo",
    desc: "Situaciones reales de post-planta de bomba en sitios A y B",
    slots: "8/10 Activos",
    port: "27018",
  },
];

interface WeeklyMission {
  id: string;
  modeId: string;
  title: string;
  targetText: string;
  current: number;
  goal: number;
  eloReward: number;
  eloPenalty: number;
  bonusLabel: string;
  claimed: boolean;
  penalized: boolean;
}

const INITIAL_MISSIONS: WeeklyMission[] = [
  {
    id: "m_aimbotz",
    modeId: "aim_botz",
    title: "Calentamiento de Acero (Aim Botz :27016)",
    targetText: "Elimina 250 Bots con Headshot en el servidor de practica",
    current: 175,
    goal: 250,
    eloReward: 10,
    eloPenalty: 5,
    bonusLabel: "+10 ELO & Bono Mano Caliente (+10 ELO en tu prox. victoria 5v5)",
    claimed: false,
    penalized: false,
  },
  {
    id: "m_dmffa",
    modeId: "dm_ffa",
    title: "Dominio de Duelos (Deathmatch FFA :27017)",
    targetText: "Consigue 100 bajas con AK-47, M4 o Deagle en FFA",
    current: 100,
    goal: 100,
    eloReward: 15,
    eloPenalty: 5,
    bonusLabel: "+15 ELO Directos + 150 Pts Sorteo Mensual Skins",
    claimed: false,
    penalized: false,
  },
  {
    id: "m_retakes",
    modeId: "retakes",
    title: "Especialista en Defuse (Retakes 5v5 :27018)",
    targetText: "Gana 20 rondas de Retake plantando o desactivando C4",
    current: 12,
    goal: 20,
    eloReward: 5,
    eloPenalty: 5,
    bonusLabel: "+5 ELO & 1 Escudo Protector (0 ELO perdido en tu prox. derrota)",
    claimed: false,
    penalized: false,
  },
];

// Calculo de ELO inicial tras completar las 6 partidas de calibracion (25 a 100 ELO)
function getInitialCalibratedElo(winsInSix: number): number {
  const table: Record<number, number> = {
    0: 25,
    1: 35,
    2: 50,
    3: 65,
    4: 80,
    5: 90,
    6: 100,
  };
  const clamped = Math.max(0, Math.min(6, winsInSix));
  return table[clamped] ?? 25;
}

// Sistema de Rango Visual y Brillo Progresivo segun el ELO (Gris hasta 5,000+ Radiante)
function getEloTierStyle(elo: number, totalMatches: number) {
  if (totalMatches < 6) {
    return {
      tierName: `CALIBRANDO (${totalMatches}/6)`,
      badgeClass:
        "bg-[#171a21] text-[#8f98a0] border border-dashed border-[#8f98a0]/60",
      textClass: "text-[#8f98a0]",
    };
  }

  if (elo <= 100) {
    return {
      tierName: "HIERRO",
      badgeClass: "bg-[#1c2026] text-[#9aa5b1] border border-[#52606d]",
      textClass: "text-[#9aa5b1]",
    };
  }
  if (elo < 500) {
    return {
      tierName: "BRONCE ACTIVO",
      badgeClass:
        "bg-[#a4d007]/15 text-[#a4d007] border border-[#a4d007]/60 shadow-sm shadow-[#a4d007]/20",
      textClass: "text-[#a4d007]",
    };
  }
  if (elo < 1000) {
    return {
      tierName: "ZAFIRO",
      badgeClass:
        "bg-[#66c0f4]/15 text-[#66c0f4] border border-[#66c0f4] shadow-md shadow-[#66c0f4]/30",
      textClass: "text-[#66c0f4] drop-shadow-[0_0_6px_rgba(102,192,244,0.45)]",
    };
  }
  if (elo < 2000) {
    return {
      tierName: "AMATISTA",
      badgeClass:
        "bg-purple-500/20 text-purple-300 border border-purple-400 shadow-md shadow-purple-500/40",
      textClass: "text-purple-300 drop-shadow-[0_0_8px_rgba(192,132,252,0.6)]",
    };
  }
  if (elo < 3500) {
    return {
      tierName: "FENIX CARMESI",
      badgeClass:
        "bg-gradient-to-r from-[#FF5500]/30 to-red-600/30 text-[#ff8547] border border-[#FF5500] shadow-lg shadow-[#FF5500]/40",
      textClass: "text-[#FF5500] drop-shadow-[0_0_10px_rgba(255,85,0,0.75)]",
    };
  }
  if (elo < 5000) {
    return {
      tierName: "ORO IMPERIAL",
      badgeClass:
        "bg-gradient-to-r from-yellow-500/30 via-amber-300/25 to-yellow-600/30 text-yellow-300 border border-yellow-400 shadow-lg shadow-yellow-400/50",
      textClass: "text-yellow-300 drop-shadow-[0_0_12px_rgba(253,224,71,0.85)]",
    };
  }

  return {
    tierName: "LEYENDA 5K+",
    badgeClass:
      "bg-gradient-to-r from-yellow-400 via-[#FF5500] to-[#66c0f4] text-[#171a21] font-black border border-white shadow-xl shadow-[#FF5500]/60 animate-pulse",
    textClass:
      "text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-[#FF5500] to-[#66c0f4] drop-shadow-[0_0_14px_rgba(255,215,0,0.95)] font-black",
  };
}

const TEAM_ALPHA_ROSTER = [
  { nick: "YonathanDHC", elo: 2450, matches: 50, role: "CAPITAN", country: "VE" },
  { nick: "MaracayAim", elo: 1280, matches: 36, role: "SOLO Q", country: "VE" },
  { nick: "KevCS_ccs", elo: 640, matches: 18, role: "SOLO Q", country: "VE" },
  { nick: "AndresTap", elo: 95, matches: 6, role: "SOLO Q", country: "CO" },
  { nick: "ZuliaPeek", elo: 0, matches: 4, role: "SOLO Q", country: "VE" },
];

const TEAM_OMEGA_ROSTER = [
  { nick: "Viper_CCS", elo: 2310, matches: 45, role: "CAPITAN", country: "VE" },
  { nick: "BogotaPeek", elo: 3620, matches: 62, role: "SOLO Q", country: "CO" },
  { nick: "CatireCS", elo: 820, matches: 22, role: "SOLO Q", country: "VE" },
  { nick: "BarquisimetoHS", elo: 210, matches: 11, role: "SOLO Q", country: "VE" },
  { nick: "PanchoAWP", elo: 0, matches: 3, role: "SOLO Q", country: "PA" },
];

interface MatchItem {
  id: number;
  created_at: string;
  team_a: string;
  team_b: string;
  selected_map: string;
  score_a: number;
  score_b: number;
  status: string;
  winner: string | null;
}

interface LeaderboardPlayer {
  id: number;
  nickname: string;
  steam_id: string | null;
  elo: number;
  wins: number;
  losses: number;
  country: string;
  season_prize: string;
}

interface ChatMessage {
  id: number;
  sender: string;
  text: string;
  time: string;
  isSystem?: boolean;
}

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [loggedSteamId, setLoggedSteamId] = useState<string | null>(null);

  const [steamId, setSteamId] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("Venezuela (Fibra / Low-Ping)");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados de Cola Premier, Mapa de Practica, Misiones Semanales (7 dias) y Veto
  const [selectedPractice, setSelectedPractice] = useState(PRACTICE_MODES[0]);
  const [missions, setMissions] = useState<WeeklyMission[]>(INITIAL_MISSIONS);
  const [eloShieldActive, setEloShieldActive] = useState(false);
  const [hotHandBonus, setHotHandBonus] = useState(false);
  const [missionBanner, setMissionBanner] = useState<string | null>(null);
  const [weekSecondsLeft, setWeekSecondsLeft] = useState<number>(6 * 86400 + 14 * 3600 + 42 * 60);

  const [queueSearching, setQueueSearching] = useState(false);
  const [queueCount, setQueueCount] = useState(10);
  const [bannedMaps, setBannedMaps] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [savingMatch, setSavingMatch] = useState(false);

  // Estados del Chat de Equipo durante el Veto
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      sender: "SISTEMA",
      text: "Emparejamiento Premier completado (10/10). Recuerda completar tus misiones semanales en los mapas de practica en 7 dias para ganar bonos y evitar -5 ELO.",
      time: "Ahora",
      isSystem: true,
    },
    {
      id: 2,
      sender: "MaracayAim",
      text: "Acabo de completar la mision semanal de Deathmatch FFA (+15 ELO), vamos activos a ganar Mirage.",
      time: "Hace 5s",
    },
    {
      id: 3,
      sender: "ZuliaPeek",
      text: "Esta es mi 5ta partida de calibracion mano, vamos a ganarla para arrancar cerca de 100 ELO!",
      time: "Hace 2s",
    },
  ]);

  // Reloj regresivo del ciclo semanal de 7 dias para las misiones
  useEffect(() => {
    const t = setInterval(() => {
      setWeekSecondsLeft((prev) => (prev > 0 ? prev - 1 : 7 * 86400));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const formatWeekRemaining = (secs: number) => {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  // Cargar unicamente hasta 6 partidas del dia actual desde Supabase
  const fetchMatches = async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("matches")
      .select("*")
      .gte("created_at", startOfToday.toISOString())
      .order("id", { ascending: false })
      .limit(6);

    if (data && data.length > 0) {
      setMatches(data.slice(0, 6));
    } else {
      const { data: fallback } = await supabase
        .from("matches")
        .select("*")
        .order("id", { ascending: false })
        .limit(6);
      if (fallback) setMatches(fallback.slice(0, 6));
    }
  };

  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from("leaderboard_players")
      .select("*")
      .order("elo", { ascending: false })
      .limit(10);

    if (data) {
      setLeaderboard(data);
    }
  };

  useEffect(() => {
    fetchMatches();
    fetchLeaderboard();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const returnedSteamId = params.get("steam_id");
      const savedSteamId = localStorage.getItem("aimve_steam_id");

      const activeSteam = returnedSteamId || savedSteamId;
      if (returnedSteamId) {
        localStorage.setItem("aimve_steam_id", returnedSteamId);
        window.history.replaceState({}, "", window.location.pathname);
      }
      if (activeSteam) {
        setLoggedSteamId(activeSteam);
        setSteamId(activeSteam);
        fetch("/api/player-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ steam_id: activeSteam }),
        }).then(() => fetchLeaderboard());
      }
    }
  }, []);

  const handleLogoutSteam = () => {
    localStorage.removeItem("aimve_steam_id");
    setLoggedSteamId(null);
    setSteamId("");
  };

  const currentPlayerProfile = leaderboard.find(
    (p) => p.steam_id && p.steam_id === loggedSteamId
  ) || leaderboard[0];

  // Reclamar recompensa de Mision Semanal completada (+ELO real en Supabase + Escudo / Bono)
  const handleClaimMission = async (missionId: string) => {
    const targetMission = missions.find((m) => m.id === missionId);
    if (!targetMission || targetMission.claimed || targetMission.current < targetMission.goal) return;

    setMissions((prev) =>
      prev.map((m) => (m.id === missionId ? { ...m, claimed: true } : m))
    );

    if (missionId === "m_aimbotz") setHotHandBonus(true);
    if (missionId === "m_retakes") setEloShieldActive(true);

    if (currentPlayerProfile) {
      const updatedElo = currentPlayerProfile.elo + targetMission.eloReward;
      await supabase
        .from("leaderboard_players")
        .update({ elo: updatedElo })
        .eq("id", currentPlayerProfile.id);
      await fetchLeaderboard();
    }

    setMissionBanner(
      `Mision completada: +${targetMission.eloReward} ELO acreditados a tu perfil (${targetMission.title}).`
    );
  };

  // Sumar progreso de entrenamiento en una mision (para probar antes de cerrar semana)
  const handleAdvanceMissionProgress = (missionId: string) => {
    setMissions((prev) =>
      prev.map((m) =>
        m.id === missionId ? { ...m, current: m.goal, penalized: false } : m
      )
    );
  };

  // Aplicar corte de 7 dias: cada mision NO completada descuenta -5 ELO en Supabase
  const handleExpireWeekCheck = async () => {
    const incomplete = missions.filter((m) => m.current < m.goal && !m.penalized);
    if (incomplete.length === 0) {
      setMissionBanner(
        "Corte de 7 dias verificado: Completaste todas tus misiones semanales. 0 penalizaciones de ELO!"
      );
      return;
    }

    const totalPenalty = incomplete.length * 5;
    setMissions((prev) =>
      prev.map((m) => (m.current < m.goal ? { ...m, penalized: true } : m))
    );

    if (currentPlayerProfile) {
      const nextElo = Math.max(25, currentPlayerProfile.elo - totalPenalty);
      await supabase
        .from("leaderboard_players")
        .update({ elo: nextElo })
        .eq("id", currentPlayerProfile.id);
      await fetchLeaderboard();
    }

    setMissionBanner(
      `Plazo de 7 dias vencido: Se descontaron -${totalPenalty} ELO (-5 ELO por cada una de las ${incomplete.length} misiones de practica sin completar).`
    );
  };

  // Simulador de Busqueda de Partida Solo Queue
  const handleStartSoloQueue = () => {
    setQueueSearching(true);
    setQueueCount(4);
    setBannedMaps([]);
    setTimeLeft(15);

    const interval = setInterval(() => {
      setQueueCount((prev) => {
        if (prev >= 10) {
          clearInterval(interval);
          setQueueSearching(false);
          return 10;
        }
        return prev + 2 > 10 ? 10 : prev + 2;
      });
    }, 800);
  };

  // Logica del Veto de Mapas y Turnos
  const remainingMaps = CS2_MAPS.filter((m) => !bannedMaps.includes(m.id));
  const finalMap = remainingMaps.length === 1 ? remainingMaps[0] : null;
  const isAlphaTurn = bannedMaps.length % 2 === 0;
  const captainAlphaName = currentPlayerProfile ? currentPlayerProfile.nickname : "YonathanDHC";
  const currentTurn = isAlphaTurn ? `Equipo ${captainAlphaName}` : "Equipo Viper_CCS";

  // Reloj de 15 segundos por turno con Auto-Veto
  useEffect(() => {
    if (finalMap || queueSearching) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          const available = CS2_MAPS.filter((m) => !bannedMaps.includes(m.id));
          if (available.length > 1) {
            const randomPick = available[Math.floor(Math.random() * available.length)];
            setBannedMaps((curr) => [...curr, randomPick.id]);
          }
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [bannedMaps, finalMap, queueSearching]);

  const handleBanMap = (mapId: string) => {
    if (finalMap || bannedMaps.includes(mapId) || queueSearching) return;
    const mapObj = CS2_MAPS.find((m) => m.id === mapId);
    setBannedMaps([...bannedMaps, mapId]);
    setTimeLeft(15);

    if (mapObj) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          sender: isAlphaTurn ? `${captainAlphaName} (Capitan)` : "Viper_CCS (Capitan)",
          text: `Veto confirmado: descartado ${mapObj.name}.`,
          time: "Ahora",
          isSystem: true,
        },
      ]);
    }
  };

  const resetVeto = () => {
    setBannedMaps([]);
    setTimeLeft(15);
  };

  const sendChatMessage = (customText?: string) => {
    const msgToSend = (customText ?? chatInput).trim();
    if (!msgToSend) return;

    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: captainAlphaName,
        text: msgToSend,
        time: "Ahora",
      },
    ]);

    if (!customText) {
      setChatInput("");
    }
  };

  // Finalizar partida aplicando Calibracion (6 partidas -> 25-100 ELO), Bono Mano Caliente y Escudo de ELO
  const handleSimulateFinish = async () => {
    if (!finalMap) return;
    setSavingMatch(true);

    const roundsLoser = Math.floor(Math.random() * 10) + 2;
    const alphaWins = Math.random() > 0.5;
    const winnerTeam = alphaWins ? `Equipo ${captainAlphaName}` : "Equipo Viper_CCS";

    await supabase.from("matches").insert([
      {
        team_a: `Equipo ${captainAlphaName}`,
        team_b: "Equipo Viper_CCS",
        selected_map: finalMap.id,
        banned_maps: bannedMaps,
        score_a: alphaWins ? 13 : roundsLoser,
        score_b: alphaWins ? roundsLoser : 13,
        status: "PREMIER 5v5",
        winner: winnerTeam,
      },
    ]);

    const winnerRow = alphaWins ? currentPlayerProfile : leaderboard.find((p) => p.nickname === "Viper_CCS");
    const loserRow = alphaWins ? leaderboard.find((p) => p.nickname === "Viper_CCS") : currentPlayerProfile;

    if (winnerRow) {
      const newWins = winnerRow.wins + 1;
      const newTotal = newWins + winnerRow.losses;
      const stompBonus = roundsLoser <= 4 ? 4 : 0;
      const warmupBonus = alphaWins && hotHandBonus ? 10 : 0;

      const nextElo =
        newTotal <= 6
          ? getInitialCalibratedElo(newWins)
          : winnerRow.elo + 25 + stompBonus + warmupBonus;

      if (alphaWins && hotHandBonus) setHotHandBonus(false);

      await supabase
        .from("leaderboard_players")
        .update({ elo: nextElo, wins: newWins })
        .eq("id", winnerRow.id);
    }

    if (loserRow) {
      const newLosses = loserRow.losses + 1;
      const newTotal = loserRow.wins + newLosses;
      const isProtectedByShield = !alphaWins && eloShieldActive;

      const nextElo =
        newTotal <= 6
          ? getInitialCalibratedElo(loserRow.wins)
          : isProtectedByShield
          ? loserRow.elo
          : Math.max(25, loserRow.elo - 18);

      if (isProtectedByShield) {
        setEloShieldActive(false);
        setMissionBanner("Tu Escudo Protector de Retakes absorbio la derrota: perdiste 0 ELO!");
      }

      await supabase
        .from("leaderboard_players")
        .update({ elo: nextElo, losses: newLosses })
        .eq("id", loserRow.id);
    }

    await fetchMatches();
    await fetchLeaderboard();
    setSavingMatch(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const { error } = await supabase.from("early_access_players").insert([
      {
        steam_id: steamId.trim(),
        email: email.trim().toLowerCase(),
        country: country,
      },
    ]);

    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        setErrorMsg("Este correo electronico ya esta registrado en la lista de fundadores.");
      } else {
        setErrorMsg("Ocurrio un error al registrar tu solicitud. Intenta nuevamente.");
      }
      return;
    }

    setRegistered(true);
    setEmail("");
  };

  return (
    <div className="min-h-screen bg-[#171a21] text-[#c7d5e0] font-sans selection:bg-[#66c0f4] selection:text-[#171a21] relative overflow-x-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-tr from-[#1b2838] via-[#66c0f4]/15 to-[#FF5500]/10 blur-[130px] rounded-full" />

      {/* Barra de Navegacion Superior (Header) */}
      <header className="border-b border-[#2a475e]/60 bg-[#171a21]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3.5 group cursor-pointer">
            <div className="w-16 h-16 rounded-sm border border-[#2a475e] bg-[#171a21] flex items-center justify-center p-1 shadow-md">
              <img
                src="/logos.png"
                alt="AimVe Sports Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <div className="text-xl font-black tracking-wider text-white leading-none">
                AIMVE <span className="text-[#FF5500]">SPORTS</span>
              </div>
              <span className="text-[10px] font-bold text-[#66c0f4] tracking-widest uppercase mt-0.5">
                CS2 LATAM CIRCUIT
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[#c7d5e0]">
            <a href="#practica" className="hover:text-[#a4d007] transition">
              Practica & Misiones (7d)
            </a>
            <a href="#lobby" className="hover:text-[#66c0f4] transition">
              Solo Queue & Veto
            </a>
            <a href="#resultados" className="hover:text-[#66c0f4] transition">
              Partidas del Dia
            </a>
            <a href="#premios" className="hover:text-[#FF5500] transition">
              Rangos ELO & Skins
            </a>
          </nav>

          {loggedSteamId ? (
            <div className="flex items-center gap-2">
              <div className="px-3.5 py-2 rounded-sm bg-[#1b2838] border border-[#a4d007]/60 text-xs font-bold text-white flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#a4d007]"></span>
                {currentPlayerProfile ? (
                  <div className="flex items-center gap-2">
                    <span className="text-white font-black">{currentPlayerProfile.nickname}</span>
                    <span
                      className={`px-2 py-0.5 rounded-sm font-mono text-[11px] font-bold ${
                        getEloTierStyle(
                          currentPlayerProfile.elo,
                          currentPlayerProfile.wins + currentPlayerProfile.losses
                        ).badgeClass
                      }`}
                    >
                      {currentPlayerProfile.elo} ELO
                    </span>
                    {eloShieldActive && (
                      <span className="px-1.5 py-0.5 rounded-sm bg-[#66c0f4] text-[#171a21] text-[9px] font-black">
                        ESCUDO ACTIVO
                      </span>
                    )}
                  </div>
                ) : (
                  <span>STEAM: ...{loggedSteamId.slice(-6)}</span>
                )}
              </div>
              <button
                onClick={handleLogoutSteam}
                title="Cerrar sesion de Steam"
                className="px-2.5 py-2 rounded-sm bg-[#1b2838] hover:bg-red-950/60 border border-[#2a475e] hover:border-red-500/50 text-xs text-[#8f98a0] hover:text-red-300 font-bold transition cursor-pointer"
              >
                X
              </button>
            </div>
          ) : (
            <a
              href="/api/auth/steam"
              className="bg-gradient-to-r from-[#47bfff] to-[#1a44c2] hover:from-[#66c0f4] hover:to-[#2a5bd7] text-white font-bold px-5 py-2.5 rounded-sm text-sm tracking-wide transition shadow-lg shadow-[#1a44c2]/40 border border-[#66c0f4]/40 cursor-pointer"
            >
              CONECTAR STEAM
            </a>
          )}
        </div>
      </header>

      {/* Seccion Principal (Hero) */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-24 text-center relative z-10">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-sm bg-[#1b2838] border border-[#2a475e] text-xs font-bold text-[#66c0f4] mb-8 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-[#a4d007] animate-pulse"></span>
          {currentPlayerProfile
            ? `JUGADOR VERIFICADO: ${currentPlayerProfile.nickname.toUpperCase()} (${currentPlayerProfile.elo} ELO) | MISIONES SEMANALES ACTIVAS`
            : "CALIBRACION DE 6 PARTIDAS (25-100 ELO) | MISIONES DE PRACTICA CADA 7 DIAS"}
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none text-white mb-6">
          ENTRA SOLO, VETA EL MAPA <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#66c0f4] via-[#c7d5e0] to-[#FF5500]">
            Y COMPITE EN PREMIER LATAM
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-[#8f98a0] text-lg md:text-xl mb-10 leading-relaxed">
          Completa tus <span className="text-white font-semibold">6 partidas de calibracion</span> (25 a 100 ELO inicial), cumple tus <span className="text-[#a4d007] font-semibold">Misiones Semanales en el Mapa de Practica</span> (7 dias de plazo o <span className="text-red-400 font-bold">-5 ELO</span> por mision incompleta) y brilla hasta <span className="text-yellow-300 font-bold">5,000+ Leyenda</span>.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#lobby"
            onClick={handleStartSoloQueue}
            className="w-full sm:w-auto bg-gradient-to-r from-[#a4d007] to-[#7aa600] hover:brightness-110 text-[#171a21] font-black px-8 py-4 rounded-sm text-base tracking-wide transition shadow-xl shadow-[#a4d007]/20 cursor-pointer"
          >
            BUSCAR PARTIDA 5v5 (SOLO QUEUE)
          </a>
          <a
            href="#practica"
            className="w-full sm:w-auto px-8 py-4 rounded-sm border border-[#66c0f4]/60 hover:border-[#66c0f4] bg-[#1b2838]/90 hover:bg-[#2a475e]/60 text-white font-bold text-base transition"
          >
            MAPA DE PRACTICA & MISIONES (7D)
          </a>
        </div>

        {/* SECCION: SERVIDOR DE PRACTICA 24/7 + MISIONES SEMANALES (7 DIAS / -5 ELO PENALIZACION) */}
        <section id="practica" className="mt-20 text-left">
          <div className="p-6 rounded-sm bg-gradient-to-r from-[#1b2838] via-[#171a21] to-[#1b2838] border border-[#66c0f4]/50 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#a4d007] mb-1">
                  <span className="w-2 h-2 rounded-full bg-[#a4d007] animate-ping"></span>
                  WARMUP SERVER 24/7 | NO PIERDES TU LUGAR EN LA COLA 5v5
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white">
                  MAPA DE PRACTICA & MISIONES SEMANALES
                </h2>
                <p className="text-xs text-[#8f98a0] mt-1 max-w-2xl">
                  Entrena punteria mientras se llena el Lobby 5v5. Tienes <span className="text-white font-bold">7 dias</span> para completar las misiones semanales: ganarás ELO directo y escudos, pero cada mision no completada al cierre de la semana descuenta <span className="text-red-400 font-bold">-5 ELO</span>.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <a
                  href={`steam://connect/mia1.aimvesports.com:${selectedPractice.port}`}
                  className="px-6 py-3.5 rounded-sm bg-gradient-to-r from-[#66c0f4] to-[#1a44c2] hover:brightness-110 text-white font-black text-xs uppercase tracking-wider text-center transition shadow-lg shadow-[#66c0f4]/25"
                >
                  &gt; ENTRAR A PRACTICAR ({selectedPractice.name.split(" ")[0].toUpperCase()})
                </a>
              </div>
            </div>

            {/* Selector de los 3 Modos de Practica */}
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

            {/* PANEL DE MISIONES SEMANALES (7 DIAS DE PLAZO / -5 ELO SI NO SE CUMPLE) */}
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
                    INCUMPLIMIENTO: -5 ELO POR MISION
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleExpireWeekCheck}
                  className="text-[11px] px-3 py-1.5 rounded-sm bg-[#2a475e]/70 hover:bg-red-600/80 text-white font-bold transition cursor-pointer"
                >
                  Simular Corte de 7 Dias (Verificar -5 ELO)
                </button>
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

                        {/* Barra de Progreso */}
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
                          <>
                            <button
                              type="button"
                              onClick={() => handleAdvanceMissionProgress(m.id)}
                              className="w-full py-1.5 rounded-sm bg-[#2a475e] hover:bg-[#66c0f4] hover:text-[#171a21] text-white text-[11px] font-bold uppercase transition cursor-pointer"
                            >
                              Completar en Practica ({m.goal}/{m.goal})
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* SECCION 1: SALA PREMIER 5v5 (10 JUGADORES + VETO + CHAT DE EQUIPO) */}
        <section id="lobby" className="mt-20 text-left">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
            <div>
              <div className="text-[#66c0f4] text-xs font-black uppercase tracking-widest mb-1">
                MODO PREMIER SOLO QUEUE | 10 JUGADORES EMPAREJADOS POR ELO
              </div>
              <h2 className="text-3xl font-black text-white">
                SALA DE PARTIDA, VETO & CHAT DE EQUIPO
              </h2>
            </div>
            <div className="mt-3 md:mt-0 flex flex-wrap items-center gap-3">
              <button
                onClick={handleStartSoloQueue}
                className="text-xs px-3.5 py-1.5 rounded-sm bg-[#a4d007] hover:brightness-110 text-[#171a21] font-black uppercase transition cursor-pointer"
              >
                {queueSearching ? `Buscando Jugadores (${queueCount}/10)...` : "Buscar Nueva Partida Solo Q"}
              </button>
              <span
                className={`text-xs px-3 py-1.5 rounded-sm border font-bold ${
                  finalMap
                    ? "bg-[#a4d007]/20 border-[#a4d007] text-[#a4d007]"
                    : isAlphaTurn
                    ? "bg-[#66c0f4]/15 border-[#66c0f4] text-[#66c0f4]"
                    : "bg-[#FF5500]/15 border-[#FF5500] text-[#FF5500]"
                }`}
              >
                {finalMap
                  ? `MAPA ELEGIDO: ${finalMap.name.toUpperCase()}`
                  : `TURNO ACTIVO: ${currentTurn.toUpperCase()} (${timeLeft}s)`}
              </span>
              <button
                onClick={resetVeto}
                className="text-xs px-3 py-1.5 rounded-sm bg-[#2a475e]/60 hover:bg-[#2a475e] text-white font-bold transition cursor-pointer"
              >
                Reiniciar Veto
              </button>
            </div>
          </div>

          <div className="p-6 rounded-sm bg-[#1b2838]/90 border border-[#2a475e] shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start mb-8 pb-6 border-b border-[#2a475e]/60">
              {/* BANDO 1 */}
              <div
                className={`p-4 rounded-sm border transition-all duration-300 ${
                  finalMap
                    ? "bg-[#171a21]/90 border-[#2a475e]"
                    : isAlphaTurn
                    ? "bg-[#66c0f4]/15 border-[#66c0f4] shadow-lg shadow-[#66c0f4]/20"
                    : "bg-[#171a21]/40 border-[#2a475e]/40 opacity-55"
                }`}
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#2a475e]/50">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-sm bg-[#66c0f4]/20 border border-[#66c0f4] flex items-center justify-center font-black text-xs text-[#66c0f4]">
                      CT
                    </span>
                    <div>
                      <div className="text-white font-black text-base leading-none">
                        EQUIPO {captainAlphaName.toUpperCase()}
                      </div>
                      <span className="text-[10px] text-[#66c0f4] font-bold">
                        5 Jugadores Individuales | Solo Queue
                      </span>
                    </div>
                  </div>
                  {!finalMap && (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-sm ${
                        isAlphaTurn
                          ? "bg-[#66c0f4] text-[#171a21] animate-pulse"
                          : "bg-[#171a21] text-[#8f98a0] border border-[#2a475e]"
                      }`}
                    >
                      {isAlphaTurn ? "VETANDO AHORA" : "EN ESPERA"}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {TEAM_ALPHA_ROSTER.map((p, idx) => {
                    const displayNick = idx === 0 ? captainAlphaName : p.nick;
                    const displayElo = idx === 0 && currentPlayerProfile ? currentPlayerProfile.elo : p.elo;
                    const style = getEloTierStyle(displayElo, p.matches);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-sm bg-[#171a21]/90 border border-[#2a475e]/40 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#a4d007]"></span>
                          <span className="font-bold text-white">{displayNick}</span>
                          <span className="text-[9px] px-1 rounded-sm bg-[#1b2838] text-[#8f98a0] border border-[#2a475e]">
                            {p.country}
                          </span>
                          {p.role === "CAPITAN" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#66c0f4]/20 text-[#66c0f4] font-black">
                              CAPITAN
                            </span>
                          )}
                        </div>
                        <span className={`font-mono text-[10px] px-2 py-0.5 rounded-sm font-bold ${style.badgeClass}`}>
                          {p.matches < 6 ? `CALIBRANDO (${p.matches}/6)` : `${displayElo} ELO`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RELOJ CENTRAL DE VETO PREMIER */}
              <div className="text-center flex flex-col items-center justify-center my-auto">
                {queueSearching ? (
                  <div className="w-full max-w-xs bg-[#171a21] border border-[#a4d007] rounded-sm p-5">
                    <div className="text-xs font-black text-[#a4d007] uppercase tracking-wider animate-pulse mb-2">
                      BUSCANDO JUGADORES EN COLA...
                    </div>
                    <div className="text-3xl font-black text-white font-mono">
                      {queueCount} / 10
                    </div>
                    <p className="text-[11px] text-[#8f98a0] mt-2 mb-3">
                      Aprovecha para avanzar tus misiones semanales en el Mapa de Practica.
                    </p>
                    <a
                      href={`steam://connect/mia1.aimvesports.com:${selectedPractice.port}`}
                      className="inline-block w-full py-2 rounded-sm bg-[#66c0f4] text-[#171a21] font-black text-[11px] uppercase"
                    >
                      Ir a Practicar Mientras Carga
                    </a>
                  </div>
                ) : !finalMap ? (
                  <div className="w-full max-w-xs bg-[#171a21] border border-[#2a475e] rounded-sm p-4 shadow-inner">
                    <div className="text-[10px] font-bold text-[#8f98a0] uppercase tracking-widest mb-1">
                      TIEMPO RESTANTE PARA VETAR
                    </div>
                    <div className="flex items-center justify-between text-xs font-black uppercase mb-2">
                      <span className={isAlphaTurn ? "text-[#66c0f4]" : "text-[#FF5500]"}>
                        {currentTurn}
                      </span>
                      <span
                        className={`font-mono text-base ${
                          timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-white"
                        }`}
                      >
                        00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}s
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-[#111318] rounded-sm overflow-hidden border border-[#2a475e]/50">
                      <div
                        className={`h-full transition-all duration-1000 ${
                          timeLeft <= 5
                            ? "bg-red-500"
                            : isAlphaTurn
                            ? "bg-[#66c0f4]"
                            : "bg-[#FF5500]"
                        }`}
                        style={{ width: `${(timeLeft / 15) * 100}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-[#8f98a0] font-semibold mt-2">
                      Si el reloj llega a 0s se banea un mapa al azar ({bannedMaps.length}/6 vetados)
                    </div>
                  </div>
                ) : (
                  <div className="w-full max-w-xs px-5 py-4 rounded-sm bg-[#a4d007]/20 border border-[#a4d007] text-[#a4d007] text-xs font-black tracking-wider uppercase">
                    Veto Completado | Servidor Miami Listo
                  </div>
                )}
              </div>

              {/* BANDO 2 */}
              <div
                className={`p-4 rounded-sm border transition-all duration-300 ${
                  finalMap
                    ? "bg-[#171a21]/90 border-[#2a475e]"
                    : !isAlphaTurn
                    ? "bg-[#FF5500]/15 border-[#FF5500] shadow-lg shadow-[#FF5500]/20"
                    : "bg-[#171a21]/40 border-[#2a475e]/40 opacity-55"
                }`}
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#2a475e]/50">
                  {!finalMap && (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-sm ${
                        !isAlphaTurn
                          ? "bg-[#FF5500] text-white animate-pulse"
                          : "bg-[#171a21] text-[#8f98a0] border border-[#2a475e]"
                      }`}
                    >
                      {!isAlphaTurn ? "VETANDO AHORA" : "EN ESPERA"}
                    </span>
                  )}
                  <div className="flex items-center gap-2.5 ml-auto text-right">
                    <div>
                      <div className="text-white font-black text-base leading-none">
                        EQUIPO VIPER_CCS
                      </div>
                      <span className="text-[10px] text-[#FF5500] font-bold">
                        5 Jugadores Individuales | Solo Queue
                      </span>
                    </div>
                    <span className="w-8 h-8 rounded-sm bg-[#FF5500]/20 border border-[#FF5500] flex items-center justify-center font-black text-xs text-[#FF5500]">
                      TT
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {TEAM_OMEGA_ROSTER.map((p, idx) => {
                    const style = getEloTierStyle(p.elo, p.matches);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-sm bg-[#171a21]/90 border border-[#2a475e]/40 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#a4d007]"></span>
                          <span className="font-bold text-white">{p.nick}</span>
                          <span className="text-[9px] px-1 rounded-sm bg-[#1b2838] text-[#8f98a0] border border-[#2a475e]">
                            {p.country}
                          </span>
                          {p.role === "CAPITAN" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#FF5500]/20 text-[#FF5500] font-black">
                              CAPITAN
                            </span>
                          )}
                        </div>
                        <span className={`font-mono text-[10px] px-2 py-0.5 rounded-sm font-bold ${style.badgeClass}`}>
                          {p.matches < 6 ? `CALIBRANDO (${p.matches}/6)` : `${p.elo} ELO`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* CUERPO DIVIDIDO: LOS 7 MAPAS A LA IZQUIERDA + CHAT DE EQUIPO A LA DERECHA */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              <div className="lg:col-span-2 flex flex-col justify-between">
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3">
                  {CS2_MAPS.map((map) => {
                    const isBanned = bannedMaps.includes(map.id);
                    const isWinner = finalMap?.id === map.id;

                    return (
                      <button
                        key={map.id}
                        onClick={() => handleBanMap(map.id)}
                        disabled={isBanned || Boolean(finalMap) || queueSearching}
                        className={`p-4 rounded-sm border text-left transition flex flex-col justify-between h-32 relative overflow-hidden ${
                          isBanned
                            ? "bg-[#111318]/90 border-red-900/50 opacity-45 cursor-not-allowed"
                            : isWinner
                            ? "bg-gradient-to-b from-[#a4d007]/25 to-[#171a21] border-[#a4d007] shadow-lg shadow-[#a4d007]/20"
                            : isAlphaTurn
                            ? "bg-[#171a21] border-[#2a475e] hover:border-[#66c0f4] cursor-pointer group"
                            : "bg-[#171a21] border-[#2a475e] hover:border-[#FF5500] cursor-pointer group"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                          <span className="text-[#8f98a0]">{map.id}</span>
                          {isBanned && <span className="text-red-400">VETADO X</span>}
                          {isWinner && <span className="text-[#a4d007]">ACTIVO *</span>}
                        </div>

                        <div>
                          <div className="text-base font-black text-white">
                            {map.name}
                          </div>
                          <div className="text-[11px] text-[#8f98a0]">
                            {map.tag}
                          </div>
                        </div>

                        {!isBanned && !isWinner && (
                          <div
                            className={`text-[10px] font-bold opacity-0 group-hover:opacity-100 transition ${
                              isAlphaTurn ? "text-[#66c0f4]" : "text-[#FF5500]"
                            }`}
                          >
                            Vetar ({currentTurn}) -&gt;
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {finalMap && (
                  <div className="mt-6 p-5 rounded-sm bg-[#171a21] border border-[#a4d007]/60 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-black text-[#a4d007] uppercase tracking-wider flex items-center gap-2">
                        <span>MAPA DEFINITIVO: {finalMap.name.toUpperCase()} ({finalMap.id})</span>
                        <a
                          href={`/api/match-config?map=${finalMap.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] px-2 py-0.5 rounded-sm bg-[#1b2838] border border-[#66c0f4]/50 text-[#66c0f4] hover:bg-[#66c0f4] hover:text-[#171a21] transition"
                        >
                          Ver JSON Servidor
                        </a>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <code className="text-[11px] px-2 py-0.5 rounded-sm bg-[#111318] border border-[#2a475e] text-[#c7d5e0] font-mono">
                          .load https://www.aimvesports.com/api/match-config?map={finalMap.id}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `.load https://www.aimvesports.com/api/match-config?map=${finalMap.id}`
                            );
                          }}
                          className="text-[10px] px-2 py-0.5 rounded-sm bg-[#2a475e] hover:bg-[#66c0f4] hover:text-[#171a21] text-white font-bold transition cursor-pointer"
                        >
                          Copiar Comando CS2
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <a
                        href="steam://connect/mia1.aimvesports.com:27015"
                        className="w-full sm:w-auto text-center px-6 py-3 rounded-sm bg-gradient-to-r from-[#a4d007] to-[#7aa600] hover:brightness-110 text-[#171a21] font-black text-xs uppercase tracking-wider transition"
                      >
                        &gt; ENTRAR A LA PARTIDA (ABRIR CS2)
                      </a>
                      <button
                        onClick={handleSimulateFinish}
                        disabled={savingMatch}
                        className="w-full sm:w-auto px-5 py-3 rounded-sm bg-[#2a475e] hover:bg-[#66c0f4] hover:text-[#171a21] text-white font-black text-xs uppercase tracking-wider transition cursor-pointer"
                      >
                        {savingMatch ? "ACTUALIZANDO ELO..." : "FINALIZAR Y SUBIR RESULTADO"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Columna Derecha (1/3): CHAT EN VIVO DEL EQUIPO DURANTE EL VETO */}
              <div className="bg-[#171a21] border border-[#2a475e] rounded-sm flex flex-col justify-between h-full min-h-[290px]">
                <div className="px-4 py-2.5 border-b border-[#2a475e] flex items-center justify-between bg-[#111318]">
                  <span className="text-xs font-black uppercase tracking-wider text-[#66c0f4]">
                    CHAT DEL LOBBY (TU EQUIPO)
                  </span>
                  <span className="text-[10px] font-bold text-[#a4d007]">
                    5 Conectados
                  </span>
                </div>

                <div className="p-3.5 space-y-2.5 overflow-y-auto max-h-52 text-xs">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-2 rounded-sm ${
                        msg.isSystem
                          ? "bg-[#1b2838]/60 border border-[#2a475e]/60 text-[#66c0f4]"
                          : "bg-[#1b2838] text-[#c7d5e0]"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <span className="font-black text-white">{msg.sender}</span>
                        <span className="text-[#8f98a0]">{msg.time}</span>
                      </div>
                      <p className="text-xs leading-snug">{msg.text}</p>
                    </div>
                  ))}
                </div>

                <div className="p-3 border-t border-[#2a475e]/60 bg-[#111318]">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <button
                      type="button"
                      onClick={() => sendChatMessage("Baneen Mirage porfa")}
                      className="text-[10px] px-2 py-1 rounded-sm bg-[#1b2838] hover:bg-[#2a475e] text-[#c7d5e0] border border-[#2a475e] cursor-pointer"
                    >
                      &quot;Baneen Mirage&quot;
                    </button>
                    <button
                      type="button"
                      onClick={() => sendChatMessage("Dejen Dust2 o Inferno")}
                      className="text-[10px] px-2 py-1 rounded-sm bg-[#1b2838] hover:bg-[#2a475e] text-[#c7d5e0] border border-[#2a475e] cursor-pointer"
                    >
                      &quot;Dejen Dust2/Inferno&quot;
                    </button>
                    <button
                      type="button"
                      onClick={() => sendChatMessage("Quiten Vertigo")}
                      className="text-[10px] px-2 py-1 rounded-sm bg-[#1b2838] hover:bg-[#2a475e] text-[#c7d5e0] border border-[#2a475e] cursor-pointer"
                    >
                      &quot;Quiten Vertigo&quot;
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendChatMessage();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Escribe a tu equipo que mapa vetar..."
                      className="flex-1 px-3 py-1.5 bg-[#171a21] border border-[#2a475e] rounded-sm text-xs text-white focus:outline-none focus:border-[#66c0f4]"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-[#66c0f4] hover:brightness-110 text-[#171a21] font-black text-xs rounded-sm cursor-pointer"
                    >
                      Enviar
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECCION 2: RESULTADOS DE PARTIDAS RECIENTES (MAXIMO 6 POR DIA) */}
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
            {matches.slice(0, 6).map((m) => (
              <div
                key={m.id}
                className="p-5 rounded-sm bg-[#1b2838]/80 border border-[#2a475e] flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#66c0f4]">
                    MAPA: {m.selected_map}
                  </span>
                  <div className="text-base font-black text-white mt-1">
                    {m.team_a} <span className="text-[#8f98a0] font-normal">vs</span> {m.team_b}
                  </div>
                  <span className="text-xs text-[#a4d007] font-bold mt-1">
                    Ganador: {m.winner} (+25 ELO)
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
            ))}
          </div>
        </section>

        {/* SECCION 3: ESCALA DE BRILLO ELO & LEADERBOARD EN TIEMPO REAL */}
        <section id="premios" className="mt-24 text-left">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-6">
            <div>
              <div className="text-[#FF5500] text-xs font-black uppercase tracking-widest mb-1">
                PROGRESION DE RANGOS & BRILLO ELO | TEMPORADA FUNDADORES
              </div>
              <h2 className="text-3xl font-black text-white">
                LEADERBOARD TOP ELO & RECOMPENSAS
              </h2>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 bg-[#FF5500]/15 text-[#FF5500] border border-[#FF5500]/40 rounded-sm mt-2 md:mt-0">
              6 PARTIDAS CALIBRAN TU ELO INICIAL (25 A 100 ELO)
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
                  <th className="py-3.5 px-5">Rango & Brillo ELO</th>
                  <th className="py-3.5 px-5">Partidas (6 Calibran)</th>
                  <th className="py-3.5 px-5">Winrate</th>
                  <th className="py-3.5 px-5 text-right">Premio de Temporada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a475e]/40">
                {leaderboard.map((player, index) => {
                  const totalGames = player.wins + player.losses;
                  const winrate = totalGames > 0 ? Math.round((player.wins / totalGames) * 100) : 0;
                  const isMe = Boolean(loggedSteamId && player.steam_id === loggedSteamId);
                  const tier = getEloTierStyle(player.elo, totalGames);

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
                      <td className={`py-4 px-5 font-black ${index === 0 ? "text-[#FF5500]" : index === 1 ? "text-[#c7d5e0]" : "text-[#8f98a0]"}`}>
                        #{index + 1}
                      </td>
                      <td className="py-4 px-5 font-bold text-white">
                        {player.nickname}{" "}
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-sm bg-[#171a21] border border-[#2a475e] text-[#66c0f4]">
                          {player.country}
                        </span>
                        {isMe && (
                          <span className="ml-2 text-[10px] px-2 py-0.5 rounded-sm bg-[#a4d007] text-[#171a21] font-black uppercase">
                            TU PERFIL
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2.5">
                          <span className={`font-mono text-sm font-black ${tier.textClass}`}>
                            {totalGames < 6
                              ? `${getInitialCalibratedElo(player.wins)} ELO (Est.)`
                              : `${player.elo.toLocaleString()} ELO`}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-sm font-black uppercase ${tier.badgeClass}`}>
                            {tier.tierName}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-xs font-mono text-[#c7d5e0]">
                        <span className="text-[#a4d007] font-bold">{player.wins}W</span> -{" "}
                        <span className="text-red-400">{player.losses}L</span>{" "}
                        <span className="text-[10px] text-[#8f98a0] ml-1">
                          ({totalGames < 6 ? `Calibrando ${totalGames}/6` : `${totalGames} Jugadas`})
                        </span>
                      </td>
                      <td className="py-4 px-5 text-[#a4d007] font-bold">
                        {winrate}%
                      </td>
                      <td className={`py-4 px-5 text-right font-bold ${index === 0 ? "text-[#FF5500]" : "text-white"}`}>
                        {player.season_prize}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Pie de Pagina Corporativo */}
      <footer className="border-t border-[#2a475e]/60 bg-[#111318] py-8 text-center text-xs text-[#8f98a0]">
        <p className="font-semibold text-[#c7d5e0]">
          2026 AimVe Sports. Operado por SHOPYSOF., C.A. Todos los derechos reservados.
        </p>
        <p className="mt-1">Soporte y alianzas comerciales: contacto@aimvesports.com</p>
      </footer>

      {/* MODAL INTERACTIVO DE ACCESO ANTICIPADO */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1b2838] border border-[#66c0f4]/50 rounded-sm max-w-md w-full p-7 relative shadow-2xl">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-[#8f98a0] hover:text-white text-lg font-bold cursor-pointer"
            >
              X
            </button>

            {!registered ? (
              <form onSubmit={handleRegister}>
                <div className="text-xs font-black text-[#FF5500] uppercase tracking-widest mb-1">
                  LISTA DE FUNDADORES | CS2 LATAM
                </div>
                <h3 className="text-2xl font-black text-white mb-2">
                  Reserva tu Slot en AimVe
                </h3>
                <p className="text-xs text-[#8f98a0] mb-5">
                  Registrate para recibir tu invitacion a la Beta Cerrada, insignia de Fundador y acceso a los sorteos de Skins de lanzamiento.
                </p>

                {errorMsg && (
                  <div className="mb-4 p-3 rounded-sm bg-red-950/60 border border-red-500/50 text-xs text-red-300 font-semibold">
                    {errorMsg}
                  </div>
                )}

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#c7d5e0] mb-1">
                      Tu Nickname / Steam ID
                    </label>
                    <input
                      type="text"
                      required
                      value={steamId}
                      onChange={(e) => setSteamId(e.target.value)}
                      placeholder="Ej. Doge Head Attack o link de Steam"
                      className="w-full px-3.5 py-2.5 bg-[#171a21] border border-[#2a475e] rounded-sm text-sm text-white focus:outline-none focus:border-[#66c0f4]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#c7d5e0] mb-1">
                      Correo Electronico
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tucorreo@gmail.com"
                      className="w-full px-3.5 py-2.5 bg-[#171a21] border border-[#2a475e] rounded-sm text-sm text-white focus:outline-none focus:border-[#66c0f4]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#c7d5e0] mb-1">
                      Pais de Conexion
                    </label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#171a21] border border-[#2a475e] rounded-sm text-sm text-white focus:outline-none focus:border-[#66c0f4]"
                    >
                      <option value="Venezuela (Fibra / Low-Ping)">Venezuela (Fibra / Low-Ping)</option>
                      <option value="Colombia">Colombia</option>
                      <option value="Panama / Caribe">Panama / Caribe</option>
                      <option value="Ecuador / Peru">Ecuador / Peru</option>
                      <option value="Otro pais LATAM">Otro pais LATAM</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#FF5500] to-[#e03e00] hover:from-[#ff6a1f] hover:to-[#ff4500] disabled:opacity-50 text-white font-black py-3 rounded-sm text-sm tracking-wide transition cursor-pointer"
                >
                  {loading ? "REGISTRANDO EN BASE DE DATOS..." : "ASEGURAR MI CUPO DE FUNDADOR"}
                </button>
              </form>
            ) : (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-[#a4d007]/20 border border-[#a4d007] text-[#a4d007] flex items-center justify-center mx-auto mb-4 text-base font-black">
                  OK
                </div>
                <h4 className="text-xl font-black text-white mb-2">
                  Solicitud Registrada!
                </h4>
                <p className="text-xs text-[#8f98a0] mb-6">
                  Has quedado anotado en la lista prioritaria de AimVe Sports. Te notificaremos apenas abramos los servidores de prueba.
                </p>
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-6 py-2 bg-[#2a475e] text-white text-xs font-bold rounded-sm cursor-pointer"
                >
                  VOLVER A LA PLATAFORMA
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}