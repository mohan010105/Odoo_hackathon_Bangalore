/**
 * Login ID format helpers.
 *
 * Format: <2 letters of first name><2 letters of last name><joining year><4-digit
 * joining serial> — e.g. MORA20260001.
 *
 * IMPORTANT: these helpers only *preview* the format for the UI. The
 * authoritative ID (including the joining serial and the uniqueness guarantee)
 * is generated inside the database by `generate_employee_login_id`, so
 * concurrent employee creation can never produce duplicates.
 */

function namePart(value: string): string {
  const letters = value.replace(/[^A-Za-z]/g, "").toUpperCase();
  return letters.slice(0, 2).padEnd(2, "X");
}

export function loginIdPrefix(firstName: string, lastName: string): string {
  return `${namePart(firstName)}${namePart(lastName)}`;
}

export function joiningYear(joiningDate: string): string {
  const year = joiningDate.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : String(new Date().getUTCFullYear());
}

/** Human preview only — the serial is decided by the database. */
export function previewLoginId(firstName: string, lastName: string, joiningDate: string): string {
  return `${loginIdPrefix(firstName, lastName)}${joiningYear(joiningDate)}####`;
}
