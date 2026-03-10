import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // ─── 1. Roles ──────────────────────────────────────────────────
  const roleDefinitions = [
    { code: "ADMIN", name: "Administrator", description: "Full system access" },
    { code: "MANAGER", name: "Manager", description: "Manage projects and monitor agents" },
    { code: "AGENT", name: "Agent", description: "Create links and manage own leads" },
    { code: "VIEWER", name: "Viewer", description: "Read-only access" },
  ];

  for (const roleDef of roleDefinitions) {
    await prisma.role.upsert({
      where: { code: roleDef.code },
      update: { name: roleDef.name, description: roleDef.description },
      create: roleDef,
    });
  }
  console.log("✅ Roles created");

  // ─── 2. Admin User ─────────────────────────────────────────────
  const adminEmail = "admin@ist-realestate.com";
  const passwordHash = await bcrypt.hash("AdminPassword123!", 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "System Administrator",
      email: adminEmail,
      passwordHash,
      status: "ACTIVE",
    },
  });

  const adminRole = await prisma.role.findUnique({ where: { code: "ADMIN" } });
  if (adminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id },
    });
  }
  console.log(`✅ Admin user created: ${adminEmail}`);

  // ─── 3. Global Valuation Rules ─────────────────────────────────
  // Use findFirst + create because Prisma v6 does not support null in
  // composite unique index keys with upsert.
  const existingRules = await prisma.setting.findFirst({
    where: { scope: "GLOBAL", projectId: null, key: "valuation_rules" },
  });
  if (!existingRules) {
    await prisma.setting.create({
      data: {
        scope: "GLOBAL",
        projectId: null,
        key: "valuation_rules",
        value: {
          areaTolerancePct: 15,
          outlierMethod: "trim10",
          minComps: 3,
          benchmark: "transactionMedianPsf",
          thresholds: {
            below_market: 0.95,
            aligned_max: 1.03,
            slightly_above_max: 1.1,
          },
        },
      },
    });
  }
  console.log("✅ Valuation rules setting created");

  // ─── 4. Global Branding ────────────────────────────────────────
  const existingBranding = await prisma.setting.findFirst({
    where: { scope: "GLOBAL", projectId: null, key: "branding" },
  });
  if (!existingBranding) {
    await prisma.setting.create({
      data: {
        scope: "GLOBAL",
        projectId: null,
        key: "branding",
        value: {
          companyName: "IST Real Estate",
          primaryColor: "#0B1F3B",
          accentColor: "#C9A96E",
          logoUrl: null,
          website: "https://ist-realestate.com",
          phone: "+971 4 XXX XXXX",
          email: "info@ist-realestate.com",
          disclaimer:
            "This valuation is an estimate based on available comparable data and is not an official appraisal. Results may vary based on market conditions.",
        },
      },
    });
  }
  console.log("✅ Branding setting created");

  console.log("\n🎉 Seed completed successfully!");
  console.log("─────────────────────────────────");
  console.log(`Admin email: ${adminEmail}`);
  console.log("Admin password: AdminPassword123!");
  console.log("⚠️  CHANGE THE PASSWORD IMMEDIATELY AFTER FIRST LOGIN");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
