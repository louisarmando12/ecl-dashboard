"use client";

import { useState } from "react";
import LandingPage from "./LandingPage";
import TournamentHub from "./TournamentHub";
import Standings from "./Standings";

export default function DashboardView({
  systemSettings,
  players,
  matches,
  leaderboard,
}: any) {
  const [activeTab, setActiveTab] = useState("HOME");

  return (
    <div className="min-h-screen pb-20">
      {/* Navigation */}
      <nav className="flex justify-center space-x-8 p-6 bg-brand-dark/80 backdrop-blur-md sticky top-0 z-50 border-b border-brand-neon/20">
        {["HOME", "TOURNAMENT", "STANDINGS"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-xl font-bold uppercase tracking-wider transition-all duration-300 ${
              activeTab === tab
                ? "neon-text border-b-2 border-brand-neon pb-1"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="container mx-auto p-4 mt-8">
        {activeTab === "HOME" && (
          <LandingPage settings={systemSettings} leaderboard={leaderboard} />
        )}
        {activeTab === "TOURNAMENT" && (
          <TournamentHub matches={matches} settings={systemSettings} />
        )}
        {activeTab === "STANDINGS" && (
          <Standings leaderboard={leaderboard} />
        )}
      </main>
    </div>
  );
}
