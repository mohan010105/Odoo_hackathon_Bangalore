import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Paperclip } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { LeaveExportButton } from "@/components/leave/LeaveExportButton";
import { LeaveStatusBadge } from "@/components/leave/LeaveStatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { businessDate } from "@/lib/attendance/rules";
import { formatDays, formatLeaveDate, presetRange } from "@/lib/leave/rules";
import { leaveService, type AdminLeaveRequestRow } from "@/services/leave/leaveService";

const PAGE_SIZE = 25;
const ALL = "ALL";

type Decision = { row: AdminLeaveRequestRow; decision: "APPROVED" | "REJECTED" } | null;

/** Admin approval queue: filters, decisions with comments, and leave statistics. */
export function AdminLeavePage() {
  const queryClient = useQueryClient();
  const today = businessDate();

  const [status, setStatus] = useState<string>("PENDING");
  const [leaveTypeId, setLeaveTypeId] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);

  const [decision, setDecision] = useState<Decision>(null);
  const [comment, setComment] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const filters = useMemo(
    () => ({
      ...(status !== ALL ? { status: status as "PENDING" } : {}),
      ...(leaveTypeId !== ALL ? { leaveTypeId } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      page,
      pageSize: PAGE_SIZE,
    }),
    [status, leaveTypeId, search, from, to, page],
  );

  const stats = useQuery({ queryKey: ["leave-stats"], queryFn: () => leaveService.stats() });
  const types = useQuery({ queryKey: ["leave-types"], queryFn: () => leaveService.listTypes() });
  const requests = useQuery({
    queryKey: ["admin-leave-requests", filters],
    queryFn: () => leaveService.listForReview(filters),
  });

  const attachmentPaths = (requests.data?.rows ?? [])
    .map((row) => row.attachment_url)
    .filter(Boolean) as string[];

  const signed = useQuery({
    queryKey: ["leave-attachments", attachmentPaths.slice().sort()],
    queryFn: () => leaveService.signAttachments(attachmentPaths),
    enabled: attachmentPaths.length > 0,
  });

  const applyPreset = (preset: "TODAY" | "WEEK" | "MONTH") => {
    const range = presetRange(preset, today);
    setFrom(range.from);
    setTo(range.to);
    setPage(0);
  };

  const submitDecision = async () => {
    if (!decision) return;
    setDialogError(null);

    if (decision.decision === "REJECTED" && !comment.trim()) {
      setDialogError("Please provide a reason for rejection.");
      return;
    }

    setIsSaving(true);
    try {
      await leaveService.review({
        id: decision.row.id,
        decision: decision.decision,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      toast.success(decision.decision === "APPROVED" ? "Leave approved" : "Leave rejected", {
        description: "The employee has been notified.",
      });
      setDecision(null);
      setComment("");
      void queryClient.invalidateQueries({ queryKey: ["admin-leave-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["leave-stats"] });
      void queryClient.invalidateQueries({ queryKey: ["leave-allocations"] });
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "We could not save that decision.");
    } finally {
      setIsSaving(false);
    }
  };

  const total = requests.data?.total ?? 0;
  const lastPage = Math.max(Math.ceil(total / PAGE_SIZE) - 1, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Leave approvals"
        description="Review requests, approve or reject with a comment, and keep balances accurate."
        actions={
          <>
            <LeaveExportButton filters={filters} />
            <Button asChild variant="outline">
              <Link to="/admin/leave/balances">Allocations &amp; policies</Link>
            </Button>
          </>
        }

      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Leave statistics">
        {[
          { label: "Pending", value: stats.data?.pending },
          { label: "On leave today", value: stats.data?.onLeaveToday },
          { label: "Approved", value: stats.data?.approved },
          { label: "Rejected", value: stats.data?.rejected },
        ].map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-sm font-semibold text-muted-foreground">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl leading-none">{card.value ?? "—"}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="leave-search">Search</Label>
              <Input
                id="leave-search"
                placeholder="Name, login ID or department"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(0);
                }}
              >
                <SelectTrigger id="leave-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-type-filter">Leave type</Label>
              <Select
                value={leaveTypeId}
                onValueChange={(value) => {
                  setLeaveTypeId(value);
                  setPage(0);
                }}
              >
                <SelectTrigger id="leave-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All types</SelectItem>
                  {(types.data ?? []).map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-from">From</Label>
              <Input
                id="leave-from"
                type="date"
                value={from}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-to">To</Label>
              <Input
                id="leave-to"
                type="date"
                value={to}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(0);
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => applyPreset("TODAY")}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("WEEK")}>
              This week
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPreset("MONTH")}>
              This month
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatus("PENDING");
                setLeaveTypeId(ALL);
                setFrom("");
                setTo("");
                setPage(0);
              }}
            >
              Reset filters
            </Button>
          </div>

          {requests.isError ? (
            <p role="alert" className="text-sm text-destructive">
              We could not load the leave requests.
            </p>
          ) : requests.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading requests…</p>
          ) : (requests.data?.rows.length ?? 0) === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
              No leave requests match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead className="text-right">Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(requests.data?.rows ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <Link
                            to="/admin/employees/$employeeId/leave"
                            params={{ employeeId: row.employee_id }}
                            className="font-medium text-primary underline"
                          >
                            {row.employees?.first_name} {row.employees?.last_name}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {row.employees?.login_id}
                            {row.employees?.department ? ` · ${row.employees.department}` : ""}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{row.leave_types?.name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatLeaveDate(row.start_date)} – {formatLeaveDate(row.end_date)}
                      </TableCell>
                      <TableCell className="text-right">{formatDays(row.total_days)}</TableCell>
                      <TableCell>
                        <LeaveStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="max-w-48 text-sm text-muted-foreground">
                        {row.remarks ?? "—"}
                      </TableCell>
                      <TableCell>
                        {row.attachment_url && signed.data?.[row.attachment_url] ? (
                          <a
                            className="inline-flex items-center gap-1 text-sm text-primary underline"
                            href={signed.data[row.attachment_url]}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Paperclip aria-hidden="true" className="size-3" /> View
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.status === "PENDING" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setDecision({ row, decision: "APPROVED" });
                                setComment("");
                                setDialogError(null);
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setDecision({ row, decision: "REJECTED" });
                                setComment("");
                                setDialogError(null);
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Decided</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {total > PAGE_SIZE ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {lastPage + 1} · {total} requests
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((value) => Math.max(value - 1, 0))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= lastPage}
                  onClick={() => setPage((value) => Math.min(value + 1, lastPage))}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={!!decision} onOpenChange={(open) => (open ? null : setDecision(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {decision?.decision === "APPROVED" ? "Approve leave" : "Reject leave"}
            </DialogTitle>
            <DialogDescription>
              {decision
                ? `${decision.row.employees?.first_name ?? "Employee"} · ${formatLeaveDate(
                    decision.row.start_date,
                  )} – ${formatLeaveDate(decision.row.end_date)} · ${formatDays(
                    decision.row.total_days,
                  )} days`
                : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="decision-comment">
              Comment{decision?.decision === "REJECTED" ? "" : " (optional)"}
            </Label>
            <Textarea
              id="decision-comment"
              rows={3}
              maxLength={500}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={
                decision?.decision === "REJECTED"
                  ? "Explain why this request cannot be approved"
                  : "Add a note for the employee"
              }
            />
            {dialogError ? (
              <p role="alert" className="text-sm text-destructive">
                {dialogError}
              </p>
            ) : null}
            {decision?.decision === "APPROVED" ? (
              <p className="text-xs text-muted-foreground">
                Approving updates the leave balance and marks those days as leave in attendance.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={submitDecision} disabled={isSaving}>
              {isSaving ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
