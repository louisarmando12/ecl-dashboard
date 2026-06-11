"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function registerPlayer(formData: FormData) {
  const rawName = formData.get("name") as string;
  const country = "TBD"; // Default to TBD for Live Drawing

  if (!rawName || !rawName.trim()) return { error: "Name is required" };
  const cleanName = rawName.trim();
  const lowerName = cleanName.toLowerCase();

  const settings = await prisma.systemSettings.findFirst();
  if (settings && !settings.registrationOpen) {
    return { error: "Registration is closed" };
  }

  const allPlayers = await prisma.player.findMany();
  const existingPlayer = allPlayers.find((p: any) => p.name.toLowerCase() === lowerName);

  if (existingPlayer) {
    if (existingPlayer.isActive) {
      return { error: "Player with this name is already registered." };
    } else {
      // Reactivate from previous tournament without altering the existing name case
      await prisma.player.update({
        where: { id: existingPlayer.id },
        data: { isActive: true, country }
      });
    }
  } else {
    await prisma.player.create({
      data: {
        name: cleanName,
        country,
        isActive: true
      },
    });
  }

  revalidatePath("/");
  return { success: true };
}

export async function toggleRegistration() {
  let settings = await prisma.systemSettings.findFirst();
  if (!settings) {
    settings = await prisma.systemSettings.create({ data: {} });
  }

  await prisma.systemSettings.update({
    where: { id: settings.id },
    data: { registrationOpen: !settings.registrationOpen },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function setTournamentStatus(newStatus: string) {
  let settings = await prisma.systemSettings.findFirst();
  if (!settings) {
    settings = await prisma.systemSettings.create({ data: {} });
  }

  await prisma.systemSettings.update({
    where: { id: settings.id },
    data: { tournamentStatus: newStatus },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function archiveTournament() {
  // Archive all current matches
  await prisma.match.updateMany({
    where: { isArchived: false },
    data: { isArchived: true }
  });

  // Deactivate all players for the new tournament
  await prisma.player.updateMany({
    where: { isActive: true },
    data: { isActive: false }
  });
  
  let settings = await prisma.systemSettings.findFirst();
  if (settings) {
    const crypto = require('crypto');
    await prisma.systemSettings.update({
      where: { id: settings.id },
      data: { 
        tournamentStatus: "LIVE", 
        registrationOpen: true,
        currentTournamentId: crypto.randomUUID(),
        availableCountries: settings.defaultAvailableCountries
      },
    });
  }

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function generateBracket() {
  const settings = await prisma.systemSettings.findFirst() || await prisma.systemSettings.create({ data: {} });
  
  const players = await prisma.player.findMany({
    where: { registrationStatus: "ACTIVE", isActive: true },
  });

  if (players.length < 2) return;

  const shuffled = players.sort(() => 0.5 - Math.random());
  await prisma.match.deleteMany({
    where: { isArchived: false }
  });

  const N = shuffled.length;
  const P = Math.pow(2, Math.ceil(Math.log2(N)));
  
  // Fill initial slots with BYEs
  let currentRoundSlots = new Array(P).fill("BYE");
  
  // Distribute players into A slots (1 player per pair)
  const pairsCount = P / 2;
  for (let i = 0; i < pairsCount; i++) {
    if (i < N) {
      currentRoundSlots[i * 2] = shuffled[i].id;
    }
  }

  // Distribute remaining players into B slots evenly
  const remainingPlayers = N - pairsCount;
  if (remainingPlayers > 0) {
    const step = pairsCount / remainingPlayers;
    for (let i = 0; i < remainingPlayers; i++) {
      const pairIdx = Math.floor(i * step);
      currentRoundSlots[pairIdx * 2 + 1] = shuffled[pairsCount + i].id;
    }
  }

  let roundNum = 1;

  while (currentRoundSlots.length > 1) {
    const nextRoundSlots: (string | null)[] = [];
    const matchesInRound = currentRoundSlots.length / 2;
    
    for (let i = 0; i < matchesInRound; i++) {
      const pA = currentRoundSlots[i * 2];
      const pB = currentRoundSlots[i * 2 + 1];
      const bracketNum = i + 1;

      const actualPA = pA === "TBD" || pA === "BYE" ? null : pA;
      const actualPB = pB === "TBD" || pB === "BYE" ? null : pB;

      const countryA = actualPA ? players.find(p => p.id === actualPA)?.country : null;
      const countryB = actualPB ? players.find(p => p.id === actualPB)?.country : null;

      let winnerId = null;
      let status = "UPCOMING";
      let scoreA = null;
      let scoreB = null;

      if (pA === "BYE" && pB === "BYE") {
        nextRoundSlots.push("BYE");
        continue; // Do not create a match if both are BYEs
      } else if (pA !== "BYE" && pB === "BYE") {
        winnerId = actualPA;
        status = "COMPLETED";
        scoreA = 0;
        scoreB = 0;
        nextRoundSlots.push(actualPA);
      } else if (pA === "BYE" && pB !== "BYE") {
        winnerId = actualPB;
        status = "COMPLETED";
        scoreA = 0;
        scoreB = 0;
        nextRoundSlots.push(actualPB);
      } else {
        nextRoundSlots.push("TBD");
      }

      await prisma.match.create({
        data: {
          matchNumber: `ECL-R${roundNum}-${bracketNum}`,
          bracket: bracketNum,
          round: `Round ${roundNum}`,
          tournamentId: settings.currentTournamentId,
          playerAId: actualPA,
          playerACountry: countryA,
          playerBId: actualPB,
          playerBCountry: countryB,
          winnerId,
          status,
          scoreA,
          scoreB
        }
      });
    }
    
    currentRoundSlots = nextRoundSlots;
    roundNum++;
  }

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function updateMatchScore(matchId: string, scoreA: number, scoreB: number) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { playerA: true, playerB: true } });
  if (!match) return;

  const winnerId = scoreA > scoreB ? match.playerAId : scoreB > scoreA ? match.playerBId : null;
  const loserId = scoreA > scoreB ? match.playerBId : scoreB > scoreA ? match.playerAId : null;

  await prisma.match.update({
    where: { id: matchId },
    data: {
      scoreA,
      scoreB,
      winnerId,
      loserId,
      status: "COMPLETED",
    },
  });

  // Bracket Progression Logic
  if (winnerId) {
    const currentRoundNum = parseInt(match.round.replace("Round ", "")) || 1;
    const nextRoundNum = currentRoundNum + 1;
    const nextBracket = Math.ceil(match.bracket / 2);
    const isOddBracket = match.bracket % 2 !== 0;
    const nextMatchNumber = `ECL-R${nextRoundNum}-${nextBracket}`;

    // Try to find the next match in the SAME tournament and MUST be active
    const nextMatch = await prisma.match.findFirst({
      where: { 
        matchNumber: nextMatchNumber,
        tournamentId: match.tournamentId,
        isArchived: false
      }
    });

    if (nextMatch) {
      const winnerCountry = scoreA > scoreB ? match.playerACountry : scoreB > scoreA ? match.playerBCountry : null;
      
      // Update existing next round match
      await prisma.match.update({
        where: { id: nextMatch.id },
        data: {
          playerAId: isOddBracket ? winnerId : nextMatch.playerAId,
          playerACountry: isOddBracket && winnerCountry ? winnerCountry : nextMatch.playerACountry,
          playerBId: !isOddBracket ? winnerId : nextMatch.playerBId,
          playerBCountry: !isOddBracket && winnerCountry ? winnerCountry : nextMatch.playerBCountry,
        }
      });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/");
}

// Function to fetch leaderboard and calculate stats dynamically
export async function getLeaderboard() {
  const players = await prisma.player.findMany({
    include: {
      matchesAsA: { where: { status: "COMPLETED" } },
      matchesAsB: { where: { status: "COMPLETED" } }
    }
  });

  const allMatches = await prisma.match.findMany();
  const tournamentMatches: Record<string, any[]> = {};
  allMatches.forEach(m => {
    if (!tournamentMatches[m.tournamentId]) tournamentMatches[m.tournamentId] = [];
    tournamentMatches[m.tournamentId].push(m);
  });

  const playerTourneyPoints: Record<string, number> = {};

  for (const [tId, matches] of Object.entries(tournamentMatches)) {
    const trueMaxRound = Math.max(...matches.map(m => parseInt(m.round.replace("Round ", "")) || 1));
    
    const participantIds = new Set<string>();
    matches.forEach(m => {
      if (m.playerAId && m.playerAId !== "BYE" && m.playerAId !== "TBD") participantIds.add(m.playerAId);
      if (m.playerBId && m.playerBId !== "BYE" && m.playerBId !== "TBD") participantIds.add(m.playerBId);
    });

    participantIds.forEach(pId => {
      const lossMatch = matches.find(m => m.loserId === pId);
      const finalWin = matches.find(m => m.winnerId === pId && parseInt(m.round.replace("Round ", "")) === trueMaxRound);

      let points = 0;
      if (finalWin) {
        points = 10;
      } else if (lossMatch) {
        const lossRound = parseInt(lossMatch.round.replace("Round ", "")) || 1;
        if (lossRound === trueMaxRound) points = 7;
        else if (lossRound === trueMaxRound - 1) points = 4;
        else if (lossRound === trueMaxRound - 2) points = 2;
        else points = 1;
      } else {
        const highestRound = Math.max(...matches
          .filter(m => m.playerAId === pId || m.playerBId === pId)
          .map(m => parseInt(m.round.replace("Round ", "")) || 1), 1);
        
        if (highestRound === trueMaxRound) points = 7;
        else if (highestRound === trueMaxRound - 1) points = 4;
        else if (highestRound === trueMaxRound - 2) points = 2;
        else points = 1;
      }

      playerTourneyPoints[pId] = (playerTourneyPoints[pId] || 0) + points;
    });
  }

  const stats = players.map(p => {
    let win = 0, lose = 0, gs = 0, gc = 0;

    p.matchesAsA.forEach(m => {
      gs += m.scoreA || 0;
      gc += m.scoreB || 0;
      if (m.winnerId === p.id) win++;
      if (m.loserId === p.id) lose++;
    });

    p.matchesAsB.forEach(m => {
      gs += m.scoreB || 0;
      gc += m.scoreA || 0;
      if (m.winnerId === p.id) win++;
      if (m.loserId === p.id) lose++;
    });

    const points = (playerTourneyPoints[p.id] || 0) + p.points;
    const finalWin = win + p.win;
    const finalLose = lose + p.lose;
    const finalGs = gs + p.goalsScored;
    const finalGc = gc + p.goalsConceded;
    const gd = finalGs - finalGc;

    return { ...p, win: finalWin, lose: finalLose, gs: finalGs, gc: finalGc, gd, points };
  }).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gs - a.gs || a.name.localeCompare(b.name));

  return stats;
}

// =======================
// DRAWING ACTIONS
// =======================

export async function updateAvailableCountries(countriesStr: string) {
  let settings = await prisma.systemSettings.findFirst();
  if (!settings) {
    settings = await prisma.systemSettings.create({ data: {} });
  }

  await prisma.systemSettings.update({
    where: { id: settings.id },
    data: { availableCountries: countriesStr, defaultAvailableCountries: countriesStr },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function startDrawing(playerId: string) {
  let settings = await prisma.systemSettings.findFirst();
  if (!settings) return;

  await prisma.systemSettings.update({
    where: { id: settings.id },
    data: { 
      isDrawingLive: true,
      currentDrawingPlayerId: playerId
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function finishDrawing(playerId: string, country: string, newAvailableCountriesStr: string) {
  let settings = await prisma.systemSettings.findFirst();
  if (!settings) return;

  // Update the player's country
  await prisma.player.update({
    where: { id: playerId },
    data: { country },
  });

  // Turn off drawing mode and update available countries
  await prisma.systemSettings.update({
    where: { id: settings.id },
    data: { 
      isDrawingLive: false,
      // Do NOT set currentDrawingPlayerId to null so the client can still fetch their result!
      availableCountries: newAvailableCountriesStr
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function getDrawingState() {
  const settings = await prisma.systemSettings.findFirst();
  let player = null;
  if (settings?.currentDrawingPlayerId) {
    player = await prisma.player.findUnique({ where: { id: settings.currentDrawingPlayerId } });
  }
  return {
    isDrawingLive: settings?.isDrawingLive || false,
    player: player ? { id: player.id, name: player.name, country: player.country } : null,
    availableTeams: JSON.parse(settings?.availableCountries || "[]")
  };
}

export async function forceResetDrawing() {
  const settings = await prisma.systemSettings.findFirst();
  if (settings) {
    await prisma.systemSettings.update({
      where: { id: settings.id },
      data: { isDrawingLive: false, currentDrawingPlayerId: null }
    });
  }
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function resetDatabase() {
  // Delete all matches
  await prisma.match.deleteMany({});
  
  // Delete all players
  await prisma.player.deleteMany({});
  
  // Reset system settings
  await prisma.systemSettings.deleteMany({});
  await prisma.systemSettings.create({
    data: {
      id: "1",
      tournamentStatus: "UPCOMING",
      registrationOpen: true,
      currentTournamentId: "1",
      availableCountries: "[]",
      defaultAvailableCountries: "[]",
      logoUrls: "{}",
      isDrawingLive: false,
      currentDrawingPlayerId: null,
      currentQuote: "Gua pikir big four big four itu jago. Undah gua voor main euro truck masih aja culun. Saran gua mah belajar lagi dah"
    }
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function deletePlayer(playerId: string) {
  // Delete matches referencing this player to prevent foreign key errors
  await prisma.match.deleteMany({
    where: {
      OR: [
        { playerAId: playerId },
        { playerBId: playerId }
      ]
    }
  });

  await prisma.player.delete({
    where: { id: playerId }
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function addPlayerManually(
  name: string, 
  win: number = 0, 
  lose: number = 0, 
  goalsScored: number = 0, 
  goalsConceded: number = 0, 
  points: number = 0
) {
  if (!name || !name.trim()) return { error: "Nama pemain wajib diisi." };
  const cleanName = name.trim();

  const existingPlayer = await prisma.player.findUnique({
    where: { name: cleanName }
  });

  if (existingPlayer) {
    return { error: "Pemain dengan nama ini sudah terdaftar." };
  }

  await prisma.player.create({
    data: {
      name: cleanName,
      country: "TBD",
      isActive: true,
      win: win,
      lose: lose,
      goalsScored: goalsScored,
      goalsConceded: goalsConceded,
      points: points
    }
  });

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function updatePlayer(
  playerId: string, 
  name: string, 
  win: number, 
  lose: number, 
  goalsScored: number, 
  goalsConceded: number, 
  points: number
) {
  if (!name || !name.trim()) return { error: "Nama pemain wajib diisi." };
  const cleanName = name.trim();

  const existingPlayer = await prisma.player.findFirst({
    where: {
      name: cleanName,
      NOT: { id: playerId }
    }
  });

  if (existingPlayer) {
    return { error: "Pemain dengan nama ini sudah digunakan oleh pemain lain." };
  }

  await prisma.player.update({
    where: { id: playerId },
    data: {
      name: cleanName,
      win: win,
      lose: lose,
      goalsScored: goalsScored,
      goalsConceded: goalsConceded,
      points: points
    }
  });

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function loginAdmin(password: string) {
  const adminPassword = process.env.ADMIN_PASSWORD || "ecladmin"; // Fallback to "ecladmin"
  
  if (password === adminPassword) {
    const cookieStore = await cookies();
    cookieStore.set("admin_auth", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 // 1 day
    });
    return { success: true };
  }
  
  return { error: "Password salah!" };
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_auth");
  revalidatePath("/admin");
  revalidatePath("/");
}


