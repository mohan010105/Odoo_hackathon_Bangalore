import { z } from "zod";

import { CALCULATION_METHODS, COMPONENT_TYPES } from "@/lib/payroll/rules";

export const payrollPeriodSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export const salaryComponentSchema = z
  .object({
    id: z.string().uuid().optional(),
    code: z
      .string()
      .trim()
      .min(2, "Code must be at least 2 characters.")
      .max(40, "Code is too long.")
      .regex(/^[A-Za-z0-9_ ]+$/, "Use letters, numbers, spaces or underscores."),
    name: z.string().trim().min(2, "Enter a component name.").max(80, "Name is too long."),
    componentType: z.enum(COMPONENT_TYPES),
    calculationMethod: z.enum(CALCULATION_METHODS),
    value: z.number().min(0, "Value cannot be negative.").max(10_000_000),
    description: z.string().trim().max(240).optional(),
    isActive: z.boolean(),
  })
  .refine(
    (input) => input.calculationMethod !== "PERCENTAGE" || input.value <= 100,
    { message: "A percentage cannot exceed 100.", path: ["value"] },
  );

export const salaryStructureComponentSchema = z.object({
  componentId: z.string().uuid(),
  value: z.number().min(0, "Value cannot be negative.").max(10_000_000),
  isActive: z.boolean().default(true),
});

export const salaryStructureSchema = z.object({
  employeeId: z.string().uuid(),
  basicSalary: z
    .number({ message: "Enter the basic salary." })
    .positive("Basic salary must be greater than zero.")
    .max(100_000_000),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an effective date."),
  notes: z.string().trim().max(300).optional(),
  components: z.array(salaryStructureComponentSchema).max(40),
});

export const payrollGenerateSchema = payrollPeriodSchema.extend({
  employeeIds: z.array(z.string().uuid()).min(1, "Select at least one employee.").max(500),
  includeInactive: z.boolean().default(false),
});

export const payrollStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["PROCESSED", "PAID"]),
});

export type SalaryComponentInput = z.infer<typeof salaryComponentSchema>;
export type SalaryStructureInput = z.infer<typeof salaryStructureSchema>;
export type PayrollGenerateInput = z.infer<typeof payrollGenerateSchema>;
export type PayrollStatusInput = z.infer<typeof payrollStatusSchema>;
export type PayrollPeriodInput = z.infer<typeof payrollPeriodSchema>;
