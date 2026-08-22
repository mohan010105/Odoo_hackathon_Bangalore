import { z } from "zod";

import { MAX_LEAVE_SPAN_DAYS, leaveDays } from "@/lib/leave/rules";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date");

export const leaveRequestSchema = z
  .object({
    leaveTypeId: z.string().uuid("Choose a leave type"),
    startDate: isoDate,
    endDate: isoDate,
    remarks: z.string().trim().max(500, "Keep the remarks under 500 characters").optional(),
    attachmentPath: z.string().trim().max(400).optional(),
  })
  .refine((values) => values.endDate >= values.startDate, {
    path: ["endDate"],
    message: "The end date cannot be before the start date",
  })
  .refine((values) => leaveDays(values.startDate, values.endDate) <= MAX_LEAVE_SPAN_DAYS, {
    path: ["endDate"],
    message: `A single request cannot cover more than ${MAX_LEAVE_SPAN_DAYS} days`,
  });

export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;

export const leaveDecisionSchema = z
  .object({
    id: z.string().uuid(),
    decision: z.enum(["APPROVED", "REJECTED"]),
    comment: z.string().trim().max(500, "Keep the comment under 500 characters").optional(),
  })
  .refine((values) => values.decision !== "REJECTED" || !!values.comment, {
    path: ["comment"],
    message: "Please provide a reason for rejection.",
  });

export type LeaveDecisionInput = z.infer<typeof leaveDecisionSchema>;

export const leaveAllocationSchema = z
  .object({
    allocationId: z.string().uuid().optional(),
    employeeId: z.string().uuid("Choose an employee"),
    leaveTypeId: z.string().uuid("Choose a leave type"),
    allocatedDays: z
      .number({ message: "Enter the number of days" })
      .min(0, "Allocated days cannot be negative")
      .max(400, "That is more days than a year"),
    validFrom: isoDate,
    validTo: isoDate,
  })
  .refine((values) => values.validTo >= values.validFrom, {
    path: ["validTo"],
    message: "Valid to must be on or after valid from",
  });

export type LeaveAllocationInput = z.infer<typeof leaveAllocationSchema>;

export const leaveTypeSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters")
    .max(20, "Keep the code short")
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dashes or underscores"),
  name: z.string().trim().min(2, "Enter a name").max(80, "Keep the name under 80 characters"),
  description: z.string().trim().max(300, "Keep the description under 300 characters").optional(),
  requiresAttachment: z.boolean(),
  isPaid: z.boolean(),
  isActive: z.boolean(),
});

export type LeaveTypeInput = z.infer<typeof leaveTypeSchema>;
