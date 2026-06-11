import prisma from "@/lib/prisma";
import AdminPanel from "@/components/AdminPanel";
import AdminLoginForm from "@/components/AdminLoginForm";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get("admin_auth")?.value === "true";

  if (!isAuthenticated) {
    return <AdminLoginForm />;
  }

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
