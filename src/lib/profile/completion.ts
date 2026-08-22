/**
 * Profile completion rules.
 *
 * Employees cannot edit HR-managed fields, so completion only counts fields the
 * signed-in user is actually able to fill in themselves.
 */
export type ProfileCompletionSource = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  avatarUrl?: string | null;
};

export type ProfileFieldStatus = {
  id: "fullName" | "email" | "phone" | "location" | "avatar";
  label: string;
  complete: boolean;
  /** Required fields block completion; optional ones only add polish. */
  required: boolean;
  hint: string;
};

export type ProfileCompletion = {
  fields: ProfileFieldStatus[];
  missingRequired: ProfileFieldStatus[];
  completed: number;
  total: number;
  percent: number;
  isComplete: boolean;
};

function filled(value: string | null | undefined, min = 1): boolean {
  return !!value && value.trim().length >= min;
}

export function evaluateProfileCompletion(source: ProfileCompletionSource): ProfileCompletion {
  const fields: ProfileFieldStatus[] = [
    {
      id: "fullName",
      label: "Full name",
      complete: filled(source.fullName, 2),
      required: true,
      hint: "Ask HR to set your name if the field is locked.",
    },
    {
      id: "email",
      label: "Work email",
      complete: filled(source.email, 5),
      required: true,
      hint: "Managed by HR.",
    },
    {
      id: "phone",
      label: "Phone number",
      complete: filled(source.phone, 6),
      required: true,
      hint: "Add a number your team can reach you on.",
    },
    {
      id: "location",
      label: "Location",
      complete: filled(source.location, 2),
      required: true,
      hint: "City and country help with scheduling.",
    },
    {
      id: "avatar",
      label: "Profile picture",
      complete: filled(source.avatarUrl, 4),
      required: false,
      hint: "Optional, but it helps colleagues recognise you.",
    },
  ];

  const completed = fields.filter((field) => field.complete).length;
  const missingRequired = fields.filter((field) => field.required && !field.complete);

  return {
    fields,
    missingRequired,
    completed,
    total: fields.length,
    percent: Math.round((completed / fields.length) * 100),
    isComplete: missingRequired.length === 0,
  };
}
