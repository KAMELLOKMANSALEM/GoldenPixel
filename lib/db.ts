import postgres from "postgres";

// Replit PostgreSQL connection. Replit injects DATABASE_URL when you add a
// PostgreSQL database to the Repl (Tools → Database / "Add a database").
// SERVER ONLY.
let _sql: ReturnType<typeof postgres> | null = null;

export function db() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL not set — add a PostgreSQL database in Replit (Tools → Database).");
  }
  _sql = postgres(url, {
    ssl: "require",
    max: 5,
    idle_timeout: 20,
  });
  return _sql;
}

// Normalize rows: postgres returns timestamptz as JS Date; our row types use ISO
// strings. Convert Date -> ISO so the shapes match what the rest of the app expects.
export function norm<T>(rows: readonly Record<string, unknown>[]): T[] {
  return rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const k in r) o[k] = r[k] instanceof Date ? (r[k] as Date).toISOString() : r[k];
    return o;
  }) as T[];
}
