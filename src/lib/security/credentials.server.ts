/**
 * Server-only credential generation.
 *
 * The temporary password is cryptographically random, never derived from the
 * employee's name or joining date, and is never persisted by Dayflow — only the
 * authentication provider stores its hash. It is returned exactly once, to the
 * administrator who created the employee.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const SYMBOLS = "!@#$%*?";

function randomFrom(source: string, count: number): string[] {
  const bytes = new Uint32Array(count);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => source[byte % source.length]!);
}

/** 14-character random password containing letters, digits and a symbol. */
export function generateTemporaryPassword(): string {
  const chars = [...randomFrom(ALPHABET, 12), ...randomFrom(SYMBOLS, 2)];

  // Fisher-Yates with cryptographic randomness.
  const order = new Uint32Array(chars.length);
  crypto.getRandomValues(order);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = order[i]! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }

  return chars.join("");
}
