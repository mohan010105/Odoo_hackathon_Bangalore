import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { LoadingState } from "@/components/common/states";
import { useAuth } from "@/hooks/useAuth";

/**
 * Role-aware alias route. Shared links such as /attendance and /time-off land
 * here and are forwarded to the portal page for the signed-in role. Real
 * authorization still happens in the destination guard and in the database.
 */
export function PortalRedirect({
  adminTo,
  employeeTo,
}: {
  adminTo: string;
  employeeTo: string;
}) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    void navigate({ to: user.role === "ADMIN" ? adminTo : employeeTo, replace: true });
  }, [isLoading, user, adminTo, employeeTo, navigate]);

  return <LoadingState label="Opening your workspace…" />;
}
