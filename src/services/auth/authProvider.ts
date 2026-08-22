import type { Session } from "@/types";
import type { ChangePasswordInput, SignInInput } from "@/lib/validation/auth";

/**
 * Authentication boundary. The UI only ever talks to `authService`, so the
 * provider below can later be re-pointed at the Odoo-backed integration layer
 * without touching a single component.
 */
export interface AuthProvider {
  readonly id: string;
  /** True once a real authentication backend is wired up. */
  readonly isBackendConnected: boolean;
  getSession(): Promise<Session | null>;
  signIn(input: SignInInput): Promise<Session>;
  signOut(): Promise<void>;
  changePassword(input: ChangePasswordInput): Promise<void>;
  onSessionChange(listener: () => void): () => void;
}
