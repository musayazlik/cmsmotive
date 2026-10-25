import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { seedStores } from "./seeds";

/** better-auth stores e-mail/password logins in Account with this provider id. */
const CREDENTIAL_PROVIDER = "credential";

const DEV_PASSWORD = "ChangeMe!2026";

type SeedUser = {
  label: string;
  name: string;
  email: string;
  role: "superadmin" | "admin" | "user";
  passwordEnv: string;
};

function readPassword(envKey: string): string {
  const fromEnv = process.env[envKey]?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `${envKey} must be set when NODE_ENV=production. Refusing to create an account with a known password.`,
    );
  }
  return DEV_PASSWORD;
}

const seedUsers: SeedUser[] = [
  {
    label: "superadmin",
    name: process.env.SEED_SUPERADMIN_NAME?.trim() || "CMSMotive Superadmin",
    email: (process.env.SEED_SUPERADMIN_EMAIL?.trim() || "superadmin@cmsmotive.de").toLowerCase(),
    role: "superadmin",
    passwordEnv: "SEED_SUPERADMIN_PASSWORD",
  },
  {
    label: "admin",
    name: process.env.SEED_ADMIN_NAME?.trim() || "CMSMotive Admin",
    email: (process.env.SEED_ADMIN_EMAIL?.trim() || "admin@cmsmotive.de").toLowerCase(),
    role: "admin",
    passwordEnv: "SEED_ADMIN_PASSWORD",
  },
  {
    label: "user",
    name: process.env.SEED_USER_NAME?.trim() || "CMSMotive User",
    email: (process.env.SEED_USER_EMAIL?.trim() || "user@cmsmotive.de").toLowerCase(),
    role: "user",
    passwordEnv: "SEED_USER_PASSWORD",
  },
];

/**
 * Creates or refreshes a user together with its credential account.
 * Re-running the seed is safe: users are matched on e-mail and the existing
 * password row is updated instead of duplicated.
 */
async function upsertCredentialUser({ name, email, role, password }: SeedUser & { password: string }) {
  // The password must be hashed with better-auth's own algorithm, otherwise
  // sign-in cannot verify it.
  const hashed = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    // emailVerified is true so the accounts can sign in immediately even though
    // lib/auth.ts sets requireEmailVerification.
    create: { id: randomUUID(), name, email, emailVerified: true, role },
    update: { name, role, emailVerified: true },
    select: { id: true, email: true, name: true, role: true },
  });
  const stores = await prisma.store.findMany({ where: role === "user" ? { isDefault: true } : {} });
  for (const store of stores) {
    await prisma.storeMember.upsert({
      where: { storeId_userId: { storeId: store.id, userId: user.id } },
      create: { storeId: store.id, userId: user.id, role: role === "user" ? "user" : "admin" },
      update: { role: role === "user" ? "user" : "admin" },
    });
  }

  const existingAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: CREDENTIAL_PROVIDER },
    select: { id: true },
  });

  if (existingAccount) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: { accountId: user.id, password: hashed },
    });
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: user.id,
        providerId: CREDENTIAL_PROVIDER,
        userId: user.id,
        password: hashed,
      },
    });
  }

  return user;
}

async function main() {
  console.log("Seeding CMSMotive stores, settings and catalogue...");
  await seedStores();

  console.log("Seeding CMSMotive accounts...");

  const seeded: { seedUser: SeedUser; user: { email: string; role: string } }[] = [];
  for (const seedUser of seedUsers) {
    const user = await upsertCredentialUser({ ...seedUser, password: readPassword(seedUser.passwordEnv) });
    seeded.push({ seedUser, user });
    console.log(`  ${seedUser.label.padEnd(10)} ${user.email}  role=${user.role}`);
  }

  const usedDefaults = seeded.filter(({ seedUser }) => !process.env[seedUser.passwordEnv]?.trim());
  if (usedDefaults.length > 0) {
    console.warn("");
    console.warn("WARNING: the following accounts were created with the development password:");
    for (const { user } of usedDefaults) {
      console.warn(`  ${user.email}  ->  ${DEV_PASSWORD}`);
    }
    console.warn(`Set ${seedUsers.map((seedUser) => seedUser.passwordEnv).join(", ")} before deploying.`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .then(() => {
    console.log("Seed complete.");
  })
  .catch(async (error) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
