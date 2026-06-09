// scripts/cleanup.ts
import { prisma } from '../lib/prisma';

async function main() {
  const result = await prisma.chat.deleteMany({
    where: { userId: null },
  });
  console.log('Deleted:', result.count);
}

main().finally(() => prisma.$disconnect());