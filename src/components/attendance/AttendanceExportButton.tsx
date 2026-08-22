import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ATTENDANCE_STATUS_LABELS, type AttendanceRecordRow } from "@/lib/attendance/rules";

export type ExportRow = AttendanceRecordRow & {
  employees?: {
    login_id: string;
    first_name: string;
    last_name: string;
    department: string | null;
  } | null;
};

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Downloads the currently visible attendance rows as CSV. The export mirrors
 * what is on screen — no extra data is fetched, so row-level access rules still
 * decide what can leave the app.
 */
export function AttendanceExportButton({
  rows,
  filename,
  includeEmployee = false,
}: {
  rows: ExportRow[] | undefined;
  filename: string;
  includeEmployee?: boolean;
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    if (!rows || rows.length === 0) {
      toast.info("There is nothing to export yet.");
      return;
    }

    setIsExporting(true);
    try {
      const header = [
        ...(includeEmployee ? ["Login ID", "Employee", "Department"] : []),
        "Date",
        "Check in",
        "Check out",
        "Work hours",
        "Extra hours",
        "Status",
        "Notes",
      ];

      const body = rows.map((row) =>
        [
          ...(includeEmployee
            ? [
                row.employees?.login_id ?? "",
                `${row.employees?.first_name ?? ""} ${row.employees?.last_name ?? ""}`.trim(),
                row.employees?.department ?? "",
              ]
            : []),
          row.attendance_date,
          row.check_in ? new Date(row.check_in).toLocaleString() : "",
          row.check_out ? new Date(row.check_out).toLocaleString() : "",
          row.work_hours,
          row.extra_hours,
          ATTENDANCE_STATUS_LABELS[row.status] ?? row.status,
          row.notes ?? "",
        ]
          .map(csvCell)
          .join(","),
      );

      const blob = new Blob([[header.join(","), ...body].join("\n")], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Export ready", { description: `${rows.length} records downloaded.` });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={isExporting}>
      <Download aria-hidden="true" className="mr-2 size-4" />
      {isExporting ? "Preparing…" : "Export CSV"}
    </Button>
  );
}
