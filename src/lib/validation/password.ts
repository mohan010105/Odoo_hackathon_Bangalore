/**
 * Single source of truth for password rules.
 *
 * The same list drives the Zod schemas, the inline error messages and the
 * strength indicator, so what the form validates is exactly what the UI
 * promises.
 */
export type PasswordRule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

export const PASSWORD_MIN_LENGTH = 10;

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH,
  },
  { id: "upper", label: "One uppercase letter", test: (value) => /[A-Z]/.test(value) },
  { id: "lower", label: "One lowercase letter", test: (value) => /[a-z]/.test(value) },
  { id: "number", label: "One number", test: (value) => /[0-9]/.test(value) },
  {
    id: "symbol",
    label: "One symbol (for example ! ? @ #)",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
  {
    id: "no-spaces",
    label: "No leading or trailing spaces",
    test: (value) => value.length > 0 && value.trim() === value,
  },
];

export type PasswordStrength = {
  /** How many rules currently pass. */
  passed: number;
  total: number;
  /** 0-100 for the progress indicator. */
  score: number;
  label: "Too weak" | "Weak" | "Good" | "Strong";
  satisfied: Record<string, boolean>;
  isValid: boolean;
};

export function evaluatePassword(value: string): PasswordStrength {
  const satisfied: Record<string, boolean> = {};
  let passed = 0;

  for (const rule of PASSWORD_RULES) {
    const ok = rule.test(value);
    satisfied[rule.id] = ok;
    if (ok) passed += 1;
  }

  const total = PASSWORD_RULES.length;
  const score = Math.round((passed / total) * 100);
  const label: PasswordStrength["label"] =
    passed === total ? "Strong" : passed >= total - 1 ? "Good" : passed >= 3 ? "Weak" : "Too weak";

  return { passed, total, score, label, satisfied, isValid: passed === total };
}

/** First unmet rule, used for a single concise inline error message. */
export function firstPasswordProblem(value: string): string | null {
  const failing = PASSWORD_RULES.find((rule) => !rule.test(value));
  return failing ? `Add: ${failing.label.toLowerCase()}` : null;
}
