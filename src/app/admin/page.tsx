import prisma from "@/lib/prisma";
import AdminPanel from "@/components/AdminPanel";

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const systemSettings = await prisma.systemSettings.findFirst();
  const players = await prisma.player.findMany({
    orderBy: { createdAt: 'desc' }
  });
  const matches = await prisma.match.findMany({
    where: { isArchived: false },
    include: {
      playerA: true,
      playerB: true,
    },
    orderBy: {
      id: 'asc'
    }
  });

  return (
    <AdminPanel 
      settings={systemSettings} 
      players={players} 
      matches={matches} 
    />
  );
}
