import { cookies } from "next/headers";
import { verifyAdmin, isAdminEmail } from "./tokens";

export const ADMIN_COOKIE = "gp_admin";

// Returns the signed-in admin email, or null. Verifies the HMAC token in the
// cookie AND that the email is still on the allow-list.
export async function currentAdmin(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const email = verifyAdmin(token);
  if (!email || !isAdminEmail(email)) return null;
  return email;
}
