import { Client } from "@replit/object-storage";

// Replit Object Storage. Uses the Repl's default bucket (configured when you add
// Object Storage to the Repl). Objects are private; we serve them through the
// /api/img/[...key] route, so stored image URLs are same-origin paths.
let _client: Client | null = null;
function client(): Client {
  if (!_client) _client = new Client();
  return _client;
}

export async function putObject(key: string, bytes: Buffer): Promise<void> {
  const res = await client().uploadFromBytes(key, bytes);
  if (!res.ok) throw new Error(`object upload failed: ${String(res.error)}`);
}

export async function getObject(key: string): Promise<Buffer | null> {
  const res = await client().downloadAsBytes(key);
  if (!res.ok) return null;
  return res.value[0] ?? null;
}

// Public path the browser uses to fetch a stored object (served by /api/img).
export function objectUrl(key: string): string {
  return `/api/img/${key}`;
}
