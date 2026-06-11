"use client";

export default function Standings({ leaderboard }: { leaderboard: any[] }) {
  
  // Get Top 3
  const top3 = leaderboard.slice(0, 3);
  const others = leaderboard.slice(3);

  const getPodiumColor = (index: number) => {
    if (index === 0) return "border-yellow-400 text-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)]";
    if (index === 1) return "border-gray-300 text-gray-300 shadow-[0_0_20px_rgba(209,213,219,0.5)]";
    if (index === 2) return "border-amber-700 text-amber-700 shadow-[0_0_20px_rgba(180,83,9,0.5)]";
    return "";
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-24">
      
      {/* Title */}
      <div className="text-center space-y-2 mt-8">
        <h3 className="text-xl text-brand-neon italic uppercase tracking-widest">Klasemen Sementara Bulan Ini</h3>
        <h2 className="text-5xl md:text-7xl font-black uppercase leading-none">
          Overalls <br /> <span className="neon-text">Standings</span>
        </h2>
      </div>

      {/* Top 3 Podium */}
      {top3.length > 0 && (
        <div className="flex justify-center items-end space-x-4 md:space-x-8 mt-24 mb-16 h-64">
          
          {/* Rank 2 */}
          {top3[1] && (
            <div className={`w-1/4 max-w-[200px] h-[80%] bg-brand-light/30 border-t-4 border-l-4 border-r-4 ${getPodiumColor(1)} flex flex-col justify-end items-center pb-4 relative`}>
              <div className="absolute -top-12 text-6xl font-black opacity-30">2</div>
              {/* Photo Avatar */}
              <div className="absolute -top-10 md:-top-12 left-1/2 -translate-x-1/2 w-14 h-14 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-gray-300 bg-brand-dark flex items-center justify-center shadow-[0_0_15px_rgba(209,213,219,0.5)] z-20">
                {top3[1].photoUrl ? (
                  <img src={top3[1].photoUrl} alt={top3[1].name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg md:text-xl font-bold text-gray-300 opacity-60">{top3[1].name.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="text-xl font-bold uppercase text-center px-2">{top3[1].name}</div>
              <div className="text-sm opacity-80">{top3[1].points} PTS</div>
            </div>
          )}

          {/* Rank 1 */}
          {top3[0] && (
            <div className={`w-1/4 max-w-[220px] h-full bg-brand-light/50 border-t-4 border-l-4 border-r-4 ${getPodiumColor(0)} flex flex-col justify-end items-center pb-4 relative z-10`}>
              <div className="absolute -top-16 text-8xl font-black opacity-30">1</div>
              {/* Photo Avatar */}
              <div className="absolute -top-12 md:-top-16 left-1/2 -translate-x-1/2 w-16 h-16 md:w-24 md:h-24 rounded-full overflow-hidden border-2 border-yellow-400 bg-brand-dark flex items-center justify-center shadow-[0_0_15px_rgba(250,204,21,0.5)] z-20">
                {top3[0].photoUrl ? (
                  <img src={top3[0].photoUrl} alt={top3[0].name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl md:text-2xl font-black text-yellow-400 opacity-60">{top3[0].name.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="text-2xl font-black uppercase text-center px-2">{top3[0].name}</div>
              <div className="text-sm font-bold opacity-80">{top3[0].points} PTS</div>
            </div>
          )}

          {/* Rank 3 */}
          {top3[2] && (
            <div className={`w-1/4 max-w-[200px] h-[70%] bg-brand-light/20 border-t-4 border-l-4 border-r-4 ${getPodiumColor(2)} flex flex-col justify-end items-center pb-4 relative`}>
              <div className="absolute -top-10 text-5xl font-black opacity-30">3</div>
              {/* Photo Avatar */}
              <div className="absolute -top-8 md:-top-10 left-1/2 -translate-x-1/2 w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden border-2 border-amber-700 bg-brand-dark flex items-center justify-center shadow-[0_0_15px_rgba(180,83,9,0.5)] z-20">
                {top3[2].photoUrl ? (
                  <img src={top3[2].photoUrl} alt={top3[2].name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm md:text-lg font-bold text-amber-700 opacity-60">{top3[2].name.substring(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="text-lg font-bold uppercase text-center px-2">{top3[2].name}</div>
              <div className="text-sm opacity-80">{top3[2].points} PTS</div>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="bg-brand-dark/50 border border-brand-neon/20 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-brand-neon text-brand-dark text-sm md:text-base uppercase tracking-wider">
              <th className="p-4 font-black">Rank</th>
              <th className="p-4 font-black">Nama Pemain</th>
              <th className="p-4 font-black text-center hidden md:table-cell">W - L</th>
              <th className="p-4 font-black text-center hidden md:table-cell">Agregat</th>
              <th className="p-4 font-black text-center">GD</th>
              <th className="p-4 font-black text-center bg-brand-neon/80">Poin</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((player, index) => (
              <tr 
                key={player.id} 
                className="border-b border-brand-neon/10 hover:bg-brand-neon/10 transition-colors duration-200 group"
              >
                <td className="p-4 font-bold text-gray-400 group-hover:text-brand-neon">{index + 1}</td>
                <td className="p-4 font-bold uppercase text-lg group-hover:text-white">
                  {player.name}
                </td>
                <td className="p-4 text-center hidden md:table-cell font-mono">
                  {player.win} - {player.lose}
                </td>
                <td className="p-4 text-center hidden md:table-cell font-mono">
                  {player.gs} : {player.gc}
                </td>
                <td className="p-4 text-center font-mono font-bold text-gray-300">
                  {player.gd > 0 ? `+${player.gd}` : player.gd}
                </td>
                <td className="p-4 text-center font-black text-xl bg-brand-neon/5 text-brand-neon group-hover:bg-brand-neon/20">
                  {player.points}
                </td>
              </tr>
            ))}
            {leaderboard.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500 italic">Belum ada data pemain.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
    </div>
  );
}
