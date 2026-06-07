"use client";

import { useState } from "react";
import { toggleRegistration, generateBracket, updateMatchScore, setTournamentStatus, archiveTournament, updateAvailableCountries, startDrawing, finishDrawing, forceResetDrawing } from "@/app/actions";

// Helper to convert country name to 2-letter ISO code for flagcdn
const getCountryCode = (countryName: string) => {
  if (!countryName) return "tbd";
  return countryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

export default function AdminPanel({ settings, players, matches }: any) {
  const [activeTab, setActiveTab] = useState<"GENERAL" | "DRAWING">("GENERAL");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [countriesInput, setCountriesInput] = useState(() => {
    try {
      return JSON.parse(settings?.availableCountries || "[]").join(", ");
    } catch {
      return "";
    }
  });

  // Inline Spinning State
  const [spinningPlayerId, setSpinningPlayerId] = useState<string | null>(null);
  const [recentlyDrawn, setRecentlyDrawn] = useState<any[]>([]);

  const handleToggle = async () => {
    await toggleRegistration();
  };

  const handleGenerate = async () => {
    if (confirm("Are you sure? This will delete the current bracket and draft a new one.")) {
      setIsGenerating(true);
      await generateBracket();
      setIsGenerating(false);
    }
  };

  const handleScoreUpdate = async (e: React.FormEvent, matchId: string) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const scoreA = parseInt(formData.get("scoreA") as string);
    const scoreB = parseInt(formData.get("scoreB") as string);
    if (!isNaN(scoreA) && !isNaN(scoreB)) {
      await updateMatchScore(matchId, scoreA, scoreB);
      alert("Score Updated!");
    }
  };

  const handleSaveCountries = async () => {
    const arr = countriesInput.split(",").map((c: string) => c.trim()).filter((c: string) => c);
    setIsDownloading(true);
    try {
      await updateAvailableCountries(JSON.stringify(arr));
      
      // Trigger background download for missing logos
      const res = await fetch('/api/download-logos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams: arr })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }
      
      alert("Available teams saved and logos synced!");
    } catch (e: any) {
      console.error("Save Countries Error:", e);
      alert("Saved, but there was an error downloading some logos: " + e.message);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleStartDrawing = async (player: any) => {
    if (settings?.isDrawingLive || spinningPlayerId) {
      alert("A drawing is already in progress!");
      return;
    }
    
    let available: string[] = [];
    try {
      available = JSON.parse(settings?.availableCountries || "[]");
    } catch {}

    if (available.length === 0) {
      alert("No available teams left! Please add more teams first.");
      return;
    }

    setSpinningPlayerId(player.id);

    // Start drawing mode
    await startDrawing(player.id);
    
    setTimeout(async () => {
      const randomIdx = Math.floor(Math.random() * available.length);
      const pickedCountry = available[randomIdx];
      available.splice(randomIdx, 1);
      
      setRecentlyDrawn(prev => [{ ...player, country: pickedCountry }, ...prev]);
      setSpinningPlayerId(null);
      
      await finishDrawing(player.id, pickedCountry, JSON.stringify(available));
    }, 5000); // 5 seconds of animation time
  };

  const tbdPlayers = players.filter((p: any) => p.country === "TBD");

  return (
    <div className="p-8 max-w-[1600px] w-full mx-auto space-y-8">
      <div className="flex justify-between items-end">
        <h1 className="text-4xl font-black uppercase text-brand-neon">Admin Dashboard</h1>
        
        {/* Tabs */}
        <div className="flex space-x-4 border-b border-gray-700">
          <button 
            onClick={() => setActiveTab("GENERAL")}
            className={`px-6 py-3 font-bold uppercase transition-colors ${activeTab === "GENERAL" ? "bg-brand-neon text-brand-dark" : "text-gray-400 hover:text-white"}`}
          >
            General
          </button>
          <button 
            onClick={() => setActiveTab("DRAWING")}
            className={`px-6 py-3 font-bold uppercase transition-colors ${activeTab === "DRAWING" ? "bg-brand-neon text-brand-dark" : "text-gray-400 hover:text-white"}`}
          >
            Team Drawing
          </button>
        </div>
      </div>

      {activeTab === "GENERAL" && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Unified Tournament Workflow */}
          <div className="bg-brand-light/10 p-6 neon-border sharp-clip space-y-6">
            <div className="flex justify-between items-center border-b border-brand-neon/20 pb-4">
              <h2 className="text-2xl font-black uppercase tracking-wider text-brand-neon">Tournament Workflow</h2>
              <div className="text-xs text-gray-400 font-bold tracking-widest">
                TOTAL PLAYERS: <span className="text-white">{players.length}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Step 1: Registration */}
              <div className={`flex flex-col p-5 border sharp-clip transition-all duration-300 ${settings?.registrationOpen ? 'border-brand-neon bg-brand-neon/10 shadow-[0_0_15px_rgba(176,251,11,0.2)]' : 'border-gray-800 bg-black/40 opacity-50'}`}>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-black text-lg uppercase tracking-wide">1. Registration</h3>
                  {settings?.registrationOpen && <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-neon opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-brand-neon"></span></span>}
                </div>
                <p className="text-xs text-gray-400 flex-grow mb-6">Players sign up via the public dashboard.</p>
                {settings?.registrationOpen && (
                  <button onClick={handleToggle} className="w-full bg-brand-orange hover:bg-orange-400 text-brand-dark font-black text-sm px-4 py-3 uppercase tracking-wider sharp-clip transition-colors">
                    Close Registration
                  </button>
                )}
              </div>

              {/* Step 2: Drawing & Bracket */}
              <div className={`flex flex-col p-5 border sharp-clip transition-all duration-300 ${!settings?.registrationOpen && matches.length === 0 ? 'border-brand-neon bg-brand-neon/10 shadow-[0_0_15px_rgba(176,251,11,0.2)]' : 'border-gray-800 bg-black/40 opacity-50'}`}>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-black text-lg uppercase tracking-wide">2. Draft Phase</h3>
                  {!settings?.registrationOpen && matches.length === 0 && <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-neon opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-brand-neon"></span></span>}
                </div>
                <p className="text-xs text-gray-400 flex-grow mb-6">Complete Team Drawing, then generate the bracket.</p>
                {!settings?.registrationOpen && matches.length === 0 && (
                  <button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-brand-orange hover:bg-orange-400 text-brand-dark font-black text-sm px-4 py-3 uppercase tracking-wider sharp-clip transition-colors disabled:opacity-50">
                    {isGenerating ? "Generating..." : "Generate Bracket"}
                  </button>
                )}
              </div>

              {/* Step 3: Live */}
              <div className={`flex flex-col p-5 border sharp-clip transition-all duration-300 ${matches.length > 0 && settings?.tournamentStatus === "LIVE" ? 'border-brand-neon bg-brand-neon/10 shadow-[0_0_15px_rgba(176,251,11,0.2)]' : 'border-gray-800 bg-black/40 opacity-50'}`}>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-black text-lg uppercase tracking-wide">3. Live Match</h3>
                  {matches.length > 0 && settings?.tournamentStatus === "LIVE" && <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-neon opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-brand-neon"></span></span>}
                </div>
                <p className="text-xs text-gray-400 flex-grow mb-6">Input scores below as the tournament progresses.</p>
                {matches.length > 0 && settings?.tournamentStatus === "LIVE" && (
                  <button onClick={async () => {
                    if(confirm("Are you sure? This will mark the tournament as FINISHED.")) {
                      await setTournamentStatus("FINISHED");
                    }
                  }} className="w-full bg-brand-orange hover:bg-orange-400 text-brand-dark font-black text-sm px-4 py-3 uppercase tracking-wider sharp-clip transition-colors">
                    Finish Tournament
                  </button>
                )}
              </div>

              {/* Step 4: Finished */}
              <div className={`flex flex-col p-5 border sharp-clip transition-all duration-300 ${settings?.tournamentStatus === "FINISHED" ? 'border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-gray-800 bg-black/40 opacity-50'}`}>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-black text-lg uppercase tracking-wide text-red-500">4. Finished</h3>
                  {settings?.tournamentStatus === "FINISHED" && <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
                </div>
                <p className="text-xs text-gray-400 flex-grow mb-6">Tournament concluded. Results saved to standings.</p>
                {settings?.tournamentStatus === "FINISHED" && (
                  <button onClick={async () => {
                    if(confirm("Archive this tournament and start a new one?")) {
                      await archiveTournament();
                    }
                  }} className="w-full bg-red-600 hover:bg-red-500 text-white font-black text-sm px-4 py-3 uppercase tracking-wider sharp-clip transition-colors">
                    Start New Tournament
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Matches Management */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold uppercase">Matches (Draft & Live)</h2>
            <div className="overflow-x-auto custom-scrollbar pt-6 pb-8">
              {matches.length === 0 ? (
                <p className="text-gray-500">No matches generated yet.</p>
              ) : (
                <div className="flex min-w-max pb-8 pt-4">
                  {(() => {
                    const roundMap = new Map<string, any[]>();
                    matches.forEach((m: any) => {
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
                        // Hide BYE matches from the visual bracket
                        if (m && m.status === "COMPLETED" && !m.playerBId) return null;
                        return m;
                      });

                      let visibleMatchCounter = 1;

                      return (
                        <div key={roundName} className="flex flex-col w-[320px] shrink-0">
                          {slots.map((match, slotIdx) => {
                            const isTop = (slotIdx + 1) % 2 !== 0;
                            const isFinalRound = rIdx === sortedRounds.length - 1;

                            if (!match) {
                              return (
                                <div key={`empty-${slotIdx}`} className="flex-1 flex flex-col justify-center relative px-6 py-4">
                                  <div className="relative z-10 border border-transparent flex flex-col opacity-0 pointer-events-none w-[280px] min-h-[160px]" />
                                </div>
                              );
                            }

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

                                {/* Admin Editable Match Card */}
                                <div className="relative z-10 bg-brand-light/10 border border-brand-neon/40 flex flex-col sharp-clip transition-transform hover:scale-[1.02] duration-300 shadow-xl w-[280px] min-h-[160px]">
                                  {/* Match Header */}
                                  <div className="bg-brand-dark px-3 py-1.5 flex justify-between items-center border-b border-brand-neon/20">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">{displayMatchNumber}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 uppercase rounded ${
                                      match.status === 'LIVE' ? 'bg-red-500/20 text-red-500' :
                                      match.status === 'COMPLETED' ? 'bg-gray-500/20 text-gray-400' :
                                      'bg-brand-neon/20 text-brand-neon'
                                    }`}>
                                      {match.status}
                                    </span>
                                  </div>
                                  
                                  <form onSubmit={(e) => handleScoreUpdate(e, match.id)} className="flex flex-col">
                                    <div className="flex justify-between items-stretch">
                                      {/* Players Column */}
                                      <div className="flex flex-col justify-center flex-grow p-3 space-y-2">
                                        <div className="flex items-center gap-3">
                                          {match.playerA?.country && match.playerA?.country !== "TBD" && (
                                            <img 
                                              src={`/api/logo?team=${encodeURIComponent(match.playerA.country)}`} 
                                              alt={match.playerA.country} 
                                              className="w-6 h-6 object-contain"
                                            />
                                          )}
                                          <div className="flex flex-col">
                                            <div className="text-sm font-bold uppercase truncate w-32" title={match.playerA?.name || "TBD"}>
                                              {match.status === "COMPLETED" && !match.playerAId ? "BYE" : match.playerA?.name || "TBD"}
                                            </div>
                                            <div className="text-[10px] text-brand-neon/80 font-bold uppercase truncate w-32">{match.status === "COMPLETED" && !match.playerAId ? "" : match.playerA?.country}</div>
                                          </div>
                                        </div>
                                        
                                        <div className="w-full h-px bg-gradient-to-r from-transparent via-brand-neon/30 to-transparent my-1" />
                                        
                                        <div className="flex items-center gap-3">
                                          {match.playerB?.country && match.playerB?.country !== "TBD" && (
                                            <img 
                                              src={`/api/logo?team=${encodeURIComponent(match.playerB.country)}`} 
                                              alt={match.playerB.country} 
                                              className="w-6 h-6 object-contain"
                                            />
                                          )}
                                          <div className="flex flex-col">
                                            <div className="text-sm font-bold uppercase truncate w-32" title={match.playerB?.name || "TBD"}>
                                              {match.status === "COMPLETED" && !match.playerBId ? "BYE" : match.playerB?.name || "TBD"}
                                            </div>
                                            <div className="text-[10px] text-brand-neon/80 font-bold uppercase truncate w-32">{match.status === "COMPLETED" && !match.playerBId ? "" : match.playerB?.country}</div>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Score Inputs Column */}
                                      <div className="flex flex-col justify-center items-center bg-brand-dark/50 p-2 space-y-2 border-l border-brand-neon/20">
                                        <input 
                                          type="number" 
                                          name="scoreA" 
                                          defaultValue={match.scoreA ?? 0}
                                          disabled={!match.playerAId || !match.playerBId}
                                          className="w-12 h-10 bg-gray-800 text-center border border-gray-600 focus:border-brand-neon disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold sharp-clip"
                                        />
                                        <input 
                                          type="number" 
                                          name="scoreB" 
                                          defaultValue={match.scoreB ?? 0}
                                          disabled={!match.playerAId || !match.playerBId}
                                          className="w-12 h-10 bg-gray-800 text-center border border-gray-600 focus:border-brand-neon disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold sharp-clip"
                                        />
                                      </div>
                                    </div>
                                    
                                    <button 
                                      type="submit" 
                                      disabled={!match.playerAId || !match.playerBId}
                                      className="w-full bg-green-600 hover:bg-green-500 text-white py-2 text-xs font-bold uppercase tracking-wider disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed sharp-clip mt-auto"
                                    >
                                      SAVE SCORE
                                    </button>
                                  </form>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "DRAWING" && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-brand-light/10 p-6 neon-border sharp-clip space-y-4 backdrop-blur-md">
              <h2 className="text-2xl font-bold uppercase">Team Pool</h2>
              <p className="text-sm text-gray-400">Comma-separated list of teams available for gacha. Make sure to use standard English names (e.g. Portugal, Real Madrid, Germany) so the flags/logos load correctly.</p>
              <textarea 
                value={countriesInput}
                onChange={(e) => setCountriesInput(e.target.value)}
                rows={6}
                className="w-full bg-black/50 text-brand-neon p-4 border border-brand-neon/30 focus:outline-none focus:border-brand-neon focus:ring-1 focus:ring-brand-neon transition-all"
                placeholder="Portugal, Argentina, France, Germany, Spain, England..."
              />
              <button 
                onClick={handleSaveCountries}
                disabled={isDownloading}
                className="w-full bg-brand-neon text-brand-dark py-3 font-bold uppercase hover:bg-white transition-colors sharp-clip disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? "Saving & Downloading Logos..." : "Save Team Pool"}
              </button>
              <div className="pt-2 text-xs text-brand-orange">
                Currently Available: {(() => {
                  try {
                    return JSON.parse(settings?.availableCountries || "[]").length;
                  } catch { return 0; }
                })()} teams
              </div>
            </div>

            <div className="bg-brand-light/10 p-6 neon-border sharp-clip space-y-4 backdrop-blur-md flex flex-col">
              <h2 className="text-2xl font-bold uppercase flex items-center justify-between">
                <span>Players Awaiting Gacha</span>
                <div className="flex items-center space-x-3">
                  {settings?.isDrawingLive && (
                    <button 
                      onClick={async () => {
                        if (confirm("Are you sure you want to force reset the drawing state? Use this only if the animation gets stuck.")) {
                          await forceResetDrawing();
                          setSpinningPlayerId(null);
                        }
                      }}
                      className="bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1 text-sm font-bold uppercase border border-red-500/50 sharp-clip transition-colors"
                    >
                      Reset Stuck State
                    </button>
                  )}
                  <span className="text-sm text-brand-neon bg-brand-neon/10 px-3 py-1 rounded-full">{tbdPlayers.length} Left</span>
                </div>
              </h2>
              
              <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-[400px]">
                
                {/* Recently Drawn Players (Shows up at the top) */}
                {recentlyDrawn.map((p: any) => (
                  <div key={`drawn-${p.id}`} className="relative overflow-hidden bg-gradient-to-r from-green-900/40 to-black border border-green-500/50 p-4 flex justify-between items-center animate-in slide-in-from-top-4 fade-in duration-500 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                    <div className="flex flex-col z-10">
                      <span className="font-black uppercase text-xl text-white drop-shadow-md">{p.name}</span>
                      <span className="text-sm text-green-400 font-bold uppercase tracking-widest">{p.country}</span>
                    </div>
                    <div className="z-10 animate-in zoom-in duration-700">
                      {p.country && p.country !== "TBD" ? (
                        <img 
                          src={`/api/logo?team=${encodeURIComponent(p.country)}`}
                          alt={p.country}
                          className="w-16 h-16 object-contain drop-shadow-md"
                          onError={(e) => { e.currentTarget.src = '/teams/un.png'; }}
                        />
                      ) : null}
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-green-500/20 to-transparent pointer-events-none" />
                  </div>
                ))}

                {/* TBD Players List */}
                {tbdPlayers.length === 0 && recentlyDrawn.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50 space-y-4 py-12">
                    <div className="text-6xl">🏆</div>
                    <p>All registered players have been assigned a team.</p>
                  </div>
                )}
                
                {tbdPlayers.map((p: any) => (
                  <div key={p.id} className={`bg-black/40 border p-4 flex justify-between items-center transition-colors group ${p.id === spinningPlayerId ? 'border-brand-neon/50 bg-brand-neon/10 animate-pulse shadow-[0_0_20px_rgba(176,251,11,0.2)]' : 'border-gray-700/50 hover:border-brand-neon/50'}`}>
                    <span className={`font-bold uppercase transition-colors ${p.id === spinningPlayerId ? 'text-brand-neon' : 'text-gray-300 group-hover:text-white'}`}>{p.name}</span>
                    <button 
                      onClick={() => handleStartDrawing(p)}
                      disabled={settings?.isDrawingLive || !!spinningPlayerId}
                      className="bg-brand-neon/20 hover:bg-brand-neon text-brand-neon hover:text-brand-dark px-6 py-2 font-bold sharp-clip uppercase transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed border border-brand-neon/50"
                    >
                      {p.id === spinningPlayerId ? "Drawing..." : "Spin"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(50%); }
        }
      `}</style>
    </div>
  );
}
