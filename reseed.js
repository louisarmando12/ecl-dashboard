const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reseed() {
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
    const nextRoundSlots = [];
    const matchesInRound = currentRoundSlots.length / 2;
    
    for (let i = 0; i < matchesInRound; i++) {
      const pA = currentRoundSlots[i * 2];
      const pB = currentRoundSlots[i * 2 + 1];
      const bracketNum = i + 1;

      const actualPA = pA === "TBD" || pA === "BYE" ? null : pA;
      const actualPB = pB === "TBD" || pB === "BYE" ? null : pB;

      let winnerId = null;
      let status = "UPCOMING";
      let scoreA = null;
      let scoreB = null;

      if (pA === "BYE" && pB === "BYE") {
        nextRoundSlots.push("BYE");
        continue;
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
          playerBId: actualPB,
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
  
  console.log("Bracket re-generated successfully with new BYE logic!");
}

reseed()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
