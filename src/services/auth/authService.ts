import type { AuthProvider } from "./authProvider";
import { supabaseAuthProvider } from "./supabaseAuthProvider";

/**
 * The single auth entry point used by the app. Swap the provider here when the
 * Odoo-backed integration layer lands — no component imports a provider directly.
 */
const provider: AuthProvider = supabaseAuthProvider;

export const authService = {
  providerId: provider.id,
  isBackendConnected: provider.isBackendConnected,
  getSession: () => provider.getSession(),
  signIn: provider.signIn.bind(provider),
  signOut: () => provider.signOut(),
  changePassword: provider.changePassword.bind(provider),
  onSessionChange: provider.onSessionChange.bind(provider),
};
