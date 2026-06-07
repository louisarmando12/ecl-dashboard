import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function patch() {
  const matches = await prisma.match.findMany({ include: { playerA: true, playerB: true } });
  
  for (const match of matches) {
    if (match.playerAId && !match.playerACountry && match.playerA?.country) {
      await prisma.match.update({
        where: { id: match.id },
        data: { playerACountry: match.playerA.country }
      });
      console.log(`Patched player A for match ${match.id}`);
    }
    if (match.playerBId && !match.playerBCountry && match.playerB?.country) {
      await prisma.match.update({
        where: { id: match.id },
        data: { playerBCountry: match.playerB.country }
      });
      console.log(`Patched player B for match ${match.id}`);
    }
  }
  console.log("Done");
}

patch();
