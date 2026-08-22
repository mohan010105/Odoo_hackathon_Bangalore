import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Paperclip } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { businessDate } from "@/lib/attendance/rules";
import { ATTACHMENT_ACCEPT, formatDays, leaveDays, validateAttachment } from "@/lib/leave/rules";
import { leaveRequestSchema, type LeaveRequestInput } from "@/lib/validation/leave";
import { leaveService, type LeaveBalanceRow } from "@/services/leave/leaveService";

/**
 * Leave request form. Days are inclusive calendar days (weekends included), and
 * the same rule runs in the database so the preview here always matches the
 * stored total.
 */
export function LeaveRequestForm({
  balances,
  onSubmitted,
}: {
  balances: LeaveBalanceRow[] | undefined;
  onSubmitted: () => void;
}) {
  const { user } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const today = businessDate();

  const types = useQuery({ queryKey: ["leave-types"], queryFn: () => leaveService.listTypes() });

  const form = useForm<LeaveRequestInput>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: { leaveTypeId: "", startDate: today, endDate: today, remarks: "" },
  });

  const start = form.watch("startDate");
  const end = form.watch("endDate");
  const leaveTypeId = form.watch("leaveTypeId");
  const days = leaveDays(start, end);

  const selectedType = (types.data ?? []).find((type) => type.id === leaveTypeId);
  const balance = (balances ?? []).find((row) => row.leave_type_id === leaveTypeId);
  const remaining = balance ? Number(balance.remaining_days) : null;
  const overBalance = remaining !== null && days > remaining;

  const onSubmit = async (values: LeaveRequestInput) => {
    setFormError(null);
    setFileError(null);

    if (selectedType?.requires_attachment && !file) {
      setFileError("This leave type requires supporting documentation.");
      return;
    }

    try {
      let attachmentPath: string | undefined;
      if (file) {
        if (!user) throw new Error("Your session has expired. Please sign in again.");
        attachmentPath = await leaveService.uploadAttachment(file, user.id);
      }

      await leaveService.submit({
        ...values,
        remarks: values.remarks?.trim() ? values.remarks.trim() : undefined,
        ...(attachmentPath ? { attachmentPath } : {}),
      });

      toast.success("Leave request submitted", { description: "HR will review it shortly." });
      form.reset({ leaveTypeId: "", startDate: today, endDate: today, remarks: "" });
      setFile(null);
      onSubmitted();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "We could not submit your request.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base">Request time off</CardTitle>
        <CardDescription>
          Pick your dates and submit for HR approval. Every calendar day in the range counts,
          weekends included.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-4 sm:grid-cols-2"
          aria-label="Leave request"
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="leave-type">Leave type</Label>
            <Select
              value={leaveTypeId}
              onValueChange={(value) =>
                form.setValue("leaveTypeId", value, { shouldValidate: true })
              }
            >
              <SelectTrigger id="leave-type" aria-invalid={!!form.formState.errors.leaveTypeId}>
                <SelectValue placeholder={types.isLoading ? "Loading…" : "Choose a leave type"} />
              </SelectTrigger>
              <SelectContent>
                {(types.data ?? []).map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                    {type.is_paid ? "" : " · unpaid"}
                    {type.requires_attachment ? " · document required" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType?.description ? (
              <p className="text-xs text-muted-foreground">{selectedType.description}</p>
            ) : null}
            {form.formState.errors.leaveTypeId ? (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.leaveTypeId.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="leave-start">Start date</Label>
            <Input id="leave-start" type="date" {...form.register("startDate")} />
            {form.formState.errors.startDate ? (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.startDate.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="leave-end">End date</Label>
            <Input id="leave-end" type="date" min={start} {...form.register("endDate")} />
            {form.formState.errors.endDate ? (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.endDate.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="leave-remarks">Remarks (optional)</Label>
            <Textarea
              id="leave-remarks"
              rows={3}
              maxLength={500}
              placeholder="Add context for your manager"
              {...form.register("remarks")}
            />
            {form.formState.errors.remarks ? (
              <p role="alert" className="text-sm text-destructive">
                {form.formState.errors.remarks.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="leave-attachment">
              Supporting document{selectedType?.requires_attachment ? "" : " (optional)"}
            </Label>
            <Input
              id="leave-attachment"
              type="file"
              accept={ATTACHMENT_ACCEPT}
              aria-invalid={!!fileError}
              onChange={(event) => {
                const next = event.target.files?.[0] ?? null;
                if (!next) {
                  setFile(null);
                  setFileError(null);
                  return;
                }
                const problem = validateAttachment(next);
                setFileError(problem);
                setFile(problem ? null : next);
              }}
            />
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Paperclip aria-hidden="true" className="size-3" />
              PDF, JPG, PNG or Word, up to 10 MB. Stored privately and visible only to you and HR.
            </p>
            {fileError ? (
              <p role="alert" className="text-sm text-destructive">
                {fileError}
              </p>
            ) : null}
          </div>

          {formError ? (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Submitting…" : "Submit request"}
            </Button>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {days > 0 ? `${formatDays(days)} day${days === 1 ? "" : "s"}` : "No dates selected"}
              {remaining !== null ? ` · ${formatDays(remaining)} days available` : ""}
            </p>
          </div>

          {overBalance ? (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              This request is longer than your remaining balance, so it will be rejected on submit.
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
