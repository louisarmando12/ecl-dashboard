import { useState, useMemo } from "react";
import { Trophy, ChevronDown, ChevronUp, Medal } from "lucide-react";

export default function TournamentHub({ matches, settings }: { matches: any[], settings?: any }) {
  const [filter, setFilter] = useState<"ALL" | "LIVE">("ALL");
  const [expandedSeasons, setExpandedSeasons] = useState<Record<string, boolean>>({});

  const currentTourneyId = settings?.currentTournamentId || "1";

  const isTourneyLiveOrFinished = settings?.tournamentStatus === "LIVE" || settings?.tournamentStatus === "FINISHED";

  // Group matches by tournamentId
  const tournaments = useMemo(() => {
    const groups: Record<string, any[]> = {};
    matches.forEach(m => {
      // Hide current tournament matches if it hasn't started yet (still UPCOMING)
      if (m.tournamentId === currentTourneyId && !isTourneyLiveOrFinished) {
        return;
      }
      if (!groups[m.tournamentId]) groups[m.tournamentId] = [];
      groups[m.tournamentId].push(m);
    });
    return groups;
  }, [matches, currentTourneyId, isTourneyLiveOrFinished]);

  const filteredTournaments = useMemo(() => {
    const list = Object.entries(tournaments).map(([tId, tMatches]) => {
      let filtered = tMatches;
      if (filter === "LIVE") {
        if (tId !== currentTourneyId) return null; // Past seasons are not live
        filtered = tMatches.filter(m => m.status === "LIVE" || m.status === "UPCOMING");
      }
      
      if (filtered.length === 0) return null;
      return { tId, matches: filtered };
    }).filter(Boolean) as { tId: string, matches: any[] }[];

    return list.sort((a, b) => {
      const aIsCurrent = a.matches.some(m => m.status !== "COMPLETED") || a.tId === currentTourneyId;
      const bIsCurrent = b.matches.some(m => m.status !== "COMPLETED") || b.tId === currentTourneyId;
      
      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;

      const aDate = new Date(a.matches[0].createdAt).getTime();
      const bDate = new Date(b.matches[0].createdAt).getTime();
      return bDate - aDate; // Newest first
    });
  }, [tournaments, filter, currentTourneyId]);

  const toggleSeason = (tId: string) => {
    setExpandedSeasons(prev => ({ ...prev, [tId]: !prev[tId] }));
  };

  const getPodium = (tMatches: any[]) => {
    const maxRound = Math.max(...tMatches.map(m => parseInt(m.round.replace("Round ", "")) || 1));
    const finalMatch = tMatches.find(m => parseInt(m.round.replace("Round ", "")) === maxRound && m.status === "COMPLETED");
    const semiMatches = tMatches.filter(m => parseInt(m.round.replace("Round ", "")) === maxRound - 1 && m.status === "COMPLETED");
    
    if (!finalMatch) return null;

    return {
      champion: finalMatch.winner?.name || "Unknown",
      runnerUp: finalMatch.loser?.name || "Unknown",
      semiFinalists: semiMatches.map(m => m.loser?.name || "Unknown")
    };
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-24">
      
      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-brand-light/20 p-6 sharp-clip neon-border">
        <h2 className="text-3xl font-black uppercase flex items-center space-x-3 mb-4 md:mb-0">
          <Trophy className="w-8 h-8 text-brand-neon" />
          <span>Tournament Bracket</span>
        </h2>
        
        <div className="flex space-x-2">
          {["ALL", "LIVE"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 font-bold uppercase transition-colors sharp-clip ${
                filter === f ? "bg-brand-neon text-brand-dark" : "bg-brand-dark text-gray-400 hover:text-white border border-gray-700"
              }`}
            >
              {f === "LIVE" ? "LIVE / UPCOMING" : "ALL MATCHES"}
            </button>
          ))}
        </div>
      </div>

      {/* Match Cards List */}
      <div className="space-y-12">
        {filteredTournaments.length === 0 ? (
          <div className="text-center py-12 text-gray-400 italic bg-brand-light/10 border border-brand-neon/20 p-8 sharp-clip">
            <Trophy className="w-12 h-12 text-brand-neon/40 mx-auto mb-4" />
            <p className="font-bold uppercase tracking-wider text-white">Bagan pertandingan belum dirilis.</p>
            <p className="text-xs text-gray-500 mt-1">Silakan cek kembali setelah admin memulai turnamen resmi.</p>
          </div>
        ) : (
          filteredTournaments.map(({ tId, matches: tMatches }, idx) => {
            // A season is only "Current" if it has active matches. If all are COMPLETED, it's finished.
            const isCurrent = tMatches.some(m => m.status !== "COMPLETED");
            const isExpanded = expandedSeasons[tId] ?? isCurrent; // Current season expanded by default
            const podium = getPodium(tournaments[tId]); // Get podium from ALL matches of this tourney

            const dateObj = new Date(tMatches[0].createdAt);
            const dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
            const dateStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

            return (
              <div key={tId} className="space-y-4 bg-brand-dark/50 border border-brand-neon/20 p-6 sharp-clip">
                
                {/* Season Header */}
                <div 
                  className="flex flex-col md:flex-row md:items-center justify-between cursor-pointer group"
                  onClick={() => toggleSeason(tId)}
                >
                  <div className="flex items-center space-x-4">
                    <h3 className="text-2xl font-bold text-brand-neon uppercase">
                      {isCurrent ? "Current Season" : dayName}
                    </h3>
                    <div className="hidden md:block h-px w-16 bg-brand-neon/30" />
                    {!isCurrent && (
                      <span className="text-sm font-bold text-gray-400 bg-black/40 px-3 py-1 rounded-full">
                        {dateStr}
                      </span>
                    )}
                  </div>
                  <div className="text-brand-neon group-hover:scale-110 transition-transform mt-2 md:mt-0">
                    {isExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                  </div>
                </div>

                {/* Podium Summary (Only show if collapsed and it's a past season with a completed final) */}
                {!isExpanded && !isCurrent && podium && (
                  <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-gray-800">
                    <div className="flex items-center space-x-2 text-yellow-400">
                      <Medal className="w-5 h-5" />
                      <span className="font-bold uppercase">1st: {podium.champion}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-gray-400">
                      <Medal className="w-5 h-5" />
                      <span className="font-bold uppercase">2nd: {podium.runnerUp}</span>
                    </div>
                    {podium.semiFinalists.length > 0 && (
                      <div className="flex items-center space-x-2 text-amber-700">
                        <Medal className="w-5 h-5" />
                        <span className="font-bold uppercase">3rd/4th: {podium.semiFinalists.join(", ")}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Expandable Bracket */}
                {isExpanded && (
                  <div className="pt-6 border-t border-gray-800 overflow-x-auto custom-scrollbar">
                    <div className="flex min-w-max pb-8 pt-4">
                      {(() => {
                        const roundMap = new Map<string, any[]>();
                        tMatches.forEach((m: any) => {
                          if (!roundMap.has(m.round)) roundMap.set(m.round, []);
                          roundMap.get(m.round)!.push(m);
                        });
                        
                        const sortedRounds = Array.from(roundMap.keys()).sort((a, b) => {
                          return parseInt(a.replace("Round ", "")) - parseInt(b.replace("Round ", ""));
                        });

                        return sortedRounds.map((roundName, rIdx) => {
                          const roundMatches = roundMap.get(roundName)!;
                          const expectedSlots = Math.pow(2, sortedRounds.length - rIdx - 1);
                          const slots = Array.from({ length: expectedSlots }, (_, i) => {
                            const m = roundMatches.find(m => m.bracket === i + 1) || null;
                            if (m && m.status === "COMPLETED" && !m.playerBId) return null;
                            return m;
                          });

                          let visibleMatchCounter = 1;

                          return (
                            <div key={roundName} className="flex flex-col w-[320px] shrink-0">
                              {slots.map((match, slotIdx) => {
                                const isTop = (slotIdx + 1) % 2 !== 0;
                                const isFinalRound = rIdx === sortedRounds.length - 1;

                                let hasIncoming = false;
                                let child1Visible = false;
                                let child2Visible = false;
                                if (rIdx > 0) {
                                  const prevRoundName = sortedRounds[rIdx - 1];
                                  const prevRoundMatches = roundMap.get(prevRoundName) || [];
                                  const child1 = prevRoundMatches.find(m => m.bracket === slotIdx * 2 + 1);
                                  const child2 = prevRoundMatches.find(m => m.bracket === slotIdx * 2 + 2);
                                  
                                  child1Visible = !!(child1 && !(child1.status === "COMPLETED" && !child1.playerBId));
                                  child2Visible = !!(child2 && !(child2.status === "COMPLETED" && !child2.playerBId));
                                  
                                  hasIncoming = !!(child1Visible || child2Visible);
                                }

                                if (!match) {
                                  return (
                                    <div key={`empty-${slotIdx}`} className="flex-1 flex flex-col justify-center relative px-6 py-4">
                                      <div className="relative z-10 border border-transparent flex flex-col opacity-0 pointer-events-none w-[280px] h-[140px]" />
                                    </div>
                                  );
                                }

                                const displayMatchNumber = `ECL-R${rIdx + 1}-${visibleMatchCounter++}`;

                                return (
                                  <div key={match.id} className="flex-1 flex flex-col justify-center relative px-6 py-4">
                                    {/* Outgoing Connector to next round */}
                                    {!isFinalRound && (
                                      <div className="absolute top-1/2 right-0 w-6 h-[2px] bg-brand-neon/40 -translate-y-1/2" />
                                    )}

                                    {/* Incoming Connectors from previous round */}
                                    {child1Visible && (
                                      <div className="absolute left-0 w-6 border-l-2 border-b-2 border-brand-neon/40" style={{ top: 'calc(25% - 1px)', height: 'calc(25% + 2px)' }} />
                                    )}
                                    {child2Visible && (
                                      <div className="absolute left-0 w-6 border-l-2 border-t-2 border-brand-neon/40" style={{ top: 'calc(50% - 1px)', height: 'calc(25% + 2px)' }} />
                                    )}

                                    {/* Match Card */}
                                    <div className="relative z-10 bg-brand-dark border border-brand-neon/40 flex flex-col sharp-clip transition-transform hover:scale-[1.02] duration-300 shadow-[0_4px_15px_rgba(0,0,0,0.5)] group w-[280px] h-[140px]">
                                      {/* Header */}
                                      <div className="bg-brand-neon/10 px-3 py-1.5 flex justify-between items-center border-b border-brand-neon/20">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{displayMatchNumber}</span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 uppercase rounded tracking-wider ${
                                          match.status === 'LIVE' ? 'bg-red-500/20 text-red-500 animate-pulse' :
                                          match.status === 'COMPLETED' ? 'bg-gray-500/20 text-gray-400' :
                                          'bg-brand-neon/20 text-brand-neon'
                                        }`}>
                                          {match.status}
                                        </span>
                                      </div>
                                      
                                      {/* Match Body */}
                                      <div className="flex justify-between items-stretch flex-grow">
                                        {/* Players */}
                                        <div className="flex flex-col justify-center space-y-2 flex-grow p-3">
                                          {/* Player A */}
                                          <div className={`flex items-center justify-between ${match.winnerId === match.playerA?.id ? 'text-brand-neon font-bold' : ''}`}>
                                            <div className="flex items-center gap-3">
                                                {match.playerACountry && match.playerAId && (
                                                  <img 
                                                    src={`/api/logo?team=${encodeURIComponent(match.playerACountry)}`} 
                                                    alt={match.playerACountry} 
                                                    className="w-6 h-6 object-contain"
                                                  />
                                                )}
                                              <div className="flex flex-col justify-center">
                                                <div className="text-sm font-black uppercase">
                                                  {match.status === "COMPLETED" && !match.playerAId ? "BYE" : match.playerA?.name || "TBD"}
                                                </div>
                                                {match.playerACountry && match.playerAId && (
                                                  <div className="text-[10px] text-brand-neon/80 font-bold uppercase tracking-widest leading-none mt-0.5">
                                                    {match.playerACountry}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          
                                          {/* Divider */}
                                          <div className="w-full h-px bg-gradient-to-r from-transparent via-brand-neon/30 to-transparent" />

                                          {/* Player B */}
                                          <div className={`flex items-center justify-between ${match.winnerId === match.playerB?.id ? 'text-brand-neon font-bold' : ''}`}>
                                            <div className="flex items-center gap-3">
                                                {match.playerBCountry && match.playerBId && (
                                                  <img 
                                                    src={`/api/logo?team=${encodeURIComponent(match.playerBCountry)}`} 
                                                    alt={match.playerBCountry} 
                                                    className="w-6 h-6 object-contain"
                                                  />
                                                )}
                                              <div className="flex flex-col justify-center">
                                                <div className="text-sm font-black uppercase">
                                                  {match.status === "COMPLETED" && !match.playerBId ? "BYE" : match.playerB?.name || "TBD"}
                                                </div>
                                                {match.playerBCountry && match.playerBId && (
                                                  <div className="text-[10px] text-brand-neon/80 font-bold uppercase tracking-widest leading-none mt-0.5">
                                                    {match.playerBCountry}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Score Box */}
                                        <div className="text-brand-dark font-black text-xl flex flex-col justify-center items-center px-4 min-w-[50px] sharp-clip bg-brand-neon">
                                          <div>{match.scoreA ?? '-'}</div>
                                          <div className="w-4 h-px bg-brand-dark/30 my-1" />
                                          <div>{match.scoreB ?? '-'}</div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
