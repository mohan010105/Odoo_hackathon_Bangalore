import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { leaveService, type AdminLeaveFilters } from "@/services/leave/leaveService";

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const HEADER = [
  "Login ID",
  "Employee",
  "Department",
  "Leave type",
  "Start date",
  "End date",
  "Days",
  "Status",
  "Reason",
  "HR comment",
  "Requested at",
  "Decided at",
  "Attachment",
];

/**
 * Exports the admin leave queue as CSV using the filters currently on screen
 * (status, date range, employee, leave type and search). Attachment links are
 * short-lived signed URLs, so the export never leaks a permanently public file.
 */
export function LeaveExportButton({ filters }: { filters: AdminLeaveFilters }) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Re-query with the same filters, unpaged, so the export matches the view.
      const { rows } = await leaveService.listForReview({
        ...filters,
        page: 0,
        pageSize: 1000,
      });

      if (rows.length === 0) {
        toast.info("There is nothing to export for these filters.");
        return;
      }

      const paths = rows.map((row) => row.attachment_url).filter(Boolean) as string[];
      const signed = paths.length > 0 ? await leaveService.signAttachments(paths) : {};

      const body = rows.map((row) =>
        [
          row.employees?.login_id ?? "",
          `${row.employees?.first_name ?? ""} ${row.employees?.last_name ?? ""}`.trim(),
          row.employees?.department ?? "",
          row.leave_types?.name ?? "",
          row.start_date,
          row.end_date,
          row.total_days,
          row.status,
          row.remarks ?? "",
          row.review_comment ?? "",
          row.created_at ? new Date(row.created_at).toLocaleString() : "",
          row.reviewed_at ? new Date(row.reviewed_at).toLocaleString() : "",
          row.attachment_url ? (signed[row.attachment_url] ?? "Attachment available") : "",
        ]
          .map(csvCell)
          .join(","),
      );

      const blob = new Blob([[HEADER.join(","), ...body].join("\n")], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dayflow-leave-requests-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Export ready", { description: `${rows.length} requests downloaded.` });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not export those requests.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button variant="outline" onClick={() => void handleExport()} disabled={isExporting}>
      <Download aria-hidden="true" className="mr-2 size-4" />
      {isExporting ? "Preparing…" : "Export CSV"}
    </Button>
  );
}
