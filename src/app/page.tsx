"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  CS2_MAPS,
  PRACTICE_MODES,
  WeeklyMission,
  INITIAL_MISSIONS,
  MatchItem,
  PersistedMissionState,
  LeaderboardPlayer,
  ChatMessage,
  getInitialCalibratedElo,
  getEloTierStyle,
} from "@/lib/ranks";
import PracticeMissionsSection from "@/components/PracticeMissionsSection";
import RecentMatchesSection from "@/components/RecentMatchesSection";
import LeaderboardSection from "@/components/LeaderboardSection";

function isPlayerInMatch(matchObj: any, steamId: string | null): boolean {
  if (!matchObj || !steamId) return false;
  const sId = String(steamId);
  const inAlpha =
    Array.isArray(matchObj.team_alpha) &&
    matchObj.team_alpha.some((p: any) => String(p?.steam_id) === sId);
  const inOmega =
    Array.isArray(matchObj.team_omega) &&
    matchObj.team_omega.some((p: any) => String(p?.steam_id) === sId);
  return inAlpha || inOmega;
}

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [loggedSteamId, setLoggedSteamId] = useState<string | null>(null);
  const [loggedPlayer, setLoggedPlayer] = useState<LeaderboardPlayer | null>(null);

  const [steamId, setSteamId] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("Venezuela (Fibra / Low-Ping)");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedPractice, setSelectedPractice] = useState(PRACTICE_MODES[0]);
  const [missions, setMissions] = useState<WeeklyMission[]>(INITIAL_MISSIONS);
  const [eloShieldActive, setEloShieldActive] = useState(false);
  const [hotHandBonus, setHotHandBonus] = useState(false);
  const [missionBanner, setMissionBanner] = useState<string | null>(null);
  const [weekExpiresAt, setWeekExpiresAt] = useState<number>(0);
  const [missionsHydrated, setMissionsHydrated] = useState(false);

  const [queueSearching, setQueueSearching] = useState(false);
  const [queuedPlayers, setQueuedPlayers] = useState<any[]>([]);
  const [queueCount, setQueueCount] = useState(0);
  const [activeMatch, setActiveMatch] = useState<any>(null);

  const [bannedMaps, setBannedMaps] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [savingMatch, setSavingMatch] = useState(false);

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      sender: "SISTEMA",
      text: "Bienvenido al Lobby Premier de AimVe Sports. Usa el chat para coordinar el veto de mapas con la sala.",
      time: "Ahora",
      isSystem: true,
    },
  ]);

  const currentPlayerProfile = loggedSteamId
    ? leaderboard.find((p) => p.steam_id && p.steam_id === loggedSteamId) || loggedPlayer
    : null;

  const isAdmin = ["76561199757155122", "76561199724566305"].includes(String(loggedSteamId));
  const captainAlphaName = activeMatch?.team_alpha?.[0]?.nickname || "Capitán Alpha";

  const fetchMatches = useCallback(async () => {
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
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    const { data } = await supabase
      .from("leaderboard_players")
      .select("*")
      .order("elo", { ascending: false })
      .limit(50);

    if (data) {
      setLeaderboard(data);
      const savedSteam =
        typeof window !== "undefined" ? localStorage.getItem("aimve_steam_id") : null;
      if (savedSteam) {
        const found = data.find((p: LeaderboardPlayer) => p.steam_id === savedSteam);
        if (found) setLoggedPlayer(found);
      }
    }
  }, []);

  const fetchCola = useCallback(async () => {
    const { data } = await supabase
      .from("matchmaking_queue")
      .select("*")
      .order("joined_at", { ascending: true });
    if (data) {
      setQueuedPlayers(data);
      setQueueCount(data.length);
    }
  }, []);

  // 1. Suscripcion Unica y Filtrada a Cola y Partidas Activas
  useEffect(() => {
    fetchCola();

    const subCola = supabase
      .channel("cola_publica")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matchmaking_queue" },
        () => {
          fetchCola();
        }
      )
      .subscribe();

    const subMatches = supabase
      .channel("realtime_matches_filtered")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "active_matches" },
        (payload) => {
          const newMatch = payload.new as any;
          if (isPlayerInMatch(newMatch, loggedSteamId)) {
            setActiveMatch(newMatch);
            if (newMatch.banned_maps) setBannedMaps(newMatch.banned_maps);
            if (Array.isArray(newMatch.chat_messages) && newMatch.chat_messages.length > 0) {
              setChatMessages(newMatch.chat_messages);
            }
            setQueueSearching(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subCola);
      supabase.removeChannel(subMatches);
    };
  }, [fetchCola, loggedSteamId]);

  // 2. Restaurador de Memoria F5 (Solo recupera partidas donde participe el jugador actual)
  useEffect(() => {
    const restoreState = async () => {
      if (!loggedSteamId) return;
      const { data: matchesData } = await supabase
        .from("active_matches")
        .select("*")
        .in("status", ["ready_check", "veto", "live"]);

      if (matchesData) {
        const myMatch = matchesData.find((m: any) => isPlayerInMatch(m, loggedSteamId));
        if (myMatch) {
          setActiveMatch(myMatch);
          if (myMatch.banned_maps) setBannedMaps(myMatch.banned_maps);
          if (Array.isArray(myMatch.chat_messages) && myMatch.chat_messages.length > 0) {
            setChatMessages(myMatch.chat_messages);
          }
          setQueueSearching(false);
          return;
        }
      }

      const { data: qData } = await supabase.from("matchmaking_queue").select("*");
      if (qData && qData.some((p: any) => String(p.steam_id) === String(loggedSteamId))) {
        setQueueSearching(true);
      }
    };
    restoreState();
  }, [loggedSteamId]);

  // 3. Canal Realtime exclusivo de la sala activa del jugador
  useEffect(() => {
    if (!activeMatch?.id) return;
    const sub = supabase
      .channel("match_sync_" + activeMatch.id)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "active_matches",
          filter: "id=eq." + activeMatch.id,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated?.banned_maps) {
            setBannedMaps(updated.banned_maps);
          }
          if (Array.isArray(updated?.chat_messages) && updated.chat_messages.length > 0) {
            setChatMessages(updated.chat_messages);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [activeMatch?.id]);

  // 4. Polling Adaptativo (Punto C: 1.5s en ReadyCheck/Veto, 10s en Live, 0s en reposo)
  useEffect(() => {
    if (!activeMatch?.id) return;
    const status = activeMatch.status;
    if (!["ready_check", "veto", "live", "finishing"].includes(status)) return;

    const pollIntervalMs = status === "live" ? 10000 : 1500;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("active_matches")
        .select("*")
        .eq("id", activeMatch.id)
        .single();

      if (data) {
        if (data.status === "finished") {
          const wasReadyCheck = activeMatch.status === "ready_check";
          const userAccepted =
            Array.isArray(activeMatch.accepted_players) &&
            activeMatch.accepted_players.map(String).includes(String(loggedSteamId));

          await fetchMatches();
          await fetchLeaderboard();
          await fetchCola();
          setActiveMatch(null);
          setBannedMaps([]);

          if (wasReadyCheck) {
            setQueueSearching(userAccepted);
            setMissionBanner(
              userAccepted
                ? "Un jugador no acepto la partida a tiempo. Has sido devuelto a la cola automaticamente."
                : "No aceptaste la partida en 20 segundos. Has sido retirado de la cola."
            );
          } else {
            setQueueSearching(false);
          }
          return;
        }

        setActiveMatch(data);
        if (Array.isArray(data.chat_messages) && data.chat_messages.length > 0) {
          setChatMessages(data.chat_messages);
        }
        if (data.banned_maps) {
          setBannedMaps((prev) =>
            prev.length !== data.banned_maps.length ? data.banned_maps : prev
          );
        }
      }
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [activeMatch?.id, activeMatch?.status, loggedSteamId, fetchMatches, fetchLeaderboard, fetchCola]);

  // 5. Refresco Ligero de Historial y Leaderboard en reposo (Cada 25s en vez de 2.5s -> 90% menos carga en DB)
  useEffect(() => {
    const idleSync = setInterval(() => {
      fetchMatches();
      fetchLeaderboard();
      if (queueSearching && !activeMatch) {
        fetchCola();
      }
    }, 25000);
    return () => clearInterval(idleSync);
  }, [fetchMatches, fetchLeaderboard, fetchCola, queueSearching, activeMatch]);

  // Anti-Fantasmas al cerrar pestaña
  useEffect(() => {
    const handleUnload = () => {
      if (loggedSteamId && !activeMatch) {
        navigator.sendBeacon("/api/queue?leave_steam_id=" + loggedSteamId);
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [loggedSteamId, activeMatch]);

  // Hidratar misiones
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storageKey = `aimve_missions_${loggedSteamId || "guest"}`;
    const dbState = currentPlayerProfile?.mission_data;
    const localRaw = localStorage.getItem(storageKey);
    let localState: PersistedMissionState | null = null;

    if (localRaw) {
      try {
        localState = JSON.parse(localRaw);
      } catch {}
    }

    const chosen = dbState && dbState.missions ? dbState : localState;
    if (chosen && chosen.missions) {
      setMissions(chosen.missions);
      setEloShieldActive(Boolean(chosen.eloShieldActive));
      setHotHandBonus(Boolean(chosen.hotHandBonus));
      const exp =
        chosen.weekExpiresAt && chosen.weekExpiresAt > Date.now()
          ? chosen.weekExpiresAt
          : Date.now() + 7 * 86400 * 1000;
      setWeekExpiresAt(exp);
    } else {
      const newExp = Date.now() + 7 * 86400 * 1000;
      setMissions(INITIAL_MISSIONS);
      setEloShieldActive(false);
      setHotHandBonus(false);
      setWeekExpiresAt(newExp);
    }
    setMissionsHydrated(true);
  }, [loggedSteamId, currentPlayerProfile?.id]);

  // Guardar misiones
  useEffect(() => {
    if (!missionsHydrated || typeof window === "undefined") return;
    const storageKey = `aimve_missions_${loggedSteamId || "guest"}`;
    const stateToSave: PersistedMissionState = {
      missions,
      eloShieldActive,
      hotHandBonus,
      weekExpiresAt,
    };
    localStorage.setItem(storageKey, JSON.stringify(stateToSave));

    if (currentPlayerProfile?.id) {
      supabase
        .from("leaderboard_players")
        .update({
          mission_data: stateToSave,
          elo_shield: eloShieldActive,
          hot_hand_bonus: hotHandBonus,
        })
        .eq("id", currentPlayerProfile.id)
        .then(() => {});
    }
  }, [missions, eloShieldActive, hotHandBonus, weekExpiresAt, missionsHydrated, loggedSteamId, currentPlayerProfile?.id]);

  // Login inicial de Steam
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
        })
          .then((res) => res.json())
          .then((resData) => {
            if (resData && resData.player) {
              setLoggedPlayer(resData.player);
            }
            fetchLeaderboard();
          });
      }
    }
  }, [fetchMatches, fetchLeaderboard]);

  const handleLogoutSteam = () => {
    if (loggedSteamId) {
      fetch(`/api/queue?steam_id=${loggedSteamId}`, { method: "DELETE" }).catch(() => {});
    }
    localStorage.removeItem("aimve_steam_id");
    setLoggedSteamId(null);
    setLoggedPlayer(null);
    setSteamId("");
  };

  const handleClaimMission = useCallback(
    async (missionId: string) => {
      const targetMission = missions.find((m) => m.id === missionId);
      if (!targetMission || targetMission.claimed || targetMission.current < targetMission.goal)
        return;

      setMissions((prev) =>
        prev.map((m) => (m.id === missionId ? { ...m, claimed: true } : m))
      );

      if (missionId === "m_aimbotz") setHotHandBonus(true);
      if (missionId === "m_retakes") setEloShieldActive(true);

      if (currentPlayerProfile) {
        const totalPlayed = currentPlayerProfile.wins + currentPlayerProfile.losses;
        if (totalPlayed < 6) {
          setMissionBanner(
            `Mision completada (${targetMission.title}): Bono especial activado. Para sumar +${targetMission.eloReward} ELO directos debes completar primero tus 6 partidas de calibracion (${totalPlayed}/6).`
          );
          return;
        }
        await fetch("/api/elo-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "mission_claim",
            player_id: currentPlayerProfile.id,
            mission_reward: targetMission.eloReward,
          }),
        });
        await fetchLeaderboard();
      }

      setMissionBanner(
        `Mision completada: +${targetMission.eloReward} ELO acreditados a tu perfil (${targetMission.title}).`
      );
    },
    [missions, currentPlayerProfile, fetchLeaderboard]
  );

  const handleAdvanceMissionProgress = useCallback(
    (missionId: string) => {
      const target = missions.find((m) => m.id === missionId);
      setMissions((prev) =>
        prev.map((m) =>
          m.id === missionId ? { ...m, current: m.goal, penalized: false } : m
        )
      );
      if (loggedSteamId && target) {
        fetch("/api/practice-webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            steam_id: loggedSteamId,
            mode_id: target.modeId,
            amount: target.goal,
          }),
        }).catch(() => {});
      }
    },
    [missions, loggedSteamId]
  );

  const handleExpireWeekCheck = useCallback(async () => {
    const incomplete = missions.filter((m) => m.current < m.goal && !m.penalized);
    if (incomplete.length === 0) {
      setMissionBanner(
        "Corte de 7 dias verificado: Completaste todas tus misiones semanales. 0 penalizaciones de ELO!"
      );
      return;
    }

    const totalPenalty = incomplete.reduce((acc, m) => acc + m.eloPenalty, 0);
    setMissions((prev) =>
      prev.map((m) => (m.current < m.goal ? { ...m, penalized: true } : m))
    );

    if (currentPlayerProfile) {
      const totalPlayed = currentPlayerProfile.wins + currentPlayerProfile.losses;
      if (totalPlayed >= 6) {
        await fetch("/api/elo-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "weekly_penalty",
            player_id: currentPlayerProfile.id,
            penalty_amount: totalPenalty,
          }),
        });
        await fetchLeaderboard();
      }
    }

    setMissionBanner(
      `Plazo de 7 dias vencido: Se descontaron -${totalPenalty} ELO (-13 ELO por cada una de las ${incomplete.length} misiones sin completar).`
    );
  }, [missions, currentPlayerProfile, fetchLeaderboard]);

  const handleStartSoloQueue = async () => {
    if (!loggedSteamId) {
      setMissionBanner("Debes conectar tu cuenta de Steam arriba a la derecha antes de entrar a la cola.");
      return;
    }
    setQueueSearching(true);
    setBannedMaps([]);
    setTimeLeft(15);

    try {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steam_id: loggedSteamId,
          nickname: currentPlayerProfile ? currentPlayerProfile.nickname : "Jugador",
          elo: currentPlayerProfile ? currentPlayerProfile.elo : 0,
          country: currentPlayerProfile ? currentPlayerProfile.country : "VE",
        }),
      });
      const data = await res.json();
      if (data?.status === "matched" && data?.match) {
        setActiveMatch(data.match);
        setQueueSearching(false);
      } else if (Array.isArray(data?.queue)) {
        setQueuedPlayers(data.queue);
        setQueueCount(data.queue.length);
      }
    } catch {}
  };

  const isAlphaTurn = bannedMaps.length % 2 === 0;
  const currentTurn = isAlphaTurn ? "EQUIPO ALPHA" : "EQUIPO OMEGA";
  const finalMap =
    bannedMaps.length >= 6 ? CS2_MAPS.find((m) => !bannedMaps.includes(m.id)) : null;

  // Reloj Maestro (Solo corre cuando hay Ready Check o Veto activo)
  useEffect(() => {
    if (!activeMatch || (activeMatch.status !== "veto" && activeMatch.status !== "ready_check"))
      return;

    const t = setInterval(() => {
      if (activeMatch.turn_expires_at) {
        const exp = new Date(activeMatch.turn_expires_at).getTime();
        const remaining = Math.max(0, Math.floor((exp - Date.now()) / 1000));
        setTimeLeft(remaining);

        if (remaining === 0) {
          if (activeMatch.status === "ready_check") {
            fetch("/api/match-veto", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ match_id: activeMatch.id, action: "ready_timeout" }),
            }).catch(() => {});
          } else if (activeMatch.status === "veto") {
            fetch("/api/match-veto", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ match_id: activeMatch.id, is_timeout: true }),
            }).catch(() => {});
          }
        }
      }
    }, 1000);
    return () => clearInterval(t);
  }, [activeMatch]);

  // Alerta Sonora Competitiva en Ready Check
  useEffect(() => {
    if (activeMatch?.status === "ready_check") {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.14);
            gain.gain.setValueAtTime(0.22, ctx.currentTime + idx * 0.14);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.14 + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + idx * 0.14);
            osc.stop(ctx.currentTime + idx * 0.14 + 0.35);
          });
        }
      } catch {}
    }
  }, [activeMatch?.id, activeMatch?.status]);

  const handleAcceptMatch = async () => {
    if (!activeMatch?.id || !loggedSteamId) return;
    try {
      const res = await fetch("/api/match-veto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: activeMatch.id,
          steam_id: loggedSteamId,
          action: "accept_match",
        }),
      });
      const data = await res.json();
      if (data?.ok && data?.match) {
        setActiveMatch(data.match);
      }
    } catch {}
  };

  const handleBanMap = async (mapId: string) => {
    if (finalMap || bannedMaps.includes(mapId) || !activeMatch || activeMatch.status !== "veto")
      return;
    try {
      await fetch("/api/match-veto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: activeMatch.id,
          steam_id: loggedSteamId,
          map_id: mapId,
        }),
      });
    } catch {}
  };

  const resetVeto = () => {
    if (!isAdmin || !activeMatch?.id) return;
    fetch("/api/match-veto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ match_id: activeMatch.id, action: "reset" }),
    }).catch(() => {});
    setBannedMaps([]);
    setTimeLeft(15);
  };

  const sendChatMessage = async (customText?: string) => {
    const msgToSend = (customText ?? chatInput).trim();
    if (!msgToSend) return;

    const myRealNick =
      currentPlayerProfile?.nickname ||
      [...(activeMatch?.team_alpha || []), ...(activeMatch?.team_omega || [])].find(
        (p: any) => String(p?.steam_id) === String(loggedSteamId)
      )?.nickname ||
      "Jugador";

    const optimisticMsg: ChatMessage = {
      id: Date.now(),
      sender: myRealNick,
      text: msgToSend,
      time: "Ahora",
    };

    setChatMessages((prev) => [...prev, optimisticMsg]);
    if (!customText) {
      setChatInput("");
    }

    if (activeMatch?.id) {
      try {
        const res = await fetch("/api/match-veto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            match_id: activeMatch.id,
            action: "chat",
            sender: myRealNick,
            text: msgToSend,
          }),
        });
        const data = await res.json();
        if (data?.ok && Array.isArray(data?.match?.chat_messages)) {
          setChatMessages(data.match.chat_messages);
        }
      } catch {}
    }
  };

  const handleSimulateFinish = async () => {
    if (!isAdmin || !finalMap || !activeMatch?.id || savingMatch) return;
    setSavingMatch(true);

    try {
      const lockRes = await fetch("/api/match-veto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: activeMatch.id, action: "lock_finish" }),
      });
      const lockData = await lockRes.json();

      if (!lockData?.ok) {
        setActiveMatch(null);
        setBannedMaps([]);
        await fetchMatches();
        await fetchLeaderboard();
        setSavingMatch(false);
        return;
      }

      const omegaCapName = activeMatch?.team_omega?.[0]?.nickname || "Omega";
      const roundsLoser = Math.floor(Math.random() * 10) + 2;
      const alphaWins = Math.random() > 0.5;
      const winnerTeam = alphaWins ? `Equipo ${captainAlphaName}` : `Equipo ${omegaCapName}`;

      await supabase.from("matches").insert([
        {
          team_a: `Equipo ${captainAlphaName}`,
          team_b: `Equipo ${omegaCapName}`,
          selected_map: finalMap.id,
          banned_maps: bannedMaps,
          score_a: alphaWins ? 13 : roundsLoser,
          score_b: alphaWins ? roundsLoser : 13,
          status: "PREMIER 5v5",
          winner: `${winnerTeam} (+25 ELO)`,
        },
      ]);

      const winnerRow = alphaWins
        ? currentPlayerProfile
        : leaderboard.find((p) => p.nickname === omegaCapName);
      const loserRow = alphaWins
        ? leaderboard.find((p) => p.nickname === omegaCapName)
        : currentPlayerProfile;

      if (winnerRow) {
        const newWins = winnerRow.wins + 1;
        const newTotal = newWins + winnerRow.losses;
        const stompBonus = roundsLoser <= 4 ? 4 : 0;
        const warmupBonus = alphaWins && hotHandBonus ? 10 : 0;

        const nextElo =
          newTotal < 6
            ? 0
            : newTotal === 6
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
          newTotal < 6
            ? 0
            : newTotal === 6
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

      if (loggedSteamId) {
        await fetch(`/api/queue?steam_id=${loggedSteamId}`, { method: "DELETE" }).catch(() => {});
      }

      await fetch("/api/match-veto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: activeMatch.id, action: "finish" }),
      });

      await fetchMatches();
      await fetchLeaderboard();
      setActiveMatch(null);
      setBannedMaps([]);
    } finally {
      setSavingMatch(false);
    }
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

      {/* Header */}
      <header className="border-b border-[#2a475e]/60 bg-[#171a21]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3.5 group cursor-pointer">
            <div className="w-16 h-16 rounded-sm border border-[#2a475e] bg-[#171a21] flex items-center justify-center p-1 shadow-md">
              <img src="/logos.png" alt="AimVe Sports Logo" className="w-full h-full object-contain" />
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
              Practica &amp; Misiones (7d)
            </a>
            <a href="#lobby" className="hover:text-[#66c0f4] transition">
              Solo Queue &amp; Veto
            </a>
            <a href="#resultados" className="hover:text-[#66c0f4] transition">
              Partidas del Dia
            </a>
            <a href="#premios" className="hover:text-[#FF5500] transition">
              Rangos ELO &amp; Skins
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
                      {currentPlayerProfile.wins + currentPlayerProfile.losses < 6
                        ? `CALIBRANDO (${currentPlayerProfile.wins + currentPlayerProfile.losses}/6)`
                        : `${currentPlayerProfile.elo} ELO`}
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

      <main className="max-w-7xl mx-auto px-6 pt-20 pb-24 text-center relative z-10">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-sm bg-[#1b2838] border border-[#2a475e] text-xs font-bold text-[#66c0f4] mb-8 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-[#a4d007] animate-pulse"></span>
          {currentPlayerProfile
            ? `JUGADOR VERIFICADO: ${currentPlayerProfile.nickname.toUpperCase()} (${
                currentPlayerProfile.wins + currentPlayerProfile.losses < 6
                  ? `CALIBRANDO ${currentPlayerProfile.wins + currentPlayerProfile.losses}/6`
                  : `${currentPlayerProfile.elo} ELO`
              }) | MISIONES SEMANALES ACTIVAS`
            : "CALIBRACION DE 6 PARTIDAS (25-100 ELO) | MISIONES DE PRACTICA CADA 7 DIAS"}
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none text-white mb-6">
          ENTRA SOLO, VETA EL MAPA <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#66c0f4] via-[#c7d5e0] to-[#FF5500]">
            Y COMPITE EN PREMIER LATAM
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-[#8f98a0] text-lg md:text-xl mb-10 leading-relaxed">
          Completa tus <span className="text-white font-semibold">6 partidas de calibracion</span> (25 a 100 ELO inicial), cumple tus{" "}
          <span className="text-[#a4d007] font-semibold">Misiones Semanales en el Mapa de Practica</span> (7 dias de plazo o{" "}
          <span className="text-red-400 font-bold">-13 ELO</span> por mision incompleta) y brilla hasta{" "}
          <span className="text-yellow-300 font-bold">5,000+ Leyenda</span>.
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
            MAPA DE PRACTICA &amp; MISIONES (7D)
          </a>
        </div>

        {/* COMPONENTE MODULAR 1: PRACTICA & MISIONES (Aisla el reloj semanal) */}
        <PracticeMissionsSection
          selectedPractice={selectedPractice}
          setSelectedPractice={setSelectedPractice}
          missions={missions}
          weekExpiresAt={weekExpiresAt}
          missionBanner={missionBanner}
          setMissionBanner={setMissionBanner}
          handleExpireWeekCheck={handleExpireWeekCheck}
          handleClaimMission={handleClaimMission}
          handleAdvanceMissionProgress={handleAdvanceMissionProgress}
          isAdmin={isAdmin}
        />

        {/* SECCION LOBBY 5v5, READY CHECK, VETO & CHAT */}
        <section id="lobby" className="mt-20 text-left">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
            <div>
              <div className="text-[#66c0f4] text-xs font-black uppercase tracking-widest mb-1">
                MODO PREMIER SOLO QUEUE | 10 JUGADORES EMPAREJADOS POR ELO
              </div>
              <h2 className="text-3xl font-black text-white">
                SALA DE PARTIDA, VETO &amp; CHAT DE EQUIPO
              </h2>
            </div>
            <div className="mt-3 md:mt-0 flex flex-wrap items-center gap-3">
              <button
                onClick={handleStartSoloQueue}
                disabled={!!activeMatch}
                className="text-xs px-3.5 py-1.5 rounded-sm bg-[#a4d007] hover:brightness-110 text-[#171a21] font-black uppercase transition cursor-pointer"
              >
                {activeMatch
                  ? "PARTIDA EN CURSO"
                  : queueSearching
                  ? `Buscando Jugadores (${queueCount}/10)...`
                  : "Buscar Nueva Partida Solo Q"}
              </button>
              {activeMatch && (
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
                    : activeMatch.status === "ready_check"
                    ? `ACEPTAR PARTIDA (${timeLeft}s)`
                    : `TURNO ACTIVO: ${currentTurn} (${timeLeft}s)`}
                </span>
              )}
              {isAdmin && activeMatch && (
                <button
                  onClick={resetVeto}
                  className="text-xs px-3 py-1.5 rounded-sm bg-[#2a475e]/60 hover:bg-[#2a475e] text-white font-bold transition cursor-pointer"
                >
                  Reiniciar Veto (Admin)
                </button>
              )}
            </div>
          </div>

          <div className="p-6 rounded-sm bg-[#1b2838]/90 border border-[#2a475e] shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start mb-8 pb-6 border-b border-[#2a475e]/60">
              {/* BANDO ALPHA */}
              <div
                className={`p-4 rounded-sm border transition-all duration-300 ${
                  !activeMatch || finalMap
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
                        {activeMatch ? "EQUIPO ALPHA" : "EN COLA (1-5)"}
                      </div>
                      <span className="text-[10px] text-[#66c0f4] font-bold">
                        5 Jugadores Individuales | Solo Queue
                      </span>
                    </div>
                  </div>
                  {!finalMap && (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-sm ${
                        activeMatch?.status === "veto" && isAlphaTurn
                          ? "bg-[#66c0f4] text-[#171a21] animate-pulse"
                          : "bg-[#171a21] text-[#8f98a0] border border-[#2a475e]"
                      }`}
                    >
                      {activeMatch?.status === "veto"
                        ? isAlphaTurn
                          ? "VETANDO AHORA"
                          : "EN ESPERA"
                        : activeMatch?.status === "ready_check"
                        ? "CONFIRMANDO"
                        : "EN COLA"}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {(
                    activeMatch?.team_alpha?.map((pl: any, idx: number) => ({
                      nick: pl.nickname,
                      elo: pl.elo,
                      country: pl.country || "VE",
                      role: idx === 0 ? "CAPITAN" : undefined,
                    })) ||
                    Array.from({ length: 5 }).map((_, i) =>
                      queuedPlayers[i]
                        ? {
                            nick: queuedPlayers[i].nickname,
                            elo: queuedPlayers[i].elo,
                            country: queuedPlayers[i].country || "VE",
                          }
                        : { nick: "ESPERANDO...", elo: 0 }
                    )
                  ).map((p: any, idx: number) => {
                    const style = getEloTierStyle(p.elo, 6);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-sm bg-[#171a21]/90 border border-[#2a475e]/40 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#a4d007]"></span>
                          <span className="font-bold text-white">{p.nick}</span>
                          {p.country && (
                            <span className="text-[9px] px-1 rounded-sm bg-[#1b2838] text-[#8f98a0] border border-[#2a475e]">
                              {p.country}
                            </span>
                          )}
                          {p.role === "CAPITAN" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#66c0f4]/20 text-[#66c0f4] font-black">
                              CAPITAN
                            </span>
                          )}
                        </div>
                        <span className={`font-mono text-[10px] px-2 py-0.5 rounded-sm font-bold ${style.badgeClass}`}>
                          {p.elo} ELO
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RELOJ CENTRAL */}
              <div className="text-center flex flex-col items-center justify-center my-auto">
                {!activeMatch ? (
                  <div className="w-full max-w-xs bg-[#171a21] border border-[#a4d007] rounded-sm p-5">
                    <div className="text-xs font-black text-[#a4d007] uppercase tracking-wider animate-pulse mb-2">
                      {queueSearching ? "BUSCANDO JUGADORES EN COLA..." : "SALA EN ESPERA DE JUGADORES"}
                    </div>
                    <div className="text-3xl font-black text-white font-mono">
                      {queueCount} / 10
                    </div>
                    <p className="text-[11px] text-[#8f98a0] mt-2 mb-3">
                      Aprovecha para avanzar tus misiones semanales en el Mapa de Practica.
                    </p>
                    <a
                      href={`steam://connect/miami1.aimvesports.com:${selectedPractice.port}`}
                      className="inline-block w-full py-2 rounded-sm bg-[#66c0f4] text-[#171a21] font-black text-[11px] uppercase"
                    >
                      Ir a Practicar Mientras Carga
                    </a>
                  </div>
                ) : activeMatch?.status === "ready_check" ? (
                  <div className="w-full max-w-xs bg-[#171a21] border-2 border-[#a4d007] rounded-sm p-4 shadow-[0_0_25px_rgba(164,208,7,0.25)] text-center">
                    <div className="text-[11px] font-black text-[#a4d007] uppercase tracking-widest mb-1 animate-pulse">
                      ¡PARTIDA PREMIER ENCONTRADA!
                    </div>
                    <div className="text-[10px] text-[#8f98a0] mb-2">
                      Confirma tu asistencia antes de iniciar el veto
                    </div>
                    <div className="font-mono text-2xl font-black text-white mb-2">
                      00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}s
                    </div>
                    <div className="grid grid-cols-10 gap-1 mb-2">
                      {Array.from({ length: 10 }).map((_, idx) => {
                        const acceptedCount = Array.isArray(activeMatch?.accepted_players)
                          ? activeMatch.accepted_players.length
                          : 0;
                        return (
                          <div
                            key={idx}
                            className={`h-2 rounded-xs transition-all ${
                              idx < acceptedCount
                                ? "bg-[#a4d007] shadow-[0_0_6px_#a4d007]"
                                : "bg-[#111318] border border-[#2a475e]/60"
                            }`}
                          />
                        );
                      })}
                    </div>
                    <div className="text-[10px] font-bold text-[#c7d5e0] uppercase mb-3">
                      {Array.isArray(activeMatch?.accepted_players)
                        ? activeMatch.accepted_players.length
                        : 0}{" "}
                      / 10 Jugadores Listos
                    </div>
                    {Array.isArray(activeMatch?.accepted_players) &&
                    activeMatch.accepted_players.map(String).includes(String(loggedSteamId)) ? (
                      <div className="w-full py-2.5 rounded-sm bg-[#a4d007]/20 border border-[#a4d007] text-[#a4d007] font-black text-xs uppercase tracking-wider">
                        ✓ Partida Aceptada — Esperando...
                      </div>
                    ) : (
                      <button
                        onClick={handleAcceptMatch}
                        className="w-full py-2.5 rounded-sm bg-[#a4d007] hover:bg-[#b8e608] text-[#171a21] font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-[0_0_15px_rgba(164,208,7,0.5)]"
                      >
                        ACEPTAR PARTIDA
                      </button>
                    )}
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

              {/* BANDO OMEGA */}
              <div
                className={`p-4 rounded-sm border transition-all duration-300 ${
                  !activeMatch || finalMap
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
                        activeMatch?.status === "veto" && !isAlphaTurn
                          ? "bg-[#FF5500] text-white animate-pulse"
                          : "bg-[#171a21] text-[#8f98a0] border border-[#2a475e]"
                      }`}
                    >
                      {activeMatch?.status === "veto"
                        ? !isAlphaTurn
                          ? "VETANDO AHORA"
                          : "EN ESPERA"
                        : activeMatch?.status === "ready_check"
                        ? "CONFIRMANDO"
                        : "EN COLA"}
                    </span>
                  )}
                  <div className="flex items-center gap-2.5 ml-auto text-right">
                    <div>
                      <div className="text-white font-black text-base leading-none">
                        {activeMatch ? "EQUIPO OMEGA" : "EN COLA (6-10)"}
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
                  {(
                    activeMatch?.team_omega?.map((pl: any, idx: number) => ({
                      nick: pl.nickname,
                      elo: pl.elo,
                      country: pl.country || "VE",
                      role: idx === 0 ? "CAPITAN" : undefined,
                    })) ||
                    Array.from({ length: 5 }).map((_, i) =>
                      queuedPlayers[i + 5]
                        ? {
                            nick: queuedPlayers[i + 5].nickname,
                            elo: queuedPlayers[i + 5].elo,
                            country: queuedPlayers[i + 5].country || "VE",
                          }
                        : { nick: "ESPERANDO...", elo: 0 }
                    )
                  ).map((p: any, idx: number) => {
                    const style = getEloTierStyle(p.elo, 6);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-sm bg-[#171a21]/90 border border-[#2a475e]/40 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#a4d007]"></span>
                          <span className="font-bold text-white">{p.nick}</span>
                          {p.country && (
                            <span className="text-[9px] px-1 rounded-sm bg-[#1b2838] text-[#8f98a0] border border-[#2a475e]">
                              {p.country}
                            </span>
                          )}
                          {p.role === "CAPITAN" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-[#FF5500]/20 text-[#FF5500] font-black">
                              CAPITAN
                            </span>
                          )}
                        </div>
                        <span className={`font-mono text-[10px] px-2 py-0.5 rounded-sm font-bold ${style.badgeClass}`}>
                          {p.elo} ELO
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* PIZARRA DE 7 MAPAS + CHAT EN VIVO */}
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
                        disabled={isBanned || Boolean(finalMap) || !activeMatch || activeMatch.status !== "veto"}
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
                          <div className="text-base font-black text-white">{map.name}</div>
                          <div className="text-[11px] text-[#8f98a0]">{map.tag}</div>
                        </div>

                        {!isBanned && !isWinner && activeMatch?.status === "veto" && (
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
                        {isAdmin && (
                          <a
                            href={`/api/match-config?match_id=${activeMatch?.id || ""}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] px-2 py-0.5 rounded-sm bg-[#1b2838] border border-[#66c0f4]/50 text-[#66c0f4] hover:bg-[#66c0f4] hover:text-[#171a21] transition"
                          >
                            Ver JSON MatchZy
                          </a>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <code className="text-[11px] px-2 py-0.5 rounded-sm bg-[#111318] border border-[#2a475e] text-[#c7d5e0] font-mono">
                          {activeMatch?.server_connect || "connect miami1.aimvesports.com:27025"}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              activeMatch?.server_connect || "connect miami1.aimvesports.com:27025"
                            );
                          }}
                          className="text-[10px] px-2 py-0.5 rounded-sm bg-[#2a475e] hover:bg-[#66c0f4] hover:text-[#171a21] text-white font-bold transition cursor-pointer"
                        >
                          Copiar IP Consola
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                      <a
                        href={`steam://connect/${(
                          activeMatch?.server_connect || "miami1.aimvesports.com:27025"
                        )
                          .replace("connect ", "")
                          .trim()}`}
                        className="w-full sm:w-auto text-center px-6 py-3 rounded-sm bg-gradient-to-r from-[#a4d007] to-[#7aa600] hover:brightness-110 text-[#171a21] font-black text-xs uppercase tracking-wider transition"
                      >
                        &gt; ENTRAR A LA PARTIDA (ABRIR CS2)
                      </a>
                      {isAdmin && (
                        <button
                          onClick={handleSimulateFinish}
                          disabled={savingMatch}
                          className="w-full sm:w-auto px-5 py-3 rounded-sm bg-[#2a475e] hover:bg-[#66c0f4] hover:text-[#171a21] text-white font-black text-xs uppercase tracking-wider transition cursor-pointer"
                        >
                          {savingMatch ? "ACTUALIZANDO ELO..." : "FINALIZAR Y SUBIR RESULTADO"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* CHAT DEL LOBBY */}
              <div className="bg-[#171a21] border border-[#2a475e] rounded-sm flex flex-col justify-between h-full min-h-[290px]">
                <div className="px-4 py-2.5 border-b border-[#2a475e] flex items-center justify-between bg-[#111318]">
                  <span className="text-xs font-black uppercase tracking-wider text-[#66c0f4]">
                    CHAT DEL LOBBY (SALA ACTIVA)
                  </span>
                  <span className="text-[10px] font-bold text-[#a4d007]">
                    {activeMatch ? "10 en Sala" : `${queueCount} en Cola`}
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
                      placeholder="Escribe a la sala que mapa vetar..."
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

        {/* COMPONENTE MODULAR 2: RESULTADOS RECIENTES */}
        <RecentMatchesSection matches={matches} />

        {/* COMPONENTE MODULAR 3: LEADERBOARD TOP ELO */}
        <LeaderboardSection leaderboard={leaderboard} loggedSteamId={loggedSteamId} />
      </main>

      <footer className="border-t border-[#2a475e]/60 bg-[#111318] py-8 text-center text-xs text-[#8f98a0]">
        <p className="font-semibold text-[#c7d5e0]">
          2026 AimVe Sports. Operado por SHOPYSOF., C.A. Todos los derechos reservados.
        </p>
        <p className="mt-1">Soporte y alianzas comerciales: contacto@aimvesports.com</p>
      </footer>

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
                <h3 className="text-2xl font-black text-white mb-2">Reserva tu Slot en AimVe</h3>
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
                <h4 className="text-xl font-black text-white mb-2">Solicitud Registrada!</h4>
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