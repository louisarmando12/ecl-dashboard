"use client";

import { useEffect, useState, useRef } from "react";
import { getDrawingState } from "@/app/actions";

const TEAMS = [
  "Portugal", "Argentina", "France", "Germany", "Spain", "England", 
  "Brazil", "Italy", "Netherlands", "Belgium", "Croatia", "Uruguay"
];

const getCountryCode = (countryName: string) => {
  if (!countryName) return "tbd";
  return countryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

export default function LiveDrawing() {
  const [isDrawing, setIsDrawing] = useState(false);
  const [player, setPlayer] = useState<any>(null);
  const [pool, setPool] = useState<string[]>(TEAMS);
  
  // Animation state
  const [displayTeam, setDisplayTeam] = useState("...");
  const [showResult, setShowResult] = useState(false);
  const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Polling for drawing state
  useEffect(() => {
    const poll = async () => {
      try {
        const state = await getDrawingState();
        if (state.availableTeams && state.availableTeams.length > 0) {
          setPool(state.availableTeams);
        }
        
        if (state.isDrawingLive && !isDrawing) {
          setIsDrawing(true);
          setPlayer(state.player);
          setShowResult(false);
          if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
          startRouletteAnimation(state.availableTeams && state.availableTeams.length > 0 ? state.availableTeams : TEAMS);
        } else if (!state.isDrawingLive && isDrawing) {
          if (state.player && state.player.country !== "TBD") {
            // Use functional state updates to avoid stale closure issues
            setShowResult((prev) => {
              if (!prev) {
                setDisplayTeam(state.player.country);
                setPlayer(state.player);
                
                resultTimeoutRef.current = setTimeout(() => {
                  setIsDrawing(false);
                  setPlayer(null);
                  setShowResult(false);
                }, 7000);
                return true;
              }
              return prev;
            });
          } else {
            setIsDrawing(false);
          }
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    };

    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [isDrawing]);

  const startRouletteAnimation = (activePool: string[]) => {
    let ticks = 0;
    const maxTicks = 50; 
    
    const interval = setInterval(() => {
      ticks++;
      const randomTeam = activePool[Math.floor(Math.random() * activePool.length)];
      setDisplayTeam(randomTeam);
      
      if (ticks >= maxTicks) {
        clearInterval(interval);
      }
    }, 100);
  };

  if (!isDrawing && !showResult) {
    return (
      <div className="hidden" aria-hidden="true">
        {/* Preload images to prevent flickering on first draw */}
        {pool.map(team => (
          <img key={team} src={`/api/logo?team=${encodeURIComponent(team)}`} alt="" />
        ))}
        {player?.country && player.country !== "TBD" && (
          <img src={`/api/logo?team=${encodeURIComponent(player.country)}`} alt="" />
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
      {/* Premium Spotlight Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] bg-brand-neon/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-4xl w-full flex flex-col items-center justify-center space-y-12 animate-in zoom-in-95 duration-700 ease-out">
        
        {/* Header Title */}
        <div className="flex flex-col items-center space-y-2">
          <div className="text-brand-neon font-bold tracking-[0.3em] text-xs md:text-sm uppercase bg-brand-neon/10 px-6 py-2 rounded-full border border-brand-neon/20 shadow-[0_0_15px_rgba(176,251,11,0.2)]">
            {showResult ? "OFFICIAL DRAFT RESULT" : "TEAM DRAWING"}
          </div>
        </div>

        {/* Player Name */}
        <div className="text-center space-y-4">
          <h2 className="text-5xl md:text-7xl font-black uppercase text-white tracking-tighter drop-shadow-2xl">
            {player?.name || "PLAYER"}
          </h2>
          <p className="text-gray-400 font-medium tracking-widest text-lg md:text-xl uppercase flex items-center justify-center space-x-3">
            {!showResult && (
              <>
                <span className="w-2 h-2 rounded-full bg-brand-neon animate-pulse" />
                <span>Rolling for a team</span>
                <span className="w-2 h-2 rounded-full bg-brand-neon animate-pulse delay-75" />
              </>
            )}
            {showResult && (
              <span className="text-brand-neon">has drafted</span>
            )}
          </p>
        </div>

        {/* Dynamic Display Area */}
        <div className="w-full flex justify-center">
          <div className={`relative flex flex-col items-center ${showResult ? "group animate-in slide-in-from-bottom-8 fade-in duration-1000 ease-out" : ""}`}>
            {/* Glow Behind Flag */}
            <div className={`absolute inset-0 blur-3xl scale-150 rounded-full transition-colors duration-700 ${showResult ? "bg-brand-neon/20 group-hover:bg-brand-neon/30" : "bg-transparent"}`} />
            
            <div className="relative z-10 w-72 h-72 md:w-96 md:h-96">
              {!showResult && (
                <img 
                  src={`/api/logo?team=${encodeURIComponent(displayTeam)}`}
                  alt={displayTeam}
                  className="absolute inset-0 w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
                />
              )}
              
              <img 
                src={`/api/logo?team=${encodeURIComponent(displayTeam)}`}
                alt={displayTeam}
                className={`absolute inset-0 w-full h-full object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.7)] transition-all duration-700 ${showResult ? 'opacity-100 transform hover:scale-110 z-20' : 'opacity-0 z-0'}`}
                onError={(e) => { e.currentTarget.src = '/teams/un.png'; }}
              />
            </div>
            
            <div className={`relative z-10 mt-10 text-6xl md:text-8xl font-black uppercase tracking-tight drop-shadow-2xl text-center ${showResult ? "text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500" : "text-white/90"}`}>
              {displayTeam}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
