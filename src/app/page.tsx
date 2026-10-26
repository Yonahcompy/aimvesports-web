"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const CS2_MAPS = [
  { id: "de_mirage", name: "Mirage", tag: "Cl¡sico 5v5" },
  { id: "de_inferno", name: "Inferno", tag: "Control t¡ctico" },
  { id: "de_dust2", name: "Dust II", tag: "Duelos de Aim" },
  { id: "de_nuke", name: "Nuke", tag: "Doble planta" },
  { id: "de_ancient", name: "Ancient", tag: "Selva / Medio" },
  { id: "de_anubis", name: "Anubis", tag: "Rotacin r¡pida" },
  { id: "de_vertigo", name: "Vertigo", tag: "Combate corto" },
];

interface MatchItem {
  id: number;
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
  elo: number;
  wins: number;
  losses: number;
  country: string;
  season_prize: string;
}

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const [registered, setRegistered] = useState(false);

  // Estado de sesin oficial de Steam
  const [loggedSteamId, setLoggedSteamId] = useState<string | null>(null);

  // Estados del formulario de Fundadores
  const [steamId, setSteamId] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("Venezuela (Fibra / Low-Ping)");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados de la Sala de Veto 5v5, Partidas y Leaderboard
  const [bannedMaps, setBannedMaps] = useState<string[]>([]);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [savingMatch, setSavingMatch] = useState(false);

  // Cargar resultados de partidas desde Supabase
  const fetchMatches = async () => {
    const { data } = await supabase
      .from("matches")
      .select("*")
      .order("id", { ascending: false })
      .limit(6);

    if (data) {
      setMatches(data);
    }
  };

  // Cargar Leaderboard real ordenado por ELO desde Supabase
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

    // Detectar retorno de Steam OpenID (?steam_id=7656119...)
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

  // Lgica del Veto de Mapas (Pick & Ban)
  const remainingMaps = CS2_MAPS.filter((m) => !bannedMaps.includes(m.id));
  const finalMap = remainingMaps.length === 1 ? remainingMaps[0] : null;
  const currentTurn = bannedMaps.length % 2 === 0 ? "Equipo Alpha" : "Equipo Omega";

  const handleBanMap = (mapId: string) => {
    if (finalMap || bannedMaps.includes(mapId)) return;
    setBannedMaps([...bannedMaps, mapId]);
  };

  const resetVeto = () => {
    setBannedMaps([]);
  };

  // Registrar resultado de partida y actualizar ELO en vivo en Supabase
  const handleSimulateFinish = async () => {
    if (!finalMap) return;
    setSavingMatch(true);

    const roundsLoser = Math.floor(Math.random() * 10) + 2;
    const alphaWins = Math.random() > 0.5;
    const winnerTeam = alphaWins ? "Equipo Alpha (YonathanDHC)" : "Equipo Omega (Viper_CCS)";

    await supabase.from("matches").insert([
      {
        team_a: "Equipo Alpha",
        team_b: "Equipo Omega",
        selected_map: finalMap.id,
        banned_maps: bannedMaps,
        score_a: alphaWins ? 13 : roundsLoser,
        score_b: alphaWins ? roundsLoser : 13,
        status: "FINALIZADA",
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
        setErrorMsg("Este correo electrnico ya est¡ registrado en la lista de fundadores.");
      } else {
        setErrorMsg("Ocurri un error al registrar tu solicitud. Intenta nuevamente.");
      }
      return;
    }

    setRegistered(true);
    setEmail("");
  };

  return (
    <div className="min-h-screen bg-[#171a21] text-[#c7d5e0] font-sans selection:bg-[#66c0f4] selection:text-[#171a21] relative overflow-x-hidden">
      {/* Luces ambientales estilo Steam + AimVe */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-tr from-[#1b2838] via-[#66c0f4]/15 to-[#FF5500]/10 blur-[130px] rounded-full" />

      {/* Barra de Navegacin Superior (Header) */}
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
              Lobby & Map Veto
            </a>
            <a href="#resultados" className="hover:text-[#66c0f4] transition">
              Resultados en Vivo
            </a>
            <a href="#premios" className="hover:text-[#FF5500] transition">
              Leaderboard & Skins
            </a>
          </nav>

          {loggedSteamId ? (
            <div className="flex items-center gap-2">
              <div className="px-3.5 py-2 rounded-sm bg-[#1b2838] border border-[#a4d007]/60 text-xs font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#a4d007]"></span>
                <span>STEAM: ...{loggedSteamId.slice(-6)}</span>
              </div>
              <button
                onClick={handleLogoutSteam}
                title="Cerrar sesin de Steam"
                className="px-2.5 py-2 rounded-sm bg-[#1b2838] hover:bg-red-950/60 border border-[#2a475e] hover:border-red-500/50 text-xs text-[#8f98a0] hover:text-red-300 font-bold transition cursor-pointer"
              >
                
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

      {/* Seccin Principal (Hero) */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-24 text-center relative z-10">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-sm bg-[#1b2838] border border-[#2a475e] text-xs font-bold text-[#66c0f4] mb-8 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-[#a4d007] animate-pulse"></span>
          {loggedSteamId
            ? `CUENTA STEAM VERIFICADA (ID: ${loggedSteamId})  LISTO PARA COMPETIR`
            : "MATCHMAKING WEB AUTOMATIZADO  35-55 MS LOW-PING"}
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none text-white mb-6">
          EL CIRCUITO COMPETITIVO <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#66c0f4] via-[#c7d5e0] to-[#FF5500]">
            DE CS2 PARA LATAM
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-[#8f98a0] text-lg md:text-xl mb-10 leading-relaxed">
          Veto de mapas directamente en la web, lanzamiento autom¡tico de CS2 sin usar consola, registro de marcadores en tiempo real y premios en{" "}
          <span className="text-white font-semibold border-b border-[#FF5500]">
            Skins de CS2 y USDT
          </span>
          .
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => {
              setRegistered(false);
              setErrorMsg(null);
              setModalOpen(true);
            }}
            className="w-full sm:w-auto bg-gradient-to-r from-[#FF5500] to-[#e03e00] hover:from-[#ff6a1f] hover:to-[#ff4500] text-white font-black px-8 py-4 rounded-sm text-base tracking-wide transition shadow-xl shadow-[#FF5500]/25 border border-orange-400/30 cursor-pointer"
          >
            ENTRAR AL ACCESO ANTICIPADO
          </button>
          <a
            href="#lobby"
            className="w-full sm:w-auto px-8 py-4 rounded-sm border border-[#2a475e] hover:border-[#66c0f4] bg-[#1b2838]/80 hover:bg-[#2a475e]/50 text-white font-bold text-base transition"
          >
            PROBAR SALA DE VETO 5v5
          </a>
        </div>

        {/* SECCIN 1: SALA INTERACTIVA DE MATCHMAKING Y VETO DE MAPAS */}
        <section id="lobby" className="mt-24 text-left">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
            <div>
              <div className="text-[#66c0f4] text-xs font-black uppercase tracking-widest mb-1">
                LOBBY COMPETITIVO 5v5  PICK & BAN EN VIVO
              </div>
              <h2 className="text-3xl font-black text-white">
                SALA DE PARTIDA & SELECCIN DE MAPA
              </h2>
            </div>
            <div className="mt-3 md:mt-0 flex items-center gap-3">
              <span className="text-xs px-3 py-1.5 rounded-sm bg-[#1b2838] border border-[#2a475e] text-[#c7d5e0] font-bold">
                {finalMap
                  ? ` MAPA ELEGIDO: ${finalMap.name.toUpperCase()}`
                  : `TURNO DE BANEO: ${currentTurn.toUpperCase()}`}
              </span>
              {bannedMaps.length > 0 && (
                <button
                  onClick={resetVeto}
                  className="text-xs px-3 py-1.5 rounded-sm bg-[#2a475e]/60 hover:bg-[#2a475e] text-white font-bold transition cursor-pointer"
                >
                  Reiniciar Veto
                </button>
              )}
            </div>
          </div>

          <div className="p-6 rounded-sm bg-[#1b2838]/90 border border-[#2a475e] shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center mb-8 pb-6 border-b border-[#2a475e]/60">
              <div className="flex items-center justify-between md:justify-start gap-4">
                <div className="w-12 h-12 rounded-sm bg-[#66c0f4]/15 border border-[#66c0f4] flex items-center justify-center font-black text-[#66c0f4]">
                  CT
                </div>
                <div>
                  <div className="text-white font-black text-lg">EQUIPO ALPHA</div>
                  <div className="text-xs text-[#66c0f4] font-bold">Capit¡n: YonathanDHC  5/5 Listos</div>
                </div>
              </div>

              <div className="text-center">
                {!finalMap ? (
                  <div className="inline-block px-4 py-1.5 rounded-sm bg-[#FF5500]/15 border border-[#FF5500]/40 text-[#FF5500] text-xs font-black tracking-wider uppercase">
                    Haz clic en los mapas para descartarlos ({bannedMaps.length}/6 baneados)
                  </div>
                ) : (
                  <div className="inline-block px-4 py-1.5 rounded-sm bg-[#a4d007]/20 border border-[#a4d007] text-[#a4d007] text-xs font-black tracking-wider uppercase">
                    Servidor Configurado  Listo para ingresar
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between md:justify-end gap-4">
                <div className="text-left md:text-right">
                  <div className="text-white font-black text-lg">EQUIPO OMEGA</div>
                  <div className="text-xs text-[#FF5500] font-bold">Capit¡n: Viper_CCS  5/5 Listos</div>
                </div>
                <div className="w-12 h-12 rounded-sm bg-[#FF5500]/15 border border-[#FF5500] flex items-center justify-center font-black text-[#FF5500]">
                  TT
                </div>
              </div>
            </div>

            {/* Cuadrcula de los 7 Mapas de CS2 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
              {CS2_MAPS.map((map) => {
                const isBanned = bannedMaps.includes(map.id);
                const isWinner = finalMap?.id === map.id;

                return (
                  <button
                    key={map.id}
                    onClick={() => handleBanMap(map.id)}
                    disabled={isBanned || Boolean(finalMap)}
                    className={`p-4 rounded-sm border text-left transition flex flex-col justify-between h-32 relative overflow-hidden ${
                      isBanned
                        ? "bg-[#111318]/90 border-red-900/50 opacity-45 cursor-not-allowed"
                        : isWinner
                        ? "bg-gradient-to-b from-[#a4d007]/25 to-[#171a21] border-[#a4d007] shadow-lg shadow-[#a4d007]/20"
                        : "bg-[#171a21] border-[#2a475e] hover:border-[#FF5500] cursor-pointer group"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                      <span className="text-[#8f98a0]">{map.id}</span>
                      {isBanned && <span className="text-red-400">VETADO </span>}
                      {isWinner && <span className="text-[#a4d007]">ACTIVO </span>}
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
                      <div className="text-[10px] font-bold text-[#FF5500] opacity-0 group-hover:opacity-100 transition">
                        Clic para banear 
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Panel de Accin cuando queda 1 solo mapa elegido */}
            {finalMap && (
              <div className="mt-8 p-5 rounded-sm bg-[#171a21] border border-[#a4d007]/60 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-black text-[#a4d007] uppercase tracking-wider">
                    MAPA DEFINITIVO: {finalMap.name.toUpperCase()} ({finalMap.id})
                  </div>
                  <p className="text-xs text-[#8f98a0] mt-1">
                    El servidor de Miami ya carg el mapa. Ingresa con un clic sin abrir consola o registra el resultado para actualizar el ELO.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                  <a
                    href="steam://connect/mia1.aimvesports.com:27015"
                    className="w-full sm:w-auto text-center px-6 py-3 rounded-sm bg-gradient-to-r from-[#a4d007] to-[#7aa600] hover:brightness-110 text-[#171a21] font-black text-xs uppercase tracking-wider transition"
                  >
                     ENTRAR A LA PARTIDA (ABRIR CS2)
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
        </section>

        {/* SECCIN 2: RESULTADOS DE PARTIDAS EN VIVO */}
        <section id="resultados" className="mt-24 text-left">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
            <div>
              <div className="text-[#a4d007] text-xs font-black uppercase tracking-widest mb-1">
                HISTORIAL OFICIAL  BASE DE DATOS EN TIEMPO REAL
              </div>
              <h2 className="text-3xl font-black text-white">
                RESULTADOS DE PARTIDAS RECIENTES
              </h2>
            </div>
            <span className="text-xs text-[#8f98a0] mt-2 md:mt-0">
              Sincronizado autom¡ticamente al finalizar cada mapa.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.map((m) => (
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

        {/* SECCIN 3: LEADERBOARD MENSUAL EN TIEMPO REAL DESDE SUPABASE */}
        <section id="premios" className="mt-24 text-left">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
            <div>
              <div className="text-[#FF5500] text-xs font-black uppercase tracking-widest mb-1">
                TEMPORADA FUNDADORES  RANKING EN VIVO
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
                  <th className="py-3.5 px-5">Posicin</th>
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

                  return (
                    <tr
                      key={player.id}
                      className={index === 0 ? "bg-gradient-to-r from-[#FF5500]/15 to-transparent" : ""}
                    >
                      <td className={`py-4 px-5 font-black ${index === 0 ? "text-[#FF5500]" : index === 1 ? "text-[#c7d5e0]" : "text-[#8f98a0]"}`}>
                        #{index + 1} {index === 0 ? "" : index === 1 ? "" : index === 2 ? "" : ""}
                      </td>
                      <td className="py-4 px-5 font-bold text-white">
                        {player.nickname}{" "}
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-sm bg-[#171a21] border border-[#2a475e] text-[#66c0f4]">
                          {player.country}
                        </span>
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

      {/* Pie de P¡gina Corporativo */}
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
              
            </button>

            {!registered ? (
              <form onSubmit={handleRegister}>
                <div className="text-xs font-black text-[#FF5500] uppercase tracking-widest mb-1">
                  LISTA DE FUNDADORES  CS2 LATAM
                </div>
                <h3 className="text-2xl font-black text-white mb-2">
                  Reserva tu Slot en AimVe
                </h3>
                <p className="text-xs text-[#8f98a0] mb-5">
                  Regstrate para recibir tu invitacin a la Beta Cerrada, insignia de Fundador y acceso a los sorteos de Skins de lanzamiento.
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
                      Correo Electrnico
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
                      Pas de Conexin
                    </label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#171a21] border border-[#2a475e] rounded-sm text-sm text-white focus:outline-none focus:border-[#66c0f4]"
                    >
                      <option value="Venezuela (Fibra / Low-Ping)">Venezuela (Fibra / Low-Ping)</option>
                      <option value="Colombia">Colombia</option>
                      <option value="Panam¡ / Caribe">Panam¡ / Caribe</option>
                      <option value="Ecuador / Per">Ecuador / Per</option>
                      <option value="Otro pas LATAM">Otro pas LATAM</option>
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
                <div className="w-12 h-12 rounded-full bg-[#a4d007]/20 border border-[#a4d007] text-[#a4d007] flex items-center justify-center mx-auto mb-4 text-xl font-black">
                  
                </div>
                <h4 className="text-xl font-black text-white mb-2">
                  ¡Solicitud Registrada!
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
