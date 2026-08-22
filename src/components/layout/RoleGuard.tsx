import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { LoadingState, UnauthorizedState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { homeRouteForRole } from "@/lib/permissions";
import type { Role } from "@/types";

/**
 * Route protection: unauthenticated users are sent to sign-in, employees who
 * still hold a generated password are sent to the password-change screen, and
 * the wrong role gets an explicit unauthorized state.
 *
 * Server-side enforcement (auth middleware + database policies) is the real
 * boundary; this only decides what the UI renders.
 */
export function RoleGuard({
  allow,
  allowWhilePasswordChangePending = false,
  children,
}: {
  allow: Role;
  allowWhilePasswordChangePending?: boolean;
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  const needsPasswordChange = !!user && user.mustChangePassword;

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    if (needsPasswordChange && !allowWhilePasswordChangePending && user.role === "EMPLOYEE") {
      navigate({ to: "/change-password", replace: true });
      return;
    }
    // Signed in with the other role: send them to their own portal instead of
    // leaving them on a dead end.
    if (user.role !== allow) {
      navigate({ to: homeRouteForRole(user.role), replace: true });
    }
  }, [isLoading, user, needsPasswordChange, allow, allowWhilePasswordChangePending, navigate]);

  if (isLoading) return <LoadingState label="Checking your access…" />;
  if (!user) return <LoadingState label="Redirecting to sign in…" />;

  if (user.role !== allow) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <UnauthorizedState
          description={`This area is limited to ${allow === "ADMIN" ? "HR administrators" : "employees"}. Your account is signed in as ${user.role.toLowerCase()}.`}
          action={
            <Button asChild variant="outline" size="sm">
              <Link to={homeRouteForRole(user.role)}>Go to my workspace</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (needsPasswordChange && !allowWhilePasswordChangePending && user.role === "EMPLOYEE") {
    return <LoadingState label="Redirecting to password change…" />;
  }

  return <>{children}</>;
}
