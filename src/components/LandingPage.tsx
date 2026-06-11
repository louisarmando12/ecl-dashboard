"use client";

import { useState } from "react";
import { registerPlayer } from "@/app/actions";
import { Zap, AlertTriangle } from "lucide-react";

export default function LandingPage({ settings, leaderboard }: { settings: any, leaderboard?: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldShake, setShouldShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await registerPlayer(formData);
    setIsSubmitting(false);
    
    if (result && result.error) {
      setError(result.error);
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 400);
    } else {
      setError(null);
      setIsModalOpen(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setError(null);
    setShouldShake(false);
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-16 animate-in fade-in zoom-in duration-500">
      
      {/* Hero Section */}
      <div className="text-center space-y-6 max-w-4xl mt-12 relative w-full">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-brand-neon opacity-20 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-brand-light opacity-30 blur-[100px] rounded-full pointer-events-none" />
        
        {settings?.tournamentStatus === "COMPLETED" ? (
          <div className="space-y-8 animate-in slide-in-from-bottom-10 duration-700">
            <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter leading-none relative z-10">
              <span className="block text-white drop-shadow-2xl">SEASON</span>
              <span className="block neon-text text-brand-orange drop-shadow-[0_0_20px_rgba(255,102,0,0.8)]">COMPLETED</span>
            </h1>
            <p className="text-2xl text-gray-300">Congratulations to our ultimate champion!</p>
            
            {leaderboard && leaderboard.length > 0 && (
              <div className="bg-gradient-to-b from-yellow-500/20 to-transparent p-12 border border-yellow-500/50 sharp-clip inline-block">
                <div className="text-6xl mb-4">👑</div>
                <h2 className="text-4xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,1)] uppercase">
                  {leaderboard[0].name}
                </h2>
                <p className="text-xl text-yellow-200/80 mt-2">{leaderboard[0].country}</p>
              </div>
            )}
            
            <p className="text-gray-400">See full results in the Standings tab.</p>
          </div>
        ) : (
          <>
            <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none relative z-10">
              <span className="block text-white drop-shadow-2xl">ESPORT CORPORATE</span>
              <span className="block neon-text">LEAGUE</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto mt-6">
              The ultimate battlefield for corporate warriors. Prove your skills, climb the ranks, and become the King.
            </p>

            <div className="pt-8">
              <button
                onClick={() => setIsModalOpen(true)}
                disabled={!settings?.registrationOpen}
                className={`sharp-clip uppercase font-bold text-2xl px-12 py-6 transition-all duration-300 ${
                  settings?.registrationOpen 
                    ? "bg-brand-neon text-brand-dark hover:bg-white hover:scale-105 neon-hover cursor-pointer" 
                    : "bg-gray-600 text-gray-400 cursor-not-allowed"
                }`}
              >
                {settings?.registrationOpen ? (
                  <span className="flex items-center space-x-2">
                    <Zap className="w-6 h-6" />
                    <span>Daftar Sekarang</span>
                  </span>
                ) : "Registration Closed"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Marquee */}
      <div className="w-full overflow-hidden bg-brand-dark border-y-2 border-brand-neon/30 py-4 absolute bottom-0 left-0">
        <div className="whitespace-nowrap animate-[marquee_20s_linear_infinite] inline-block">
          <span className="text-2xl font-bold italic text-brand-neon tracking-widest uppercase">
             APA KATA KING: "{settings?.currentQuote ?? 'Gua pikir big four big four itu jago. Undah gua voor main euro truck masih aja culun. Saran gua mah belajar lagi dah'}" • 
          </span>
          <span className="text-2xl font-bold italic text-brand-neon tracking-widest uppercase ml-4">
             APA KATA KING: "{settings?.currentQuote ?? 'Gua pikir big four big four itu jago. Undah gua voor main euro truck masih aja culun. Saran gua mah belajar lagi dah'}" • 
          </span>
        </div>
      </div>

      {/* Registration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-brand-dark neon-border sharp-clip p-8 max-w-md w-full relative">
            <button 
              onClick={handleCloseModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              ✕
            </button>
            <h2 className="text-3xl font-black neon-text uppercase mb-6">Join The League</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className={shouldShake ? "animate-shake" : ""}>
                <label className="block text-sm font-bold uppercase text-gray-300 mb-2">Nama Pemain</label>
                <input 
                  name="name"
                  required
                  onChange={() => {
                    if (error) setError(null);
                  }}
                  className={`w-full bg-brand-light/30 border p-3 rounded-none text-white focus:outline-none transition-all ${
                    error 
                      ? "border-red-500/80 focus:border-red-500 focus:ring-1 focus:ring-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]" 
                      : "border-brand-neon/30 focus:border-brand-neon focus:ring-1 focus:ring-brand-neon"
                  }`}
                  placeholder="e.g. Reyhan - El Dodo"
                />
                {error && (
                  <div className="text-red-400 text-xs font-bold mt-2.5 flex items-center space-x-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-brand-neon text-brand-dark sharp-clip py-4 font-bold text-xl uppercase mt-8 hover:bg-white transition-colors"
              >
                {isSubmitting ? "Submitting..." : "Submit Registration"}
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.15s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
}
