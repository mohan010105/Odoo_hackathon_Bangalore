import { z } from "zod";

import { PASSWORD_RULES } from "@/lib/validation/password";

export const signInSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, "Enter your Login ID or work email")
    .max(160, "That identifier is too long"),
  password: z.string().min(1, "Enter your password"),
});

/**
 * Shared strong-password schema. The rule list lives in
 * `@/lib/validation/password` so the form checklist, the strength bar and this
 * validation can never drift apart.
 */
const strongPassword = PASSWORD_RULES.reduce(
  (schema, rule) => schema.refine(rule.test, { message: `Add: ${rule.label.toLowerCase()}` }),
  z.string().min(1, "Enter a password") as z.ZodType<string>,
);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: strongPassword,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((values) => values.newPassword !== values.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password you have not used before",
  });

export const bootstrapAdminSchema = z
  .object({
    email: z.string().trim().email("Enter a valid work email"),
    fullName: z.string().trim().min(2, "Enter the administrator's name"),
    companyName: z.string().trim().min(2, "Enter your company name"),
    password: strongPassword,
    confirmPassword: z.string().min(1, "Confirm the password"),
    /**
     * Where the verification email should send the administrator back to.
     * Filled in by the client at submit time, so it is optional in the form.
     */
    redirectTo: z.string().url().optional(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter the work email on your account"),
});

export const resetPasswordSchema = z
  .object({
    newPassword: strongPassword,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type BootstrapAdminInput = z.infer<typeof bootstrapAdminSchema>;
