"use client";

import React, { useState } from "react";

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  const copyServerIp = (ip: string) => {
    navigator.clipboard.writeText(`connect ${ip}`);
    setCopiedIp(ip);
    setTimeout(() => setCopiedIp(null), 2500);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegistered(true);
  };

  return (
    <div className="min-h-screen bg-[#171a21] text-[#c7d5e0] font-sans selection:bg-[#66c0f4] selection:text-[#171a21] relative overflow-x-hidden">
      {/* Luces ambientales estilo Steam + AimVe */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-tr from-[#1b2838] via-[#66c0f4]/15 to-[#FF5500]/10 blur-[130px] rounded-full" />

      {/* Barra de Navegación Superior (Header) */}
      <header className="border-b border-[#2a475e]/60 bg-[#171a21]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          
          {/* LOGO REAL DE AIMVE SPORTS */}
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
            <a href="#servidores" className="hover:text-[#66c0f4] transition">
              Servidores en Vivo
            </a>
            <a href="#premios" className="hover:text-[#66c0f4] transition">
              Leaderboard & Skins
            </a>
            <a href="#vip" className="hover:text-[#FF5500] transition">
              Membresía VIP
            </a>
          </nav>

          <button
            onClick={() => {
              setRegistered(false);
              setModalOpen(true);
            }}
            className="bg-gradient-to-r from-[#47bfff] to-[#1a44c2] hover:from-[#66c0f4] hover:to-[#2a5bd7] text-white font-bold px-5 py-2.5 rounded-sm text-sm tracking-wide transition shadow-lg shadow-[#1a44c2]/40 border border-[#66c0f4]/40 cursor-pointer"
          >
            CONECTAR STEAM
          </button>
        </div>
      </header>

      {/* Sección Principal (Hero) */}
      <main className="max-w-7xl mx-auto px-6 pt-20 pb-24 text-center relative z-10">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-sm bg-[#1b2838] border border-[#2a475e] text-xs font-bold text-[#66c0f4] mb-8 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-[#a4d007] animate-pulse"></span>
          35-55 MS LOW-PING • A JUGAR
        </div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none text-white mb-6">
          EL CIRCUITO COMPETITIVO <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#66c0f4] via-[#c7d5e0] to-[#FF5500]">
            DE CS2 PARA LATAM
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-[#8f98a0] text-lg md:text-xl mb-10 leading-relaxed">
          Emparejamiento competitivo 5v5 con rango ELO propio, servidores Sub-tick de baja latencia, torneos semanales y entregas mensuales automatizadas en{" "}
          <span className="text-white font-semibold border-b border-[#FF5500]">
            Skins de CS2 y USDT
          </span>
          .
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => {
              setRegistered(false);
              setModalOpen(true);
            }}
            className="w-full sm:w-auto bg-gradient-to-r from-[#FF5500] to-[#e03e00] hover:from-[#ff6a1f] hover:to-[#ff4500] text-white font-black px-8 py-4 rounded-sm text-base tracking-wide transition shadow-xl shadow-[#FF5500]/25 border border-orange-400/30 cursor-pointer"
          >
            ENTRAR AL ACCESO ANTICIPADO
          </button>
          <a
            href="#servidores"
            className="w-full sm:w-auto px-8 py-4 rounded-sm border border-[#2a475e] hover:border-[#66c0f4] bg-[#1b2838]/80 hover:bg-[#2a475e]/50 text-white font-bold text-base transition"
          >
            EXPLORAR SERVIDORES RETAKE
          </a>
        </div>

        {/* Barra Rápida de Estadísticas */}
        <div className="max-w-4xl mx-auto mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-sm bg-[#1b2838]/60 border border-[#2a475e]/80 backdrop-blur-sm">
          <div>
            <div className="text-2xl font-black text-white">35-55 ms</div>
            <div className="text-xs text-[#66c0f4] uppercase font-bold tracking-wider">
              Latencia Promedio
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-white">5v5 ELO</div>
            <div className="text-xs text-[#66c0f4] uppercase font-bold tracking-wider">
              Matchmaking Competitivo
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-[#FF5500]">Skins & USDT</div>
            <div className="text-xs text-[#c7d5e0] uppercase font-bold tracking-wider">
              Premios Directos
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-[#a4d007]">Pago Móvil</div>
            <div className="text-xs text-[#c7d5e0] uppercase font-bold tracking-wider">
              & Binance Pay Activo
            </div>
          </div>
        </div>

        {/* Tarjetas de Ventajas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left">
          <div className="p-7 rounded-sm bg-gradient-to-b from-[#1b2838] to-[#171a21] border border-[#2a475e] hover:border-[#66c0f4] transition group shadow-lg">
            <div className="text-[#66c0f4] font-black text-xs uppercase tracking-widest mb-2 flex items-center justify-between">
              <span>01 • INFRAESTRUCTURA</span>
              <span className="w-2 h-2 rounded-full bg-[#66c0f4]"></span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Rutas Directas sin Lag</h3>
            <p className="text-[#8f98a0] text-sm leading-relaxed">
              Conexión optimizada por fibra óptica desde Venezuela, Colombia y el Caribe hacia nodos en Miami y Bogotá para un registro de disparo perfecto.
            </p>
          </div>

          <div className="p-7 rounded-sm bg-gradient-to-b from-[#1b2838] to-[#171a21] border border-[#2a475e] hover:border-[#FF5500] transition group shadow-lg">
            <div className="text-[#FF5500] font-black text-xs uppercase tracking-widest mb-2 flex items-center justify-between">
              <span>02 • RECOMPENSAS STEAM</span>
              <span className="w-2 h-2 rounded-full bg-[#FF5500]"></span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Inventario y Liquidez Real</h3>
            <p className="text-[#8f98a0] text-sm leading-relaxed">
              Escala en la Liga Mensual y recibe cuchillos, guantes, rifles o pagos directos en USDT sin intermediarios ni demoras bancarias.
            </p>
          </div>

          <div className="p-7 rounded-sm bg-gradient-to-b from-[#1b2838] to-[#171a21] border border-[#2a475e] hover:border-[#a4d007] transition group shadow-lg">
            <div className="text-[#a4d007] font-black text-xs uppercase tracking-widest mb-2 flex items-center justify-between">
              <span>03 • SUSCRIPCIÓN LOCAL</span>
              <span className="w-2 h-2 rounded-full bg-[#a4d007]"></span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Cero Tarjetas Rechazadas</h3>
            <p className="text-[#8f98a0] text-sm leading-relaxed">
              Activa tu rango VIP al instante en bolívares (Pago Móvil) o desde cualquier país de Latinoamérica con Binance Pay.
            </p>
          </div>
        </div>

        {/* SECCIÓN 1: SERVIDORES EN VIVO */}
        <section id="servidores" className="mt-28 text-left">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
            <div>
              <div className="text-[#66c0f4] text-xs font-black uppercase tracking-widest mb-1">
                INFRAESTRUCTURA DEDICADA CS2
              </div>
              <h2 className="text-3xl font-black text-white">
                SERVIDORES DE CALENTAMIENTO & PUG
              </h2>
            </div>
            <p className="text-sm text-[#8f98a0] mt-2 md:mt-0">
              Copia el comando de consola e ingresa directo con latencia optimizada.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                name: "⚡ AimVe #1 | RETAKE COMPETITIVO",
                map: "de_mirage",
                players: "9/10",
                ping: "38 ms",
                ip: "mia1.aimvesports.com:27015",
                status: "EN PARTIDA",
              },
              {
                name: "🔥 AimVe #2 | DEATHMATCH FFA HS",
                map: "de_dust2",
                players: "16/18",
                ping: "42 ms",
                ip: "mia2.aimvesports.com:27016",
                status: "ONLINE",
              },
              {
                name: "🏆 AimVe #3 | 5v5 PUG MATCHMAKING",
                map: "de_inferno",
                players: "10/10",
                ping: "36 ms",
                ip: "pug1.aimvesports.com:27017",
                status: "SOLO VIP / ELO",
              },
            ].map((srv, idx) => (
              <div
                key={idx}
                className="p-5 rounded-sm bg-[#1b2838]/90 border border-[#2a475e] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="px-2 py-0.5 rounded-sm bg-[#171a21] text-[#a4d007] font-bold border border-[#a4d007]/30">
                      ● {srv.status}
                    </span>
                    <span className="text-[#66c0f4] font-mono font-bold">
                      {srv.ping}
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-base mb-1">
                    {srv.name}
                  </h4>
                  <div className="text-xs text-[#8f98a0] flex items-center gap-4 mb-5">
                    <span>Mapa: <strong className="text-[#c7d5e0]">{srv.map}</strong></span>
                    <span>Slots: <strong className="text-[#c7d5e0]">{srv.players}</strong></span>
                  </div>
                </div>

                <button
                  onClick={() => copyServerIp(srv.ip)}
                  className="w-full py-2.5 px-4 rounded-sm bg-[#171a21] hover:bg-[#2a475e] text-xs font-bold text-[#66c0f4] border border-[#2a475e] transition cursor-pointer"
                >
                  {copiedIp === srv.ip
                    ? "✓ COMANDO COPIADO (PEGA EN CONSOLA)"
                    : `COPIAR IP: connect ${srv.ip}`}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* SECCIÓN 2: LEADERBOARD MENSUAL & PREMIOS */}
        <section id="premios" className="mt-28 text-left">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
            <div>
              <div className="text-[#FF5500] text-xs font-black uppercase tracking-widest mb-1">
                TEMPORADA FUNDADORES • PREMIOS REALES
              </div>
              <h2 className="text-3xl font-black text-white">
                LEADERBOARD TOP ELO & RECOMPENSAS
              </h2>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 bg-[#FF5500]/15 text-[#FF5500] border border-[#FF5500]/40 rounded-sm mt-2 md:mt-0">
              BOLSA MENSUAL: SKINS CS2 + USDT
            </span>
          </div>

          <div className="overflow-hidden rounded-sm border border-[#2a475e] bg-[#1b2838]/70">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#171a21] text-[#8f98a0] text-xs uppercase border-b border-[#2a475e]">
                  <th className="py-3.5 px-5">Posición</th>
                  <th className="py-3.5 px-5">Jugador</th>
                  <th className="py-3.5 px-5">Rango ELO</th>
                  <th className="py-3.5 px-5">Winrate</th>
                  <th className="py-3.5 px-5 text-right">Premio de Temporada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a475e]/40">
                <tr className="bg-gradient-to-r from-[#FF5500]/10 to-transparent">
                  <td className="py-4 px-5 font-black text-[#FF5500]">#1 🏆</td>
                  <td className="py-4 px-5 font-bold text-white">Vacante Fundador #1</td>
                  <td className="py-4 px-5 text-[#66c0f4] font-mono font-bold">2,450 ELO</td>
                  <td className="py-4 px-5 text-[#a4d007] font-bold">68%</td>
                  <td className="py-4 px-5 text-right font-bold text-[#FF5500]">
                    ★ Cuchillo CS2 o $150 USDT
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-5 font-black text-[#c7d5e0]">#2 🥈</td>
                  <td className="py-4 px-5 font-bold text-white">Vacante Fundador #2</td>
                  <td className="py-4 px-5 text-[#66c0f4] font-mono font-bold">2,310 ELO</td>
                  <td className="py-4 px-5 text-[#a4d007] font-bold">64%</td>
                  <td className="py-4 px-5 text-right font-bold text-white">
                    AK-47 | Asiimov + $50 USDT
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-5 font-black text-[#8f98a0]">#3 🥉</td>
                  <td className="py-4 px-5 font-bold text-white">Vacante Fundador #3</td>
                  <td className="py-4 px-5 text-[#66c0f4] font-mono font-bold">2,190 ELO</td>
                  <td className="py-4 px-5 text-[#a4d007] font-bold">61%</td>
                  <td className="py-4 px-5 text-right font-bold text-white">
                    M4A4 | Neo-Noir + Pase VIP
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Pie de Página Corporativo */}
      <footer className="border-t border-[#2a475e]/60 bg-[#111318] py-8 text-center text-xs text-[#8f98a0]">
        <p className="font-semibold text-[#c7d5e0]">
          © 2026 AimVe Sports. Operado por SHOPYSOF., C.A. Todos los derechos reservados.
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
              ✕
            </button>

            {!registered ? (
              <form onSubmit={handleRegister}>
                <div className="text-xs font-black text-[#FF5500] uppercase tracking-widest mb-1">
                  LISTA DE FUNDADORES • CS2 LATAM
                </div>
                <h3 className="text-2xl font-black text-white mb-2">
                  Reserva tu Slot en AimVe
                </h3>
                <p className="text-xs text-[#8f98a0] mb-5">
                  Regístrate para recibir tu invitación a la Beta Cerrada, insignia de Fundador y acceso a los sorteos de Skins de lanzamiento.
                </p>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#c7d5e0] mb-1">
                      Tu Nickname / Steam ID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. YonathanDHC o link de Steam"
                      className="w-full px-3.5 py-2.5 bg-[#171a21] border border-[#2a475e] rounded-sm text-sm text-white focus:outline-none focus:border-[#66c0f4]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#c7d5e0] mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="tucorreo@gmail.com"
                      className="w-full px-3.5 py-2.5 bg-[#171a21] border border-[#2a475e] rounded-sm text-sm text-white focus:outline-none focus:border-[#66c0f4]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#c7d5e0] mb-1">
                      País de Conexión
                    </label>
                    <select className="w-full px-3.5 py-2.5 bg-[#171a21] border border-[#2a475e] rounded-sm text-sm text-white focus:outline-none focus:border-[#66c0f4]">
                      <option>Venezuela (Fibra / Low-Ping)</option>
                      <option>Colombia</option>
                      <option>Panamá / Caribe</option>
                      <option>Ecuador / Perú</option>
                      <option>Otro país LATAM</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-[#FF5500] to-[#e03e00] hover:from-[#ff6a1f] hover:to-[#ff4500] text-white font-black py-3 rounded-sm text-sm tracking-wide transition cursor-pointer"
                >
                  ASEGURAR MI CUPO DE FUNDADOR
                </button>
              </form>
            ) : (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-[#a4d007]/20 border border-[#a4d007] text-[#a4d007] flex items-center justify-center mx-auto mb-4 text-xl font-black">
                  ✓
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