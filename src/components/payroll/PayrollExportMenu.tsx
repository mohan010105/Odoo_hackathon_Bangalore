import { Download, FileArchive, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIdempotentExport } from "@/lib/exports/idempotency";
import {
  downloadBlob,
  payslipFileName,
  payslipHtml,
  periodSlug,
  registerCsv,
  summaryCsv,
  toCsv,
} from "@/lib/payroll/export";
import { periodLabel, type PayrollPeriod } from "@/lib/payroll/rules";
import { payrollService, type PayrollSummary } from "@/services/payroll/payrollService";

type Task = "SUMMARY" | "REGISTER" | "PAYSLIPS";

/**
 * Admin exports for the selected payroll period: the dashboard summary and the
 * full register as CSV, plus every generated payslip as one ZIP archive.
 * Records are re-read from the server so an export never depends on the page
 * the admin happens to be looking at, and each download is written to the
 * activity log.
 */
export function PayrollExportMenu({
  period,
  summary,
  companyName,
}: {
  period: PayrollPeriod;
  summary: PayrollSummary | undefined;
  companyName?: string;
}) {
  const { run, running, busy } = useIdempotentExport<Task>();

  const logExport = async (kind: Task, recordCount: number, idempotencyKey: string) => {
    try {
      await payrollService.logExport({ ...period, kind, recordCount, idempotencyKey });
    } catch {
      // The file is already downloaded; a logging failure must not block the admin.
    }
  };

  const exportSummary = () =>
    run("SUMMARY", async (idempotencyKey) => {
    if (!summary) {
      toast.info("The payroll summary is still loading.");
      return;
    }
    try {
      downloadBlob(
        new Blob([summaryCsv(summary, period)], { type: "text/csv;charset=utf-8" }),
        `dayflow-payroll-summary-${periodSlug(period)}.csv`,
      );
      await logExport("SUMMARY", summary.generated, idempotencyKey);
      toast.success(`Summary exported for ${periodLabel(period)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not export the summary.");
    }
  });

  const exportRegister = () =>
    run("REGISTER", async (idempotencyKey) => {
    try {
      const records = await payrollService.recordsForExport(period);
      if (records.length === 0) {
        toast.info(`There are no payslips for ${periodLabel(period)} yet.`);
        return;
      }
      downloadBlob(
        new Blob([registerCsv(records, period)], { type: "text/csv;charset=utf-8" }),
        `dayflow-payroll-register-${periodSlug(period)}.csv`,
      );
      await logExport("REGISTER", records.length, idempotencyKey);
      toast.success("Payroll register exported", {
        description: `${records.length} payslip row(s) downloaded.`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not export the register.");
    }
  });

  const downloadPayslips = () =>
    run("PAYSLIPS", async (idempotencyKey) => {
    try {
      const records = await payrollService.recordsForExport(period);
      if (records.length === 0) {
        toast.info(`There are no payslips for ${periodLabel(period)} yet.`);
        return;
      }

      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const folder = zip.folder(`payslips-${periodSlug(period)}`) ?? zip;

      for (const record of records) {
        folder.file(payslipFileName(record, period), payslipHtml(record, period, companyName));
      }

      folder.file(
        "index.csv",
        toCsv(
          ["Login ID", "Employee", "Net salary", "Status", "File"],
          records.map((record) => [
            record.employees?.login_id ?? "",
            record.employees
              ? `${record.employees.first_name} ${record.employees.last_name}`
              : "Employee",
            Number(record.net_salary),
            record.status,
            payslipFileName(record, period),
          ]),
        ),
      );

      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `dayflow-payslips-${periodSlug(period)}.zip`);
      await logExport("PAYSLIPS", records.length, idempotencyKey);
      toast.success("Payslips downloaded", {
        description: `${records.length} payslip(s) archived for ${periodLabel(period)}.`,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "We could not build the payslip archive.",
      );
    }
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={busy}>
          <Download className="mr-2 size-4" aria-hidden="true" />
          {running === null ? "Export" : "Preparing…"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{periodLabel(period)}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void exportSummary()}>
          <FileSpreadsheet className="mr-2 size-4" aria-hidden="true" />
          Summary CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void exportRegister()}>
          <FileSpreadsheet className="mr-2 size-4" aria-hidden="true" />
          Payroll register CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void downloadPayslips()}>
          <FileArchive className="mr-2 size-4" aria-hidden="true" />
          All payslips (ZIP)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
