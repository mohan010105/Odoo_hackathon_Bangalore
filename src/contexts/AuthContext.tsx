import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { authService } from "@/services/auth/authService";
import type { ChangePasswordInput, SignInInput } from "@/lib/validation/auth";
import { hasPermission, hasRole, type Permission } from "@/lib/permissions";
import type { Role, Session, User } from "@/types";

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  isBackendConnected: boolean;
  signIn: (input: SignInInput) => Promise<User>;
  signOut: () => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  can: (permission: Permission) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const restored = await authService.getSession();
      setSession(restored);
    } catch (cause) {
      setError(toMessage(cause));
    }
  }, []);

  useEffect(() => {
    let active = true;

    void authService
      .getSession()
      .then((restored) => {
        if (active) setSession(restored);
      })
      .catch((cause: unknown) => {
        if (active) setError(toMessage(cause));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const unsubscribe = authService.onSessionChange(() => {
      void refresh();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [refresh]);

  const signIn = useCallback(async (input: SignInInput) => {
    setError(null);
    try {
      const next = await authService.signIn(input);
      setSession(next);
      return next.user;
    } catch (cause) {
      setError(toMessage(cause));
      throw cause;
    }
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setSession(null);
  }, []);

  const changePassword = useCallback(
    async (input: ChangePasswordInput) => {
      setError(null);
      try {
        await authService.changePassword(input);
        await refresh();
      } catch (cause) {
        setError(toMessage(cause));
        throw cause;
      }
    },
    [refresh],
  );

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    return {
      user,
      session,
      isLoading,
      error,
      isBackendConnected: authService.isBackendConnected,
      signIn,
      signOut,
      changePassword,
      refresh,
      hasRole: (...roles: Role[]) => hasRole(user, ...roles),
      can: (permission: Permission) => hasPermission(user, permission),
    };
  }, [session, isLoading, error, signIn, signOut, changePassword, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
