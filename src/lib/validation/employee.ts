import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined));

export const createEmployeeSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "First name is required")
    .max(60, "Keep this under 60 characters"),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(60, "Keep this under 60 characters"),
  email: z.string().trim().toLowerCase().email("Enter a valid work email"),
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[0-9 ()-]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined)),
  joiningDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Select a joining date")
    .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), {
      message: "Select a valid joining date",
    }),
  department: optionalText(80),
  jobPosition: optionalText(80),
  manager: optionalText(120),
  location: optionalText(120),
  companyId: z.string().uuid().optional(),
  profilePicturePath: optionalText(300),
  /** Where the verification email should send the new employee back to. */
  verificationRedirectTo: z.string().url().optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const companySchema = z.object({
  name: z.string().trim().min(2, "Enter the company name").max(120, "Name is too long"),
  logoPath: optionalText(300),
});

export type CompanyInput = z.infer<typeof companySchema>;
