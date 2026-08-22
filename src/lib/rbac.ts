/**
 * Server-side role-based access control helpers.
 *
 * Every protected server function calls one of these before touching data.
 * Database policies remain the real boundary; these checks fail fast with a
 * clear message and keep employees out of admin-only endpoints even when they
 * call the endpoint directly.
 */

type RoleCheckClient = {
  rpc: (fn: "is_admin") => PromiseLike<{ data: boolean | null; error: unknown }>;
};

export class ForbiddenError extends Error {
  constructor(message = "You are not authorised to perform this operation.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function isAdmin(supabase: RoleCheckClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}

/** Throws unless the authenticated caller holds the ADMIN role. */
export async function assertAdmin(supabase: RoleCheckClient): Promise<void> {
  if (!(await isAdmin(supabase))) throw new ForbiddenError();
}
