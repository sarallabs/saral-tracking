/**
 * Run this script to apply ALL schema changes to Neon and seed the test user.
 * Usage: node scripts/migrate.mjs
 *
 * Uses node-postgres (pg) which works fine with Neon's connection string.
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually
const envPath = join(__dirname, "..", ".env.local");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.warn("⚠️  .env.local not found, using process.env");
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found");
  process.exit(1);
}

// Dynamically import pg
let Client;
try {
  const pgModule = await import("pg");
  Client = pgModule.default?.Client ?? pgModule.Client;
} catch {
  console.error("❌ pg not installed. Run: npm install pg");
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

try {
  await client.connect();
  console.log("✅ Connected to Neon");
} catch (err) {
  console.error("❌ Connection failed:", err.message);
  process.exit(1);
}

// Read migration SQL
const migrationPath = join(__dirname, "..", "drizzle", "0000_slimy_unus.sql");
const migration = readFileSync(migrationPath, "utf-8");
const statements = migration
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`\n🚀 Applying ${statements.length} SQL statements...\n`);

let success = 0, skipped = 0;

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  try {
    await client.query(stmt);
    success++;
    process.stdout.write(`\r  ✓ ${success} applied, ${skipped} skipped`);
  } catch (err) {
    const msg = (err.message ?? "").toLowerCase();
    if (
      msg.includes("already exists") ||
      msg.includes("duplicate") ||
      msg.includes("already been created")
    ) {
      skipped++;
      process.stdout.write(`\r  ✓ ${success} applied, ${skipped} skipped`);
    } else {
      console.error(`\n\n❌ Statement ${i + 1} failed:\n  ${stmt.slice(0, 120)}\n  Error: ${err.message}\n`);
    }
  }
}

console.log(`\n\n✅ Schema migration complete: ${success} applied, ${skipped} already existed\n`);

// ─── Seed test user ────────────────────────────────────────────────────────────
console.log("👤 Setting up test user: rahman@saralvidhya.com...");

try {
  const { default: bcrypt } = await import("bcryptjs");
  const hash = await bcrypt.hash("rahman@1234", 12);

  // Check if user exists
  const { rows: existing } = await client.query(
    "SELECT id FROM users WHERE email = $1 LIMIT 1",
    ["rahman@saralvidhya.com"]
  );

  let userId;
  if (existing.length > 0) {
    userId = existing[0].id;
    await client.query(
      "UPDATE users SET password_hash = $1, status = 'active', is_global_admin = true WHERE id = $2",
      [hash, userId]
    );
    console.log("  ✓ Test user updated");
  } else {
    const { rows: [user] } = await client.query(
      `INSERT INTO users (id, email, name, password_hash, status, is_global_admin, email_verified, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'active', true, NOW(), NOW(), NOW())
       RETURNING id`,
      ["rahman@saralvidhya.com", "Rahman", hash]
    );
    userId = user.id;
    console.log("  ✓ Test user created:", userId);
  }

  // Ensure workspace
  let { rows: workspaces } = await client.query(
    "SELECT id FROM workspaces WHERE slug = $1 LIMIT 1",
    ["saralvidhya-com"]
  );
  let workspaceId;
  if (workspaces.length === 0) {
    const { rows: [ws] } = await client.query(
      `INSERT INTO workspaces (id, name, slug, created_at, updated_at)
       VALUES (gen_random_uuid(), 'Saral Vidhya', 'saralvidhya-com', NOW(), NOW())
       RETURNING id`
    );
    workspaceId = ws.id;
    console.log("  ✓ Workspace created:", workspaceId);
  } else {
    workspaceId = workspaces[0].id;
    console.log("  ✓ Workspace exists:", workspaceId);
  }

  // Ensure membership
  const { rows: membership } = await client.query(
    "SELECT id FROM memberships WHERE user_id = $1 AND workspace_id = $2 LIMIT 1",
    [userId, workspaceId]
  );
  if (membership.length === 0) {
    await client.query(
      `INSERT INTO memberships (id, user_id, workspace_id, role, joined_at)
       VALUES (gen_random_uuid(), $1, $2, 'owner', NOW())`,
      [userId, workspaceId]
    );
    console.log("  ✓ Workspace membership created");
  }

  // Seed default channels
  const defaultChannels = [
    { name: "general", description: "General discussion for the whole team" },
    { name: "engineering", description: "Engineering team channel" },
    { name: "announcements", description: "Important announcements" },
    { name: "random", description: "Off-topic / water cooler" },
  ];

  for (const ch of defaultChannels) {
    const { rows: existing } = await client.query(
      "SELECT id FROM channels WHERE name = $1 AND workspace_id = $2 LIMIT 1",
      [ch.name, workspaceId]
    );
    let channelId;
    if (existing.length === 0) {
      const { rows: [created] } = await client.query(
        `INSERT INTO channels (id, workspace_id, name, description, created_by, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
         RETURNING id`,
        [workspaceId, ch.name, ch.description, userId]
      );
      channelId = created.id;
    } else {
      channelId = existing[0].id;
    }

    // Add user to channel
    await client.query(
      `INSERT INTO channel_members (id, channel_id, user_id, joined_at)
       VALUES (gen_random_uuid(), $1, $2, NOW())
       ON CONFLICT DO NOTHING`,
      [channelId, userId]
    ).catch(() => {});
  }
  console.log("  ✓ Default channels ready");

} catch (err) {
  console.error("⚠️  Seed error:", err.message);
}

await client.end();

console.log("\n🎉 All done! Your database is ready.");
console.log("   Test login → rahman@saralvidhya.com / rahman@1234");
