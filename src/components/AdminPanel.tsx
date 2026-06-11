"use client";

import { useState } from "react";
import { toggleRegistration, generateBracket, updateMatchScore, setTournamentStatus, archiveTournament, updateAvailableCountries, startDrawing, finishDrawing, forceResetDrawing, resetDatabase, deletePlayer, addPlayerManually, updatePlayer, logoutAdmin, updateMatchPlayers, destroyTournament, uploadPlayerPhoto } from "@/app/actions";

// Helper to convert country name to 2-letter ISO code for flagcdn
const getCountryCode = (countryName: string) => {
  if (!countryName) return "tbd";
  return countryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
};

// Helper to compress images client-side before upload
const compressImage = (file: File, maxWidth = 300, maxHeight = 300): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now()
            }));
          } else {
            reject(new Error("Canvas to Blob conversion failed"));
          }
        }, "image/jpeg", 0.7); // 70% quality JPEG is perfect
      };
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function AdminPanel({ settings, players, matches }: any) {
  const [activeTab, setActiveTab] = useState<"GENERAL" | "DRAWING" | "DATABASE">("GENERAL");
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

  const handleResetAllData = async () => {
    if (confirm("⚠️ APABILA ANDA YAKIN? Tindakan ini akan menghapus SELURUH data pemain, pertandingan, dan gacha secara permanen!")) {
      const confirmTwo = confirm("⚠️ KONFIRMASI KEDUA: Apakah Anda benar-benar yakin ingin memulai liga dari awal?");
      if (confirmTwo) {
        await resetDatabase();
        alert("Database berhasil di-reset ke kondisi awal!");
      }
    }
  };

  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerCountry, setNewPlayerCountry] = useState("TBD");
  const [newPlayerWin, setNewPlayerWin] = useState(0);
  const [newPlayerLose, setNewPlayerLose] = useState(0);
  const [newPlayerGS, setNewPlayerGS] = useState(0);
  const [newPlayerGC, setNewPlayerGC] = useState(0);
  const [newPlayerPoints, setNewPlayerPoints] = useState(0);
  const [newPlayerPhotoFile, setNewPlayerPhotoFile] = useState<File | null>(null);

  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCountry, setEditingCountry] = useState("TBD");
  const [editingWin, setEditingWin] = useState(0);
  const [editingLose, setEditingLose] = useState(0);
  const [editingGS, setEditingGS] = useState(0);
  const [editingGC, setEditingGC] = useState(0);
  const [editingPoints, setEditingPoints] = useState(0);
  const [editingPhotoUrl, setEditingPhotoUrl] = useState<string | null>(null);
  const [editingPhotoFile, setEditingPhotoFile] = useState<File | null>(null);

  const [dbError, setDbError] = useState<string | null>(null);
  const [dbSuccess, setDbSuccess] = useState<string | null>(null);

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setDbError(null);
    setDbSuccess(null);
    
    if (!newPlayerName.trim()) {
      setDbError("Nama pemain wajib diisi.");
      return;
    }

    let uploadedUrl: string | null = null;
    if (newPlayerPhotoFile) {
      try {
        const compressedFile = await compressImage(newPlayerPhotoFile);
        const formData = new FormData();
        formData.append("file", compressedFile);
        const uploadRes = await uploadPlayerPhoto(formData);
        if (uploadRes.error) {
          setDbError(uploadRes.error);
          return;
        }
        uploadedUrl = uploadRes.url || null;
      } catch (e: any) {
        setDbError("Gagal kompresi foto: " + e.message);
        return;
      }
    }

    const res = await addPlayerManually(
      newPlayerName, 
      newPlayerCountry,
      Number(newPlayerWin), 
      Number(newPlayerLose), 
      Number(newPlayerGS), 
      Number(newPlayerGC), 
      Number(newPlayerPoints),
      uploadedUrl
    );

    if (res && res.error) {
      setDbError(res.error);
    } else {
      setDbSuccess(`Pemain "${newPlayerName}" berhasil ditambahkan!`);
      setNewPlayerName("");
      setNewPlayerCountry("TBD");
      setNewPlayerWin(0);
      setNewPlayerLose(0);
      setNewPlayerGS(0);
      setNewPlayerGC(0);
      setNewPlayerPoints(0);
      setNewPlayerPhotoFile(null);
      const fileInput = document.getElementById("new-player-photo") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    }
  };

  const handleDeletePlayer = async (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus pemain "${name}"? Ini juga akan menghapus pertandingan yang melibatkan pemain tersebut!`)) {
      await deletePlayer(id);
      setDbSuccess(`Pemain "${name}" berhasil dihapus.`);
    }
  };

  const handleStartEdit = (player: any) => {
    setEditingPlayerId(player.id);
    setEditingName(player.name);
    setEditingCountry(player.country || "TBD");
    setEditingWin(player.win || 0);
    setEditingLose(player.lose || 0);
    setEditingGS(player.goalsScored || 0);
    setEditingGC(player.goalsConceded || 0);
    setEditingPoints(player.points || 0);
    setEditingPhotoUrl(player.photoUrl || null);
    setEditingPhotoFile(null);
    setDbError(null);
    setDbSuccess(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) {
      setDbError("Nama pemain tidak boleh kosong.");
      return;
    }

    let uploadedUrl = editingPhotoUrl;
    if (editingPhotoFile) {
      try {
        const compressedFile = await compressImage(editingPhotoFile);
        const formData = new FormData();
        formData.append("file", compressedFile);
        const uploadRes = await uploadPlayerPhoto(formData);
        if (uploadRes.error) {
          setDbError(uploadRes.error);
          return;
        }
        uploadedUrl = uploadRes.url || null;
      } catch (e: any) {
        setDbError("Gagal kompresi foto: " + e.message);
        return;
      }
    }

    const res = await updatePlayer(
      id, 
      editingName, 
      editingCountry,
      Number(editingWin), 
      Number(editingLose), 
      Number(editingGS), 
      Number(editingGC), 
      Number(editingPoints),
      uploadedUrl
    );

    if (res && res.error) {
      setDbError(res.error);
    } else {
      setDbSuccess("Data pemain berhasil diperbarui!");
      setEditingPlayerId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingPlayerId(null);
    setDbError(null);
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
          <button 
            onClick={() => setActiveTab("DATABASE")}
            className={`px-6 py-3 font-bold uppercase transition-colors ${activeTab === "DATABASE" ? "bg-brand-neon text-brand-dark" : "text-gray-400 hover:text-white"}`}
          >
            Database
          </button>
          <button 
            onClick={async () => {
              if (confirm("Apakah Anda yakin ingin keluar dari dashboard admin?")) {
                await logoutAdmin();
              }
            }}
            className="px-6 py-3 font-bold uppercase text-red-500 hover:text-red-400 transition-colors border-l border-gray-700 ml-4 cursor-pointer"
          >
            Log Out
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
              <div className={`flex flex-col p-5 border sharp-clip transition-all duration-300 ${matches.length > 0 && (settings?.tournamentStatus === "LIVE" || settings?.tournamentStatus === "UPCOMING") ? 'border-brand-neon bg-brand-neon/10 shadow-[0_0_15px_rgba(176,251,11,0.2)]' : 'border-gray-800 bg-black/40 opacity-50'}`}>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-black text-lg uppercase tracking-wide">3. Live Match</h3>
                  {matches.length > 0 && settings?.tournamentStatus === "LIVE" && <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-neon opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-brand-neon"></span></span>}
                </div>
                <p className="text-xs text-gray-400 flex-grow mb-6">Input scores below as the tournament progresses.</p>
                {matches.length > 0 && settings?.tournamentStatus === "UPCOMING" && (
                  <div className="flex flex-col gap-2 w-full">
                    <button 
                      onClick={async () => {
                        if (confirm("Mulai turnamen sekarang? Bagan pertandingan akan dipublikasikan ke penonton.")) {
                          await setTournamentStatus("LIVE");
                        }
                      }} 
                      className="w-full bg-brand-neon hover:bg-white text-brand-dark font-black text-sm px-4 py-3 uppercase tracking-wider sharp-clip transition-colors cursor-pointer"
                    >
                      Start Tournament
                    </button>
                    <button 
                      onClick={async () => {
                        if (confirm("⚠️ PERINGATAN: Hancurkan turnamen ini? Bagan pertandingan saat ini akan dihapus dan pendaftaran akan dibuka kembali.")) {
                          await destroyTournament();
                        }
                      }} 
                      className="w-full bg-red-600 hover:bg-red-500 text-white font-black text-sm px-4 py-3 uppercase tracking-wider sharp-clip transition-colors cursor-pointer"
                    >
                      Destroy Tournament
                    </button>
                  </div>
                )}
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
                                        {/* Player A */}
                                        <div className="flex items-center gap-3">
                                          {match.playerA?.country && match.playerA?.country !== "TBD" && (
                                            <img 
                                              src={`/api/logo?team=${encodeURIComponent(match.playerA.country)}`} 
                                              alt={match.playerA.country} 
                                              className="w-6 h-6 object-contain"
                                            />
                                          )}
                                          <div className="flex flex-col flex-grow">
                                            {match.status === "COMPLETED" ? (
                                              <>
                                                <div className="text-sm font-bold uppercase truncate w-32" title={match.playerA?.name || "TBD"}>
                                                  {!match.playerAId ? "BYE" : match.playerA?.name || "TBD"}
                                                </div>
                                                <div className="text-[10px] text-brand-neon/80 font-bold uppercase truncate w-32">{!match.playerAId ? "" : match.playerA?.country}</div>
                                              </>
                                            ) : (
                                              <select
                                                value={match.playerAId || ""}
                                                onChange={async (e) => {
                                                  const val = e.target.value || null;
                                                  await updateMatchPlayers(match.id, val, match.playerBId);
                                                }}
                                                className="bg-black/60 border border-brand-neon/30 text-white text-xs font-bold p-1 rounded focus:outline-none focus:border-brand-neon max-w-[170px]"
                                              >
                                                <option value="">-- TBD / BYE --</option>
                                                {players.filter((p: any) => p.isActive).map((p: any) => (
                                                  <option key={p.id} value={p.id}>
                                                    {p.name} ({p.country})
                                                  </option>
                                                ))}
                                              </select>
                                            )}
                                          </div>
                                        </div>
                                        
                                        <div className="w-full h-px bg-gradient-to-r from-transparent via-brand-neon/30 to-transparent my-1" />
                                        
                                        {/* Player B */}
                                        <div className="flex items-center gap-3">
                                          {match.playerB?.country && match.playerB?.country !== "TBD" && (
                                            <img 
                                              src={`/api/logo?team=${encodeURIComponent(match.playerB.country)}`} 
                                              alt={match.playerB.country} 
                                              className="w-6 h-6 object-contain"
                                            />
                                          )}
                                          <div className="flex flex-col flex-grow">
                                            {match.status === "COMPLETED" ? (
                                              <>
                                                <div className="text-sm font-bold uppercase truncate w-32" title={match.playerB?.name || "TBD"}>
                                                  {!match.playerBId ? "BYE" : match.playerB?.name || "TBD"}
                                                </div>
                                                <div className="text-[10px] text-brand-neon/80 font-bold uppercase truncate w-32">{!match.playerBId ? "" : match.playerB?.country}</div>
                                              </>
                                            ) : (
                                              <select
                                                value={match.playerBId || ""}
                                                onChange={async (e) => {
                                                  const val = e.target.value || null;
                                                  await updateMatchPlayers(match.id, match.playerAId, val);
                                                }}
                                                className="bg-black/60 border border-brand-neon/30 text-white text-xs font-bold p-1 rounded focus:outline-none focus:border-brand-neon max-w-[170px]"
                                              >
                                                <option value="">-- TBD / BYE --</option>
                                                {players.filter((p: any) => p.isActive).map((p: any) => (
                                                  <option key={p.id} value={p.id}>
                                                    {p.name} ({p.country})
                                                  </option>
                                                ))}
                                              </select>
                                            )}
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

          {/* Danger Zone */}
          <div className="bg-red-950/20 border border-red-500/30 p-6 sharp-clip space-y-4">
            <h2 className="text-xl font-bold uppercase text-red-500 tracking-wider">Danger Zone</h2>
            <p className="text-xs text-gray-400">
              Perhatian: Tindakan ini akan menghapus seluruh data pemain, pertandingan, dan menyetel ulang pengaturan liga ke awal. Data yang terhapus tidak dapat dikembalikan.
            </p>
            <button 
              onClick={handleResetAllData}
              className="bg-red-600 hover:bg-red-500 text-white font-bold text-sm px-6 py-3 uppercase tracking-wider sharp-clip transition-colors cursor-pointer"
            >
              Reset Seluruh Database
            </button>
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

      {activeTab === "DATABASE" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Notifications */}
          {dbError && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 sharp-clip flex items-center space-x-2">
              <span>⚠️</span>
              <span className="font-bold text-sm">{dbError}</span>
            </div>
          )}
          {dbSuccess && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-200 p-4 sharp-clip flex items-center space-x-2">
              <span>✅</span>
              <span className="font-bold text-sm">{dbSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Input Form */}
            <div className="bg-brand-light/10 p-6 neon-border sharp-clip space-y-4 h-fit">
              <h2 className="text-xl font-bold uppercase text-brand-neon">Tambah Pemain Manual</h2>
              <form onSubmit={handleAddPlayer} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Nama Pemain</label>
                  <input 
                    type="text" 
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    className="w-full bg-black/40 border border-brand-neon/30 text-white p-3 focus:outline-none focus:border-brand-neon focus:ring-1 focus:ring-brand-neon transition-all"
                    placeholder="Contoh: Reyhan - El Dodo"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Negara / Tim (Country)</label>
                  <input 
                    type="text" 
                    value={newPlayerCountry}
                    onChange={(e) => setNewPlayerCountry(e.target.value)}
                    className="w-full bg-black/40 border border-brand-neon/30 text-white p-3 focus:outline-none focus:border-brand-neon focus:ring-1 focus:ring-brand-neon transition-all"
                    placeholder="Contoh: Portugal (atau TBD)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Foto Pemain (PNG / JPG)</label>
                  <input 
                    type="file" 
                    id="new-player-photo"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setNewPlayerPhotoFile(e.target.files[0]);
                      }
                    }}
                    className="w-full bg-black/40 border border-brand-neon/30 text-white p-2 text-sm focus:outline-none focus:border-brand-neon transition-all"
                  />
                </div>

                <div className="border-t border-brand-neon/25 pt-4 my-2">
                  <h3 className="text-sm font-bold uppercase text-brand-neon mb-3">Inject Leaderboard Stats</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Win (W)</label>
                      <input 
                        type="number" 
                        value={newPlayerWin}
                        onChange={(e) => setNewPlayerWin(Number(e.target.value))}
                        className="w-full bg-black/40 border border-brand-neon/30 text-white p-2 text-sm focus:outline-none focus:border-brand-neon"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Lose (L)</label>
                      <input 
                        type="number" 
                        value={newPlayerLose}
                        onChange={(e) => setNewPlayerLose(Number(e.target.value))}
                        className="w-full bg-black/40 border border-brand-neon/30 text-white p-2 text-sm focus:outline-none focus:border-brand-neon"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Goals Scored (GS)</label>
                      <input 
                        type="number" 
                        value={newPlayerGS}
                        onChange={(e) => setNewPlayerGS(Number(e.target.value))}
                        className="w-full bg-black/40 border border-brand-neon/30 text-white p-2 text-sm focus:outline-none focus:border-brand-neon"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Goals Conceded (GC)</label>
                      <input 
                        type="number" 
                        value={newPlayerGC}
                        onChange={(e) => setNewPlayerGC(Number(e.target.value))}
                        className="w-full bg-black/40 border border-brand-neon/30 text-white p-2 text-sm focus:outline-none focus:border-brand-neon"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Points (PTS)</label>
                    <input 
                      type="number" 
                      value={newPlayerPoints}
                      onChange={(e) => setNewPlayerPoints(Number(e.target.value))}
                      className="w-full bg-black/40 border border-brand-neon/30 text-white p-2 text-sm focus:outline-none focus:border-brand-neon"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-brand-neon text-brand-dark py-3 font-bold uppercase hover:bg-white transition-colors sharp-clip cursor-pointer flex items-center justify-center space-x-2"
                >
                  <span>Tambah Pemain</span>
                </button>
              </form>
            </div>

            {/* Right: Players Table */}
            <div className="bg-brand-light/10 p-6 neon-border sharp-clip space-y-4 lg:col-span-2">
              <h2 className="text-xl font-bold uppercase text-brand-neon font-black">Daftar Pemain & Leaderboard ({players.length})</h2>
              
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-brand-neon text-brand-dark font-black uppercase text-[11px] tracking-wider">
                      <th className="py-3 px-4 text-center w-16">Rank</th>
                      <th className="py-3 px-4 text-center w-16">Foto</th>
                      <th className="py-3 px-4">Nama Pemain</th>
                      <th className="py-3 px-4">Negara</th>
                      <th className="py-3 px-4 text-center w-28">W - L</th>
                      <th className="py-3 px-4 text-center w-28">Agregat</th>
                      <th className="py-3 px-4 text-center w-16">GD</th>
                      <th className="py-3 px-4 text-center w-20 text-brand-dark font-black">Poin</th>
                      <th className="py-3 px-4 text-center w-40">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-gray-500 italic">
                          Belum ada pemain terdaftar.
                        </td>
                      </tr>
                    ) : (
                      (() => {
                        const sortedDbPlayers = [...players].sort((a, b) => {
                          const pointsA = a.points || 0;
                          const pointsB = b.points || 0;
                          const gdA = (a.goalsScored || 0) - (a.goalsConceded || 0);
                          const gdB = (b.goalsScored || 0) - (b.goalsConceded || 0);
                          const gsA = a.goalsScored || 0;
                          const gsB = b.goalsScored || 0;
                          return pointsB - pointsA || gdB - gdA || gsB - gsA || a.name.localeCompare(b.name);
                        });

                        return sortedDbPlayers.map((p: any, idx: number) => {
                          const isEditing = editingPlayerId === p.id;
                          const gd = (isEditing ? editingGS - editingGC : (p.goalsScored || 0) - (p.goalsConceded || 0));
                          
                          return (
                            <tr key={p.id} className="border-b border-gray-800 hover:bg-white/5 transition-colors">
                              {/* Rank */}
                              <td className="py-4 px-4 text-center font-bold text-gray-400">
                                {idx + 1}
                              </td>

                              {/* Foto */}
                              <td className="py-2 px-4 text-center">
                                {isEditing ? (
                                  <div className="flex flex-col items-center gap-1">
                                    {editingPhotoUrl && (
                                      <img 
                                        src={editingPhotoUrl} 
                                        alt="Preview" 
                                        className="w-10 h-10 rounded-full object-cover border border-brand-neon"
                                      />
                                    )}
                                    <input 
                                      type="file" 
                                      id="edit-player-photo"
                                      accept="image/*"
                                      onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                          setEditingPhotoFile(e.target.files[0]);
                                          setEditingPhotoUrl(URL.createObjectURL(e.target.files[0]));
                                        }
                                      }}
                                      className="text-[10px] w-28 bg-black border border-gray-700 p-1"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex justify-center">
                                    {p.photoUrl ? (
                                      <img 
                                        src={p.photoUrl} 
                                        alt={p.name} 
                                        className="w-10 h-10 rounded-full object-cover border border-brand-neon"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded-full bg-brand-light/30 border border-gray-700 flex items-center justify-center font-bold text-xs text-gray-400">
                                        {p.name.substring(0, 2).toUpperCase()}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              
                              {/* Nama Pemain */}
                              <td className="py-4 px-4 font-bold uppercase text-white">
                                {isEditing ? (
                                  <input 
                                    type="text" 
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    className="w-full bg-black/60 border border-brand-neon/50 text-white px-2 py-1 focus:outline-none"
                                  />
                                ) : (
                                  p.name
                                )}
                              </td>

                              {/* Negara */}
                              <td className="py-4 px-4 font-bold uppercase text-white">
                                {isEditing ? (
                                  <input 
                                    type="text" 
                                    value={editingCountry}
                                    onChange={(e) => setEditingCountry(e.target.value)}
                                    className="w-full bg-black/60 border border-brand-neon/50 text-white px-2 py-1 focus:outline-none"
                                  />
                                ) : (
                                  <div className="flex items-center gap-2">
                                    {p.country && p.country !== "TBD" && (
                                      <img 
                                        src={`/api/logo?team=${encodeURIComponent(p.country)}`} 
                                        alt={p.country} 
                                        className="w-5 h-5 object-contain"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                      />
                                    )}
                                    <span>{p.country || "TBD"}</span>
                                  </div>
                                )}
                              </td>
                              
                              {/* W - L */}
                              <td className="py-4 px-4 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center space-x-1">
                                    <input 
                                      type="number" 
                                      value={editingWin}
                                      onChange={(e) => setEditingWin(Number(e.target.value))}
                                      className="w-10 bg-black/60 border border-brand-neon/50 text-white text-center py-1 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-xs"
                                    />
                                    <span className="text-gray-400">-</span>
                                    <input 
                                      type="number" 
                                      value={editingLose}
                                      onChange={(e) => setEditingLose(Number(e.target.value))}
                                      className="w-10 bg-black/60 border border-brand-neon/50 text-white text-center py-1 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-xs"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-gray-300 font-medium">{p.win || 0} - {p.lose || 0}</span>
                                )}
                              </td>
                              
                              {/* Agregat */}
                              <td className="py-4 px-4 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center space-x-1">
                                    <input 
                                      type="number" 
                                      value={editingGS}
                                      onChange={(e) => setEditingGS(Number(e.target.value))}
                                      className="w-10 bg-black/60 border border-brand-neon/50 text-white text-center py-1 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-xs"
                                    />
                                    <span className="text-gray-400">:</span>
                                    <input 
                                      type="number" 
                                      value={editingGC}
                                      onChange={(e) => setEditingGC(Number(e.target.value))}
                                      className="w-10 bg-black/60 border border-brand-neon/50 text-white text-center py-1 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-xs"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-gray-300 font-medium">{p.goalsScored || 0} : {p.goalsConceded || 0}</span>
                                )}
                              </td>
                              
                              {/* GD */}
                              <td className="py-4 px-4 text-center font-semibold text-gray-400">
                                {gd > 0 ? `+${gd}` : gd}
                              </td>
                              
                              {/* Poin */}
                              <td className="py-4 px-4 text-center font-black text-brand-neon text-base">
                                {isEditing ? (
                                  <input 
                                    type="number" 
                                    value={editingPoints}
                                    onChange={(e) => setEditingPoints(Number(e.target.value))}
                                    className="w-12 bg-black/60 border border-brand-neon/50 text-brand-neon text-center py-1 font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-sm"
                                  />
                                ) : (
                                  p.points || 0
                                )}
                              </td>
                              
                              {/* Actions */}
                              <td className="py-4 px-4 text-center">
                                {isEditing ? (
                                  <div className="flex justify-center space-x-2">
                                    <button 
                                      onClick={() => handleSaveEdit(p.id)}
                                      className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 font-bold sharp-clip uppercase text-xs cursor-pointer"
                                    >
                                      Simpan
                                    </button>
                                    <button 
                                      onClick={handleCancelEdit}
                                      className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 font-bold sharp-clip uppercase text-xs cursor-pointer"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex justify-center space-x-2">
                                    <button 
                                      onClick={() => handleStartEdit(p)}
                                      className="bg-brand-light hover:bg-brand-neon hover:text-brand-dark text-white px-3 py-1.5 font-bold sharp-clip uppercase text-xs transition-colors cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                    <button 
                                      onClick={() => handleDeletePlayer(p.id, p.name)}
                                      className="bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/40 px-3 py-1.5 font-bold sharp-clip uppercase text-xs transition-colors cursor-pointer"
                                    >
                                      Hapus
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })()
                    )}
                  </tbody>
                </table>
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
