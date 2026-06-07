import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function simulateRegistration(playerNames: string[]) {
  console.log('--- Registering Players ---');
  for (const rawName of playerNames) {
    const cleanName = rawName.trim();
    const lowerName = cleanName.toLowerCase();
    
    const allPlayers = await prisma.player.findMany();
    const existingPlayer = allPlayers.find((p: any) => p.name.toLowerCase() === lowerName);

    if (existingPlayer) {
      if (existingPlayer.isActive) {
        console.log(`[Duplicate Rejected] ${cleanName} is already active.`);
      } else {
        await prisma.player.update({
          where: { id: existingPlayer.id },
          data: { isActive: true, country: "TBD" }
        });
        console.log(`[Reactivated] ${cleanName} is returning for a new season!`);
      }
    } else {
      await prisma.player.create({
        data: { name: cleanName, country: "TBD", isActive: true }
      });
      console.log(`[Registered] New player ${cleanName} joined.`);
    }
  }
}

async function simulateGacha() {
  console.log('--- Spinning Gacha ---');
  const activePlayers = await prisma.player.findMany({ where: { isActive: true } });
  
  let settings = await prisma.systemSettings.findFirst();
  let available = JSON.parse(settings?.availableCountries || "[]");
  if (available.length === 0) {
      available = ["Portugal", "Argentina", "France", "Germany"];
  }

  for (const player of activePlayers) {
    const pickedCountry = available.pop();
    if (!pickedCountry) break;

    await prisma.player.update({
      where: { id: player.id },
      data: { country: pickedCountry }
    });
    console.log(`[Drafted] ${player.name} drafted ${pickedCountry}`);
  }

  await prisma.systemSettings.update({
    where: { id: settings!.id },
    data: { availableCountries: JSON.stringify(available) }
  });
}

async function simulateBracket() {
  console.log('--- Generating Bracket ---');
  const players = await prisma.player.findMany({ where: { isActive: true, NOT: { country: "TBD" } } });
  // For a 4-player tournament, we need 2 Semifinal matches
  await prisma.match.deleteMany({});
  
  const m1 = await prisma.match.create({
    data: { bracket: 1, matchNumber: "1", round: "1", playerAId: players[0].id, playerACountry: players[0].country, playerBId: players[1].id, playerBCountry: players[1].country, status: 'PENDING' }
  });
  const m2 = await prisma.match.create({
    data: { bracket: 1, matchNumber: "2", round: "1", playerAId: players[2].id, playerACountry: players[2].country, playerBId: players[3].id, playerBCountry: players[3].country, status: 'PENDING' }
  });
  
  const final = await prisma.match.create({
    data: { bracket: 1, matchNumber: "3", round: "2", status: 'PENDING' } // Final
  });
  
  console.log(`[Bracket] Generated Semifinals and Final`);
  return { m1, m2, final };
}

async function updateScore(matchId: string, scoreA: number, scoreB: number) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { playerA: true, playerB: true } });
  if (!match) return;

  const winnerId = scoreA > scoreB ? match.playerAId : match.playerBId;
  const loserId = scoreA > scoreB ? match.playerBId : match.playerAId;

  await prisma.match.update({
    where: { id: matchId },
    data: { scoreA, scoreB, winnerId, loserId, status: 'COMPLETED' }
  });
  console.log(`[Match] Match ${matchId} completed: ${scoreA}-${scoreB}`);
  
  // Progress to final if round 1
  if (match.round === "1") {
      const final = await prisma.match.findFirst({ where: { round: "2" } });
      if (final) {
          const winnerCountry = winnerId === match.playerAId ? match.playerACountry : match.playerBCountry;
          if (match.matchNumber === "1") await prisma.match.update({ where: { id: final.id }, data: { playerAId: winnerId, playerACountry: winnerCountry } });
          if (match.matchNumber === "2") await prisma.match.update({ where: { id: final.id }, data: { playerBId: winnerId, playerBCountry: winnerCountry } });
      }
  }
}

async function archiveTournament() {
  console.log('--- Archiving Tournament ---');
  const matches = await prisma.match.findMany({ where: { isArchived: false, status: 'COMPLETED' }, include: { playerA: true, playerB: true } });
  
  for (const m of matches) {
      if (!m.playerAId || !m.playerBId) continue;
      
      const pA = m.playerA;
      const pB = m.playerB;
      
      // Update pA stats
      await prisma.player.update({
          where: { id: pA!.id },
          data: {
              win: m.winnerId === pA!.id ? pA!.win + 1 : pA!.win,
              lose: m.loserId === pA!.id ? pA!.lose + 1 : pA!.lose,
              goalsScored: pA!.goalsScored + (m.scoreA || 0),
              goalsConceded: pA!.goalsConceded + (m.scoreB || 0),
              goalDifference: (pA!.goalsScored + (m.scoreA || 0)) - (pA!.goalsConceded + (m.scoreB || 0)),
              points: m.winnerId === pA!.id ? pA!.points + 3 : pA!.points
          }
      });
      // Update pB stats
      await prisma.player.update({
          where: { id: pB!.id },
          data: {
              win: m.winnerId === pB!.id ? pB!.win + 1 : pB!.win,
              lose: m.loserId === pB!.id ? pB!.lose + 1 : pB!.lose,
              goalsScored: pB!.goalsScored + (m.scoreB || 0),
              goalsConceded: pB!.goalsConceded + (m.scoreA || 0),
              goalDifference: (pB!.goalsScored + (m.scoreB || 0)) - (pB!.goalsConceded + (m.scoreA || 0)),
              points: m.winnerId === pB!.id ? pB!.points + 3 : pB!.points
          }
      });
  }

  await prisma.match.updateMany({ where: { isArchived: false }, data: { isArchived: true } });
  await prisma.player.updateMany({ where: { isActive: true }, data: { isActive: false } });
  
  console.log('[Archive] All players deactivated and match stats updated.');
}

async function printLeaderboard() {
    const players = await prisma.player.findMany({
        orderBy: [
            { points: 'desc' },
            { goalDifference: 'desc' },
            { goalsScored: 'desc' },
            { name: 'asc' }
        ]
    });
    console.log('--- LEADERBOARD ---');
    players.forEach((p: any, i: number) => {
        console.log(`${i+1}. ${p.name} - PTS: ${p.points} | W: ${p.win} | L: ${p.lose} | GS: ${p.goalsScored} | GC: ${p.goalsConceded} | GD: ${p.goalDifference}`);
    });
}

async function run() {
  const players = ["Alice", "Bob", "Charlie", "Dave"];
  
  for (let season = 1; season <= 3; season++) {
    // Refill pool to 48 countries for simulation
  await prisma.systemSettings.updateMany({ data: { availableCountries: JSON.stringify(["Argentina", "Brazil", "France", "Germany", "Spain", "England", "Italy", "Netherlands", "Portugal", "Belgium", "Uruguay", "Croatia", "Colombia", "Mexico", "USA", "Japan", "Senegal", "Morocco", "Switzerland", "Denmark"]) }});

  console.log(`\n============================`);
    console.log(`      SEASON ${season} STARTING   `);
    console.log(`============================`);
    
    // Test duplicate registration in the same tournament
    await simulateRegistration([...players, "Alice"]); 
    
    await simulateGacha();
    const brackets = await simulateBracket();
    
    // Alice vs Bob (Alice wins 3-1)
    await updateScore(brackets.m1.id, 3, 1);
    // Charlie vs Dave (Dave wins 2-0)
    await updateScore(brackets.m2.id, 0, 2);
    
    // Final: Alice vs Dave
    const finalMatch = await prisma.match.findFirst({ where: { round: "2" } });
    if (finalMatch) {
        // Alice wins the final 2-1
        await updateScore(finalMatch.id, 2, 1);
    }
    
    await archiveTournament();
    await printLeaderboard();
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
