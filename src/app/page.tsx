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

const TEAM_ALPHA_ROSTER = [
  { nick: "YonathanDHC", elo: 2450, role: "CAPITAN", country: "VE" },
  { nick: "MaracayAim", elo: 2080, role: "SOLO Q", country: "VE" },
  { nick: "KevCS_ccs", elo: 1940, role: "SOLO Q", country: "VE" },
  { nick: "AndresTap", elo: 1890, role: "SOLO Q", country: "CO" },
  { nick: "ZuliaPeek", elo: 1850, role: "SOLO Q", country: "VE" },
];

const TEAM_OMEGA_ROSTER = [
  { nick: "Viper_CCS", elo: 2310, role: "CAPITAN", country: "VE" },
  { nick: "BogotaPeek", elo: 2190, role: "SOLO Q", country: "CO" },
  { nick: "CatireCS", elo: 1995, role: "SOLO Q", country: "VE" },
  { nick: "BarquisimetoHS", elo: 1910, role: "SOLO Q", country: "VE" },
  { nick: "PanchoAWP", elo: 1825, role: "SOLO Q", country: "PA" },
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

  // Estados de Cola Premier, Veto 5v5 y Temporizador
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
      text: "Emparejamiento Premier completado (10/10). Capitanes elegidos por mayor ELO.",
      time: "Ahora",
      isSystem: true,
    },
    {
      id: 2,
      sender: "MaracayAim",
      text: "Buenas mano, vetemos Vertigo y Anubis de una, juguemos Mirage o Dust2.",
      time: "Hace 5s",
    },
    {
      id: 3,
      sender: "AndresTap",
      text: "De una capitan, quita Nuke tambien que tengo mejor FPS en Inferno.",
      time: "Hace 2s",
    },
  ]);

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
      // Respaldo por si cambia el dia a medianoche mostrar maximo las ultimas 6
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

      if (returnedSteamId) {
        localStorage.setItem("aimve_steam_id", returnedSteamId);
        setLoggedSteamId(returnedSteamId);
        setSteamId(returnedSteamId);
        window.history.replaceState({}, "", window.location.pathname);
      } else if (savedSteamId) {
        setLoggedSteamId(savedSteamId);
        setSteamId(savedSteamId);
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
  );

  // Simulador de Busqueda de Partida Solo Queue (1/10 -> 10/10)
  const handleStartSoloQueue = () => {
    setQueueSearching(true);
    setQueueCount(3);
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
    }, 600);
  };

  // Logica del Veto de Mapas y Turnos
  const remainingMaps = CS2_MAPS.filter((m) => !bannedMaps.includes(m.id));
  const finalMap = remainingMaps.length === 1 ? remainingMaps[0] : null;
  const isAlphaTurn = bannedMaps.length % 2 === 0;
  const currentTurn = isAlphaTurn ? "Equipo YonathanDHC" : "Equipo Viper_CCS";

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
          sender: isAlphaTurn ? "YonathanDHC (Capitan)" : "Viper_CCS (Capitan)",
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

    const senderName = currentPlayerProfile ? currentPlayerProfile.nickname : "YonathanDHC";

    setChatMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: senderName,
        text: msgToSend,
        time: "Ahora",
      },
    ]);

    if (!customText) {
      setChatInput("");
    }
  };

  const handleSimulateFinish = async () => {
    if (!finalMap) return;
    setSavingMatch(true);

    const roundsLoser = Math.floor(Math.random() * 10) + 2;
    const alphaWins = Math.random() > 0.5;
    const winnerTeam = alphaWins ? "Equipo YonathanDHC" : "Equipo Viper_CCS";

    await supabase.from("matches").insert([
      {
        team_a: "Equipo YonathanDHC",
        team_b: "Equipo Viper_CCS",
        selected_map: finalMap.id,
        banned_maps: bannedMaps,
        score_a: alphaWins ? 13 : roundsLoser,
        score_b: alphaWins ? roundsLoser : 13,
        status: "PREMIER 5v5",
        winner: winnerTeam,
      },
    ]);

    const captainWinner = alphaWins ? "YonathanDHC" : "Viper_CCS";
    const captainLoser = alphaWins ? "Viper_CCS" : "YonathanDHC";

    const winnerRow = leaderboard.find((p) => p.nickname === captainWinner);
    const loserRow = leaderboard.find((p) => p.nickname === captainLoser);

    if (winnerRow) {
      await supabase
        .from("leaderboard_players")
        .update({ elo: winnerRow.elo + 25, wins: winnerRow.wins + 1 })
        .eq("id", winnerRow.id);
    }

    if (loserRow) {
      await supabase
        .from("leaderboard_players")
        .update({ elo: Math.max(100, loserRow.elo - 15), losses: loserRow.losses + 1 })
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

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#c7d5e0]">
            <a href="#lobby" className="hover:text-[#66c0f4] transition">
              Solo Queue & Veto
            </a>
            <a href="#resultados" className="hover:text-[#66c0f4] transition">
              Partidas del Dia (Max 6)
            </a>
            <a href="#premios" className="hover:text-[#FF5500] transition">
              Leaderboard & Skins
            </a>
          </nav>

          {loggedSteamId ? (
            <div className="flex items-center gap-2">
              <div className="px-3.5 py-2 rounded-sm bg-[#1b2838] border border-[#a4d007]/60 text-xs font-bold text-white flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#a4d007]"></span>
                {currentPlayerProfile ? (
                  <div className="flex items-center gap-2">
                    <span className="text-white font-black">{currentPlayerProfile.nickname}</span>
                    <span className="px-1.5 py-0.5 rounded-sm bg-[#171a21] border border-[#66c0f4]/40 text-[#66c0f4] font-mono text-[11px]">
                      {currentPlayerProfile.elo} ELO
                    </span>
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
            ? `SOLO QUEUE PREMIER ACTIVO | JUGADOR: ${currentPlayerProfile.nickname.toUpperCase()} (${currentPlayerProfile.elo} ELO)`
            : loggedSteamId
            ? `CUENTA STEAM VERIFICADA (ID: ${loggedSteamId}) | LISTO PARA BUSCAR PARTIDA`
            : "MODO PREMIER SOLO QUEUE 5v5 | EMPAREJAMIENTO AUTOMATICO POR ELO"}
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none text-white mb-6">
          ENTRA SOLO, VETA EL MAPA <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#66c0f4] via-[#c7d5e0] to-[#FF5500]">
            Y COMPITE EN PREMIER LATAM
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-[#8f98a0] text-lg md:text-xl mb-10 leading-relaxed">
          No necesitas tener un equipo armado. Busca partida individualmente, comunicate por el chat del lobby para vetar mapas y sube tu propio ELO por premios en{" "}
          <span className="text-white font-semibold border-b border-[#FF5500]">
            Skins de CS2 y USDT
          </span>
          .
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#lobby"
            onClick={handleStartSoloQueue}
            className="w-full sm:w-auto bg-gradient-to-r from-[#a4d007] to-[#7aa600] hover:brightness-110 text-[#171a21] font-black px-8 py-4 rounded-sm text-base tracking-wide transition shadow-xl shadow-[#a4d007]/20 cursor-pointer"
          >
            BUSCAR PARTIDA 5v5 (SOLO QUEUE)
          </a>
          <button
            onClick={() => {
              setRegistered(false);
              setErrorMsg(null);
              setModalOpen(true);
            }}
            className="w-full sm:w-auto px-8 py-4 rounded-sm border border-[#2a475e] hover:border-[#FF5500] bg-[#1b2838]/80 hover:bg-[#2a475e]/50 text-white font-bold text-base transition cursor-pointer"
          >
            REGISTRO DE FUNDADORES
          </button>
        </div>

        {/* SECCION 1: SALA PREMIER 5v5 (10 JUGADORES + VETO + CHAT DE EQUIPO) */}
        <section id="lobby" className="mt-24 text-left">
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
            {/* Cabecera Dinamica de los 2 Bandos de Desconocidos (5 vs 5) + Reloj Central */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start mb-8 pb-6 border-b border-[#2a475e]/60">
              {/* BANDO 1: EQUIPO YONATHANDHC (5 JUGADORES INDIVIDUALES) */}
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
                        EQUIPO YONATHANDHC
                      </div>
                      <span className="text-[10px] text-[#66c0f4] font-bold">
                        5 Jugadores Individuales | ELO Promedio: 2,042
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

                {/* Lista de los 5 Jugadores Emparejados */}
                <div className="space-y-1.5">
                  {TEAM_ALPHA_ROSTER.map((p, idx) => (
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
                          <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#66c0f4]/20 text-[#66c0f4] font-black">
                            CAPITAN VETO
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-[#66c0f4] font-bold">
                        {p.elo} ELO
                      </span>
                    </div>
                  ))}
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
                    <p className="text-[11px] text-[#8f98a0] mt-2">
                      Emparejando jugadores por rango de ELO y latencia en Miami...
                    </p>
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

              {/* BANDO 2: EQUIPO VIPER_CCS (5 JUGADORES INDIVIDUALES) */}
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
                        5 Jugadores Individuales | ELO Promedio: 2,046
                      </span>
                    </div>
                    <span className="w-8 h-8 rounded-sm bg-[#FF5500]/20 border border-[#FF5500] flex items-center justify-center font-black text-xs text-[#FF5500]">
                      TT
                    </span>
                  </div>
                </div>

                {/* Lista de los 5 Jugadores Emparejados */}
                <div className="space-y-1.5">
                  {TEAM_OMEGA_ROSTER.map((p, idx) => (
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
                            CAPITAN VETO
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-[#FF5500] font-bold">
                        {p.elo} ELO
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CUERPO DIVIDIDO: LOS 7 MAPAS A LA IZQUIERDA + CHAT DE EQUIPO A LA DERECHA */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {/* Columna Izquierda (2/3): Tarjetas de Mapas */}
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

                {/* Botones de entrada a CS2 al terminar el veto */}
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

                {/* Mensajes del Chat */}
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

                {/* Botones Rapidos de Veto + Input de Chat */}
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

        {/* SECCION 3: LEADERBOARD MENSUAL EN TIEMPO REAL DESDE SUPABASE */}
        <section id="premios" className="mt-24 text-left">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
            <div>
              <div className="text-[#FF5500] text-xs font-black uppercase tracking-widest mb-1">
                TEMPORADA FUNDADORES | RANKING INDIVIDUAL PREMIER
              </div>
              <h2 className="text-3xl font-black text-white">
                LEADERBOARD TOP ELO & RECOMPENSAS
              </h2>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 bg-[#FF5500]/15 text-[#FF5500] border border-[#FF5500]/40 rounded-sm mt-2 md:mt-0">
              BOLSA MENSUAL: SKINS CS2 + USDT
            </span>
          </div>

          <div className="overflow-x-auto rounded-sm border border-[#2a475e] bg-[#1b2838]/70">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#171a21] text-[#8f98a0] text-xs uppercase border-b border-[#2a475e]">
                  <th className="py-3.5 px-5">Posicion</th>
                  <th className="py-3.5 px-5">Jugador</th>
                  <th className="py-3.5 px-5">Rango ELO</th>
                  <th className="py-3.5 px-5">Partidas (W/L)</th>
                  <th className="py-3.5 px-5">Winrate</th>
                  <th className="py-3.5 px-5 text-right">Premio de Temporada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a475e]/40">
                {leaderboard.map((player, index) => {
                  const totalGames = player.wins + player.losses;
                  const winrate = totalGames > 0 ? Math.round((player.wins / totalGames) * 100) : 0;
                  const isMe = Boolean(loggedSteamId && player.steam_id === loggedSteamId);

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
                      <td className="py-4 px-5 text-[#66c0f4] font-mono font-bold">
                        {player.elo.toLocaleString()} ELO
                      </td>
                      <td className="py-4 px-5 text-xs font-mono text-[#c7d5e0]">
                        <span className="text-[#a4d007] font-bold">{player.wins}W</span> -{" "}
                        <span className="text-red-400">{player.losses}L</span>
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
                      placeholder="Ej. YonathanDHC o link de Steam"
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