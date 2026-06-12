"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { put } from "@vercel/blob";
import fs from "fs";
import path from "path";

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

export async function generateBracket(customSize?: number) {
  const settings = await prisma.systemSettings.findFirst() || await prisma.systemSettings.create({ data: {} });
  
  const bracketTypeStr = customSize ? String(customSize) : "auto";
  await prisma.systemSettings.update({
    where: { id: settings.id },
    data: { bracketType: bracketTypeStr }
  });

  const players = await prisma.player.findMany({
    where: { registrationStatus: "ACTIVE", isActive: true },
  });

  if (players.length < 2) return;

  const shuffled = players.sort(() => 0.5 - Math.random());
  await prisma.match.deleteMany({
    where: { isArchived: false }
  });

  const N = shuffled.length;
  const P = customSize || Math.pow(2, Math.ceil(Math.log2(N)));
  
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
        if (!customSize) {
          continue; // Do not create a match if both are BYEs and in auto mode
        }
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

async function isSlotBye(roundNum: number, bracketNum: number, isPlayerA: boolean, tournamentId: string): Promise<boolean> {
  if (roundNum === 1) {
    return true; // In Round 1, a null slot is always a BYE
  }
  const prevBracket = isPlayerA ? bracketNum * 2 - 1 : bracketNum * 2;
  const prevMatch = await prisma.match.findFirst({
    where: {
      round: `Round ${roundNum - 1}`,
      bracket: prevBracket,
      tournamentId,
      isArchived: false
    }
  });
  return !prevMatch; // It is a BYE if there is no feeding match
}

async function propagateMatchChanges(matchId: string) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { playerA: true, playerB: true }
  });
  if (!match) return;

  const currentRoundNum = parseInt(match.round.replace("Round ", "")) || 1;
  const currentBracket = match.bracket;

  let status = match.status;
  let scoreA = match.scoreA;
  let scoreB = match.scoreB;
  let winnerId = match.winnerId;
  let loserId = match.loserId;

  // Determine if Player A and/or Player B slots are BYEs
  const isPlayerABye = !match.playerAId && await isSlotBye(currentRoundNum, currentBracket, true, match.tournamentId);
  const isPlayerBBye = !match.playerBId && await isSlotBye(currentRoundNum, currentBracket, false, match.tournamentId);

  if (!match.playerAId && !match.playerBId && isPlayerABye && isPlayerBBye) {
    // Both slots are empty BYEs
    status = "UPCOMING";
    scoreA = null;
    scoreB = null;
    winnerId = null;
    loserId = null;
  } else if (match.playerAId && isPlayerBBye) {
    // Player A is present, Player B is a BYE
    status = "COMPLETED";
    scoreA = 0;
    scoreB = 0;
    winnerId = match.playerAId;
    loserId = null;
  } else if (isPlayerABye && match.playerBId) {
    // Player B is present, Player A is a BYE
    status = "COMPLETED";
    scoreA = 0;
    scoreB = 0;
    winnerId = match.playerBId;
    loserId = null;
  } else {
    // Neither slot is a completed BYE (both are players, or one is player and one is TBD, or both are TBD).
    // If it was already completed with actual scores (e.g. from updateMatchScore), keep it as completed.
    // Otherwise, it is UPCOMING and scores/winner should be reset/null.
    if (match.status === "COMPLETED" && match.scoreA !== null && match.scoreB !== null && match.scoreA !== match.scoreB) {
      status = "COMPLETED";
      scoreA = match.scoreA;
      scoreB = match.scoreB;
      winnerId = scoreA > scoreB ? match.playerAId : match.playerBId;
      loserId = scoreA > scoreB ? match.playerBId : match.playerAId;
    } else {
      status = "UPCOMING";
      scoreA = null;
      scoreB = null;
      winnerId = null;
      loserId = null;
    }
  }

  // Update this match
  await prisma.match.update({
    where: { id: match.id },
    data: {
      status,
      scoreA,
      scoreB,
      winnerId,
      loserId,
    }
  });

  // Find next round match
  const nextRoundNum = currentRoundNum + 1;
  const nextBracket = Math.ceil(currentBracket / 2);
  const isOddBracket = currentBracket % 2 !== 0;
  const nextMatchNumber = `ECL-R${nextRoundNum}-${nextBracket}`;

  const nextMatch = await prisma.match.findFirst({
    where: {
      matchNumber: nextMatchNumber,
      tournamentId: match.tournamentId,
      isArchived: false
    }
  });

  if (nextMatch) {
    // Fetch details for next player
    const winnerPlayer = winnerId ? await prisma.player.findUnique({ where: { id: winnerId } }) : null;

    // Update next match's corresponding slot
    await prisma.match.update({
      where: { id: nextMatch.id },
      data: {
        playerAId: isOddBracket ? winnerId : nextMatch.playerAId,
        playerACountry: isOddBracket ? (winnerPlayer?.country || null) : nextMatch.playerACountry,
        playerBId: !isOddBracket ? winnerId : nextMatch.playerBId,
        playerBCountry: !isOddBracket ? (winnerPlayer?.country || null) : nextMatch.playerBCountry,
      }
    });

    // Recursively propagate
    await propagateMatchChanges(nextMatch.id);
  }
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

  // Call the propagation helper to update next rounds recursively
  await propagateMatchChanges(matchId);

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
    const trueMaxRound = Math.max(...matches.map(m => parseInt(m.round.replace("Round ", "")) || 1), 1);
    
    const participantIds = new Set<string>();
    matches.forEach(m => {
      if (m.playerAId && m.playerAId !== "BYE" && m.playerAId !== "TBD") participantIds.add(m.playerAId);
      if (m.playerBId && m.playerBId !== "BYE" && m.playerBId !== "TBD") participantIds.add(m.playerBId);
    });

    const processedPlayersInTourney = new Set<string>();
    const round1Matches = matches.filter(m => m.round === "Round 1");

    round1Matches.forEach(r1Match => {
      const slots = [
        { playerId: r1Match.playerAId, initialMatch: r1Match },
        { playerId: r1Match.playerBId, initialMatch: r1Match }
      ];

      slots.forEach(slot => {
        const pId = slot.playerId;
        if (!pId || pId === "BYE" || pId === "TBD") return;

        processedPlayersInTourney.add(pId);

        let currentMatch = slot.initialMatch;
        let pointsForSlot = 0;

        while (true) {
          const currentRound = parseInt(currentMatch.round.replace("Round ", "")) || 1;
          const currentBracket = currentMatch.bracket;

          if (currentMatch.status === "COMPLETED") {
            if (currentMatch.winnerId === pId) {
              if (currentRound === trueMaxRound) {
                pointsForSlot = 10; // Won the finals
                break;
              } else {
                const nextRound = currentRound + 1;
                const nextBracket = Math.ceil(currentBracket / 2);
                const nextMatch = matches.find(m => 
                  m.round === `Round ${nextRound}` && m.bracket === nextBracket
                );
                if (nextMatch) {
                  currentMatch = nextMatch;
                } else {
                  // No next match created yet, treat as active in current round
                  if (currentRound === trueMaxRound) pointsForSlot = 7;
                  else if (currentRound === trueMaxRound - 1) pointsForSlot = 7;
                  else if (currentRound === trueMaxRound - 2) pointsForSlot = 4;
                  else if (currentRound === trueMaxRound - 3) pointsForSlot = 2;
                  else pointsForSlot = 1;
                  break;
                }
              }
            } else if (currentMatch.loserId === pId) {
              // Lost in this round
              if (currentRound === trueMaxRound) pointsForSlot = 7;
              else if (currentRound === trueMaxRound - 1) pointsForSlot = 4;
              else if (currentRound === trueMaxRound - 2) pointsForSlot = 2;
              else pointsForSlot = 1;
              break;
            } else {
              // Fallback
              if (currentRound === trueMaxRound) pointsForSlot = 7;
              else if (currentRound === trueMaxRound - 1) pointsForSlot = 4;
              else if (currentRound === trueMaxRound - 2) pointsForSlot = 2;
              else pointsForSlot = 1;
              break;
            }
          } else {
            // Match is UPCOMING, active in this round
            if (currentRound === trueMaxRound) pointsForSlot = 7;
            else if (currentRound === trueMaxRound - 1) pointsForSlot = 4;
            else if (currentRound === trueMaxRound - 2) pointsForSlot = 2;
            else pointsForSlot = 1;
            break;
          }
        }

        playerTourneyPoints[pId] = (playerTourneyPoints[pId] || 0) + pointsForSlot;
      });
    });

    // Fallback for players who were manually inserted/moved in later rounds and have no Round 1 slot
    const unpaidPlayers = [...participantIds].filter(pId => !processedPlayersInTourney.has(pId));
    unpaidPlayers.forEach(pId => {
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
  country: string = "TBD",
  win: number = 0, 
  lose: number = 0, 
  goalsScored: number = 0, 
  goalsConceded: number = 0, 
  points: number = 0,
  photoUrl: string | null = null
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
      country: country.trim() || "TBD",
      isActive: true,
      win: win,
      lose: lose,
      goalsScored: goalsScored,
      goalsConceded: goalsConceded,
      points: points,
      photoUrl: photoUrl
    }
  });

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function updatePlayer(
  playerId: string, 
  name: string, 
  country: string,
  win: number, 
  lose: number, 
  goalsScored: number, 
  goalsConceded: number, 
  points: number,
  photoUrl: string | null = null
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

  const cleanCountry = country.trim() || "TBD";

  await prisma.player.update({
    where: { id: playerId },
    data: {
      name: cleanName,
      country: cleanCountry,
      win: win,
      lose: lose,
      goalsScored: goalsScored,
      goalsConceded: goalsConceded,
      points: points,
      photoUrl: photoUrl
    }
  });

  // Also update matches cached country values
  await prisma.match.updateMany({
    where: { playerAId: playerId, isArchived: false },
    data: { playerACountry: cleanCountry }
  });
  await prisma.match.updateMany({
    where: { playerBId: playerId, isArchived: false },
    data: { playerBCountry: cleanCountry }
  });

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function updateMatchPlayers(
  matchId: string, 
  playerAId: string | null, 
  playerBId: string | null
) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return { error: "Pertandingan tidak ditemukan." };

  let playerACountry = null;
  let playerBCountry = null;

  if (playerAId) {
    const playerA = await prisma.player.findUnique({ where: { id: playerAId } });
    if (playerA) playerACountry = playerA.country;
  }
  
  if (playerBId) {
    const playerB = await prisma.player.findUnique({ where: { id: playerBId } });
    if (playerB) playerBCountry = playerB.country;
  }

  await prisma.match.update({
    where: { id: matchId },
    data: {
      playerAId: playerAId || null,
      playerACountry,
      playerBId: playerBId || null,
      playerBCountry,
    }
  });

  // Call the propagation helper to automatically compute status/byes/winners and propagate to next rounds!
  await propagateMatchChanges(matchId);

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

export async function destroyTournament() {
  const settings = await prisma.systemSettings.findFirst();
  if (!settings) return { error: "Settings not found" };

  // Delete all unarchived matches
  await prisma.match.deleteMany({
    where: { isArchived: false }
  });

  // Reset system settings
  await prisma.systemSettings.update({
    where: { id: settings.id },
    data: {
      tournamentStatus: "UPCOMING",
      registrationOpen: true
    }
  });

  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true };
}

export async function uploadPlayerPhoto(formData: FormData) {
  const file = formData.get("file") as File;
  if (!file) return { error: "No file provided" };

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // clean filename
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `players/${Date.now()}-${cleanFileName}`;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(filename, buffer, {
        access: 'public',
        contentType: file.type
      });
      return { url: blob.url };
    } else {
      // If running online (e.g., on Vercel), we cannot save files locally due to read-only ephemeral filesystem
      if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
        return { 
          error: "Penyimpanan foto online belum aktif. Silakan aktifkan/hubungkan Vercel Blob di dashboard Vercel Anda, lalu redeploy aplikasi." 
        };
      }

      // Save locally (only for local development)
      const publicDir = path.join(process.cwd(), 'public', 'players');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      const dest = path.join(publicDir, cleanFileName);
      fs.writeFileSync(dest, buffer);
      return { url: `/players/${cleanFileName}` };
    }
  } catch (error: any) {
    console.error("Upload error:", error);
    return { error: error.message || "Failed to upload photo" };
  }
}




