// Run the SQL migrations against the Replit PostgreSQL database.
// Usage (in the Replit shell): npm run migrate
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { db } from "../lib/db";

async function main() {
  const sql = db();
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const text = readFileSync(join(dir, file), "utf8");
    process.stdout.write(`Applying ${file} … `);
    try {
      await sql.unsafe(text);
      console.log("ok");
    } catch (e) {
      console.log("FAILED");
      console.error(e);
      process.exit(1);
    }
  }
  console.log("All migrations applied.");
  await sql.end();
}

main();
