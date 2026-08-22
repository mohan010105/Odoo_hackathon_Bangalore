import { supabase } from "@/integrations/supabase/client";
import { markPasswordChanged, signInWithIdentifier } from "@/lib/auth.functions";
import type { ChangePasswordInput, SignInInput } from "@/lib/validation/auth";
import type { Role, Session, User } from "@/types";
import type { AuthProvider } from "./authProvider";

/**
 * Real authentication against Lovable Cloud auth.
 *
 * The role is always read from the database (`user_roles`) — never from form
 * fields, URLs or local storage.
 */
async function loadAccount(userId: string, email: string): Promise<User> {
  const [rolesResult, profileResult, employeeResult] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase
      .from("profiles")
      .select("full_name, must_change_password")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("employees").select("login_id").eq("user_id", userId).maybeSingle(),
  ]);

  const role: Role = (rolesResult.data ?? []).some((row) => row.role === "ADMIN")
    ? "ADMIN"
    : "EMPLOYEE";

  return {
    id: userId,
    employeeId: employeeResult.data?.login_id ?? "",
    email,
    fullName: profileResult.data?.full_name ?? null,
    role,
    emailVerified: true,
    mustChangePassword: profileResult.data?.must_change_password ?? false,
  };
}

async function currentSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  return { user: await loadAccount(data.user.id, data.user.email) };
}

export const supabaseAuthProvider: AuthProvider = {
  id: "lovable-cloud-auth",
  isBackendConnected: true,

  getSession: currentSession,

  async signIn(input: SignInInput) {
    const tokens = await signInWithIdentifier({ data: input });
    const { data, error } = await supabase.auth.setSession({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });

    if (error || !data.user?.email) {
      throw new Error("We could not start your session. Please try again.");
    }

    return { user: await loadAccount(data.user.id, data.user.email) };
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  async changePassword({ currentPassword, newPassword }: ChangePasswordInput) {
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (!email) throw new Error("Your session has expired. Please sign in again.");

    // Verify the current password before allowing a change.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (verifyError) throw new Error("Your current password is incorrect.");

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw new Error(updateError.message || "We could not update your password.");

    await markPasswordChanged({});
  },

  onSessionChange(listener: () => void) {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        listener();
      }
    });
    return () => data.subscription.unsubscribe();
  },
};
