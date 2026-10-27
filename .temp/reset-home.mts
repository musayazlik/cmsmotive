import "dotenv/config";
import { prisma } from "@/lib/prisma";

/** Removes the half-seeded typo3 home page so the store seed can rebuild it. */
const home = await prisma.page.findFirst({ where: { kind: "home", store: { key: "typo3" } }, select: { id: true } });
if (home) {
  await prisma.page.delete({ where: { id: home.id } });
  console.log("deleted", home.id);
} else {
  console.log("none");
}
await prisma.$disconnect();
