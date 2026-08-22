import { useQuery } from "@tanstack/react-query";
import { Paperclip } from "lucide-react";

import { LeaveStatusBadge } from "@/components/leave/LeaveStatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDays, formatLeaveDate } from "@/lib/leave/rules";
import { leaveService, type LeaveRequestRow } from "@/services/leave/leaveService";

/**
 * Shared leave history table. Attachments are private, so links are resolved
 * through short-lived signed URLs rather than public storage paths.
 */
export function LeaveRequestsTable({
  requests,
  isLoading,
  onCancel,
  cancellingId,
  emptyMessage = "No leave requests yet.",
}: {
  requests: LeaveRequestRow[] | undefined;
  isLoading?: boolean;
  onCancel?: (id: string) => void;
  cancellingId?: string | null;
  emptyMessage?: string;
}) {
  const paths = (requests ?? []).map((row) => row.attachment_url).filter(Boolean) as string[];

  const signed = useQuery({
    queryKey: ["leave-attachments", paths.slice().sort()],
    queryFn: () => leaveService.signAttachments(paths),
    enabled: paths.length > 0,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading leave history…</p>;
  }

  if (!requests || requests.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead className="text-right">Days</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Remarks</TableHead>
            <TableHead>Document</TableHead>
            {onCancel ? <TableHead className="text-right">Action</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.leave_types?.name ?? "—"}</TableCell>
              <TableCell className="whitespace-nowrap">
                {formatLeaveDate(row.start_date)} – {formatLeaveDate(row.end_date)}
              </TableCell>
              <TableCell className="text-right">{formatDays(row.total_days)}</TableCell>
              <TableCell>
                <LeaveStatusBadge status={row.status} />
                {row.review_comment ? (
                  <p className="mt-1 max-w-48 text-xs text-muted-foreground">
                    {row.review_comment}
                  </p>
                ) : null}
              </TableCell>
              <TableCell className="max-w-56 text-sm text-muted-foreground">
                {row.remarks ?? "—"}
              </TableCell>
              <TableCell>
                {row.attachment_url ? (
                  signed.data?.[row.attachment_url] ? (
                    <a
                      className="inline-flex items-center gap-1 text-sm text-primary underline"
                      href={signed.data[row.attachment_url]}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Paperclip aria-hidden="true" className="size-3" /> View
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">Preparing…</span>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              {onCancel ? (
                <TableCell className="text-right">
                  {row.status === "PENDING" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={cancellingId === row.id}
                      onClick={() => onCancel(row.id)}
                    >
                      {cancellingId === row.id ? "Cancelling…" : "Cancel"}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
