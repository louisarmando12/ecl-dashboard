import DashboardView from "@/components/DashboardView";
import prisma from "@/lib/prisma";
import { getLeaderboard } from "./actions";

export const dynamic = 'force-dynamic';

export default async function Home() {
  // Fetch System Settings
  const systemSettings = await prisma.systemSettings.upsert({
    where: { id: "1" },
    update: {},
    create: { id: "1" },
  });

  // Fetch Players (Leaderboard)
  const leaderboard = await getLeaderboard();

  // Fetch Matches
  const matches = await prisma.match.findMany({
    include: {
      playerA: true,
      playerB: true,
      winner: true,
      loser: true,
    },
    orderBy: {
      id: 'asc'
    }
  });

  return (
    <DashboardView 
      systemSettings={systemSettings} 
      leaderboard={leaderboard} 
      matches={matches} 
    />
  );
}
