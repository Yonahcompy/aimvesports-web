"use client";

let sharedAudioCtx: AudioContext | null = null;

function getUnlockedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

// Se ejecuta en el clic exacto de "Buscar Partida" para desbloquear el audio en segundo plano y pedir permiso Push de Windows
export async function unlockAudioAndNotifications(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const ctx = getUnlockedAudioContext();
    if (ctx) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    }
  } catch {}

  try {
    if ("Notification" in window) {
      if (Notification.permission === "default") {
        const perm = await Notification.requestPermission();
        return perm === "granted";
      }
      return Notification.permission === "granted";
    }
  } catch {}

  return false;
}

// Toca la rafaga competitiva de alerta (funciona aunque la pestaña este minimizada tras CS2)
export function playCompetitiveChime() {
  try {
    const ctx = getUnlockedAudioContext();
    if (!ctx) return;

    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.11);
      gain.gain.setValueAtTime(0.26, ctx.currentTime + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.11 + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.11);
      osc.stop(ctx.currentTime + idx * 0.11 + 0.32);
    });
  } catch {}
}

// Lanza notificacion nativa del Sistema Operativo (Windows / macOS) sobre la ventana del juego
export function sendNativeMatchNotification(matchId: number, serverConnect?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    const portLabel = serverConnect ? serverConnect.replace("connect ", "") : "Miami 128-Tick";
    const notif = new Notification("¡PARTIDA PREMIER 5v5 ENCONTRADA! (10/10)", {
      body: `Sala #${matchId} lista en ${portLabel}. Haz Alt+Tab y presiona ACEPTAR PARTIDA antes de que pasen 20 segundos.`,
      icon: "/logos.png",
      tag: `aimve_ready_${matchId}`,
      requireInteraction: true,
    });

    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch {}
}

// Crea un reloj basado en Web Worker que Chrome NO congela cuando el jugador minimiza el navegador para abrir CS2
export function createBackgroundWorkerTimer(
  onTick: () => void,
  intervalMs: number
): () => void {
  if (typeof window === "undefined") return () => {};

  try {
    const workerCode = `
      let timer = null;
      self.onmessage = function(e) {
        if (e.data.command === 'start') {
          if (timer) clearInterval(timer);
          timer = setInterval(() => {
            self.postMessage('tick');
          }, e.data.interval || 3000);
        } else if (e.data.command === 'stop') {
          if (timer) clearInterval(timer);
          timer = null;
        }
      };
    `;
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    worker.onmessage = () => {
      onTick();
    };
    worker.postMessage({ command: "start", interval: intervalMs });

    return () => {
      worker.postMessage({ command: "stop" });
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  } catch {
    const fallback = setInterval(onTick, intervalMs);
    return () => clearInterval(fallback);
  }
}