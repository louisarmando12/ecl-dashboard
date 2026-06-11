"use client";

import { useState } from "react";
import { loginAdmin } from "@/app/actions";
import { Lock, AlertTriangle } from "lucide-react";

export default function AdminLoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await loginAdmin(password);
    setIsSubmitting(false);

    if (res && res.error) {
      setError(res.error);
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 400);
    } else {
      // Successful login will refresh the page via server action, loading the dashboard
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-esports flex items-center justify-center p-4">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-neon opacity-10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-light opacity-20 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="bg-brand-dark/90 neon-border sharp-clip p-8 max-w-md w-full relative backdrop-blur-md z-10 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-brand-neon/10 rounded-full border border-brand-neon/40 flex items-center justify-center text-brand-neon mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-white">
            ADMIN <span className="text-brand-neon">LOGIN</span>
          </h1>
          <p className="text-gray-400 text-xs mt-1 uppercase tracking-widest">
            Esports Corporate League Dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className={shouldShake ? "animate-shake" : ""}>
            <label className="block text-xs font-bold uppercase text-gray-300 mb-2">Password Admin</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              required
              className={`w-full bg-brand-light/30 border p-3 rounded-none text-white focus:outline-none transition-all text-center tracking-widest ${
                error 
                  ? "border-red-500/80 focus:border-red-500 focus:ring-1 focus:ring-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]" 
                  : "border-brand-neon/30 focus:border-brand-neon focus:ring-1 focus:ring-brand-neon"
              }`}
              placeholder="••••••••"
            />
            {error && (
              <div className="text-red-400 text-xs font-bold mt-2.5 flex items-center justify-center space-x-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-neon text-brand-dark sharp-clip py-4 font-bold text-lg uppercase hover:bg-white transition-colors cursor-pointer"
          >
            {isSubmitting ? "Authenticating..." : "Masuk"}
          </button>
        </form>
      </div>

      <style jsx>{`
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
