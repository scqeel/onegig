import { User } from "@supabase/supabase-js";

export interface ProfileLike {
  email?: string | null;
  phone?: string | null;
}

/**
 * Returns true if a logged in user hasn't completed their account details
 * (e.g. missing valid email or password set).
 */
export function isAccountIncomplete(user: User | null, profile: ProfileLike | null): boolean {
  if (!user) return false;

  const email = profile?.email?.trim() || user.email?.trim() || "";
  if (!email || email.includes("@placeholder.local") || email.endsWith(".local")) {
    return true;
  }

  return false;
}
