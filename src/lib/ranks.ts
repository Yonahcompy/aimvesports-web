export const CS2_MAPS = [
  { id: "de_mirage", name: "Mirage", tag: "Clasico 5v5" },
  { id: "de_inferno", name: "Inferno", tag: "Control tactico" },
  { id: "de_dust2", name: "Dust II", tag: "Duelos de Aim" },
  { id: "de_nuke", name: "Nuke", tag: "Doble planta" },
  { id: "de_ancient", name: "Ancient", tag: "Selva / Medio" },
  { id: "de_anubis", name: "Anubis", tag: "Rotacion rapida" },
  { id: "de_vertigo", name: "Vertigo", tag: "Combate corto" },
];

export const PRACTICE_MODES = [
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

export interface WeeklyMission {
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

export const INITIAL_MISSIONS: WeeklyMission[] = [
  {
    id: "m_aimbotz",
    modeId: "aim_botz",
    title: "Calentamiento de Acero (Aim Botz :27016)",
    targetText: "Elimina 100 Bots con Headshot en el servidor de practica",
    current: 0,
    goal: 100,
    eloReward: 10,
    eloPenalty: 13,
    bonusLabel: "+10 ELO & Bono Mano Caliente (+10 ELO en tu prox. victoria 5v5)",
    claimed: false,
    penalized: false,
  },
  {
    id: "m_dmffa",
    modeId: "dm_ffa",
    title: "Dominio de Duelos (Deathmatch FFA :27017)",
    targetText: "Consigue 40 bajas con AK-47, M4 o Deagle en FFA",
    current: 0,
    goal: 40,
    eloReward: 15,
    eloPenalty: 13,
    bonusLabel: "+15 ELO Directos + 150 Pts Sorteo Mensual Skins",
    claimed: false,
    penalized: false,
  },
  {
    id: "m_retakes",
    modeId: "retakes",
    title: "Especialista en Defuse (Retakes 5v5 :27018)",
    targetText: "Gana 10 rondas de Retake plantando o desactivando C4",
    current: 0,
    goal: 10,
    eloReward: 5,
    eloPenalty: 13,
    bonusLabel: "+5 ELO & 1 Escudo Protector (0 ELO perdido en tu prox. derrota)",
    claimed: false,
    penalized: false,
  },
];

export interface MatchItem {
  id: number;
  created_at: string;
  team_a: string;
  team_b: string;
  selected_map: string;
  score_a: number;
  score_b: number;
  status: string;
  winner: string | null;
  mvp_nickname?: string | null;
}

export interface PersistedMissionState {
  missions: WeeklyMission[];
  eloShieldActive: boolean;
  hotHandBonus: boolean;
  weekExpiresAt: number;
}

export interface LeaderboardPlayer {
  id: number;
  nickname: string;
  steam_id: string | null;
  elo: number;
  wins: number;
  losses: number;
  country: string;
  season_prize: string;
  kills?: number;
  deaths?: number;
  headshots?: number;
  total_damage?: number;
  rounds_played?: number;
  mvp_count?: number;
  mission_data?: PersistedMissionState | null;
}

export interface ChatMessage {
  id: number;
  sender: string;
  text: string;
  time: string;
  team?: string;
  isSystem?: boolean;
}

export function getInitialCalibratedElo(winsInSix: number): number {
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

export function getEloTierStyle(elo: number, totalMatches: number = 6) {
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