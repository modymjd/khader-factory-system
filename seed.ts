/**
 * Seed script: run with  `npx tsx seed.ts`
 * Creates default admin user + roles + permissions
 */
import { drizzle } from "drizzle-orm/mysql2";
import { createHash } from "crypto";
import { users, roles, permissions, rolePermissions } from "./drizzle/schema";
import * as dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required in .env");
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

async function seed() {
  console.log("🌱 Starting seed...");

  // 1. Create roles
  console.log("Creating roles...");
  await db
    .insert(roles)
    .values([
      { name: "مدير", description: "صلاحيات كاملة", isSystem: true },
      { name: "موظف", description: "صلاحيات محدودة", isSystem: true },
    ])
    .onDuplicateKeyUpdate({ set: { name: roles.name } });

  const allRoles = await db.select().from(roles);
  const adminRole = allRoles.find((r) => r.name === "مدير");
  const staffRole = allRoles.find((r) => r.name === "موظف");

  // 2. Create permissions
  console.log("Creating permissions...");
  const resources = ["users", "products", "orders", "attendance", "analytics", "roles", "audit_logs", "dashboard"];
  const actions = ["view", "create", "read", "update", "delete"];

  const permValues = resources.flatMap((resource) =>
    actions.map((action) => ({
      name: `${resource}:${action}`,
      resource,
      action,
      description: `${action} ${resource}`,
    }))
  );

  for (const perm of permValues) {
    await db
      .insert(permissions)
      .values(perm)
      .onDuplicateKeyUpdate({ set: { name: permissions.name } });
  }

  // 3. Create admin user
  console.log("Creating admin user...");
  await db
    .insert(users)
    .values({
      username: "admin",
      email: "admin@factory.local",
      passwordHash: hashPassword("Admin@123"),
      role: "admin",
      roleId: adminRole?.id,
      isActive: true,
      openId: "local-admin-001",
      name: "مدير النظام",
    })
    .onDuplicateKeyUpdate({ set: { username: users.username } });

  // 4. Assign all permissions to admin role
  if (adminRole) {
    const allPerms = await db.select().from(permissions);
    for (const perm of allPerms) {
      await db
        .insert(rolePermissions)
        .values({ roleId: adminRole.id, permissionId: perm.id })
        .onDuplicateKeyUpdate({ set: { roleId: rolePermissions.roleId } });
    }
  }

  console.log("");
  console.log("✅ Seed complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Username : admin");
  console.log("  Password : Admin@123");
  console.log("  URL      : http://localhost:3000");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
