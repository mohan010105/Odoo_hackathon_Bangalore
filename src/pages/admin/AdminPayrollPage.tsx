import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ScrollText, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { PayrollExportMenu } from "@/components/payroll/PayrollExportMenu";
import { PageHeader } from "@/components/common/PageHeader";
import { PayrollStatusBadge } from "@/components/payroll/PayrollStatusBadge";
import { PayslipDialog } from "@/components/payroll/PayslipDialog";
import { PeriodSelector } from "@/components/payroll/PeriodSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  currentPeriod,
  formatMoney,
  isFinalised,
  periodLabel,
  periodRangeLabel,
  type PayrollPeriod,
} from "@/lib/payroll/rules";
import {
  payrollService,
  type PayrollRecordRow,
  type PayrollPreviewRow,
} from "@/services/payroll/payrollService";

const PAGE_SIZE = 20;
const ALL = "ALL";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-display text-2xl font-semibold text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

/** Admin payroll workspace: period stats, generation run and payroll register. */
export function AdminPayrollPage() {
  const queryClient = useQueryClient();

  const [period, setPeriod] = useState<PayrollPeriod>(currentPeriod());
  const [status, setStatus] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [runOpen, setRunOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [payslip, setPayslip] = useState<PayrollRecordRow | null>(null);

  const summary = useQuery({
    queryKey: ["payroll-summary", period],
    queryFn: () => payrollService.summary(period),
  });

  const filters = useMemo(
    () => ({
      year: period.year,
      month: period.month,
      ...(status !== ALL ? { status: status as "GENERATED" } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      page,
      pageSize: PAGE_SIZE,
    }),
    [period, status, search, page],
  );

  const records = useQuery({
    queryKey: ["payroll-records", filters],
    queryFn: () => payrollService.listRecords(filters),
  });

  const preview = useQuery({
    queryKey: ["payroll-preview", period],
    queryFn: () => payrollService.preview({ ...period, includeInactive: false }),
    enabled: runOpen,
  });

  const eligible = useMemo(
    () => (preview.data ?? []).filter((row) => !row.exception_reason),
    [preview.data],
  );
  const exceptions = useMemo(
    () => (preview.data ?? []).filter((row) => Boolean(row.exception_reason)),
    [preview.data],
  );

  useEffect(() => {
    if (!runOpen) return;
    setSelected(Object.fromEntries(eligible.map((row) => [row.employee_id, true])));
  }, [runOpen, eligible]);

  const selectedIds = eligible
    .filter((row) => selected[row.employee_id])
    .map((row) => row.employee_id);

  const selectedNet = eligible
    .filter((row) => selected[row.employee_id])
    .reduce((sum, row) => sum + Number(row.net_salary ?? 0), 0);

  const generate = useMutation({
    mutationFn: () =>
      payrollService.generate({
        ...period,
        employeeIds: selectedIds,
        includeInactive: false,
      }),
    onSuccess: (result) => {
      toast.success(`Payroll generated for ${result.period ?? periodLabel(period)}`, {
        description: `${result.generated ?? 0} created · ${result.regenerated ?? 0} regenerated · ${(result.exceptions ?? []).length} exception(s)`,
      });
      setRunOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["payroll-records"] });
      void queryClient.invalidateQueries({ queryKey: ["payroll-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["payroll-preview"] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not generate payroll."),
  });

  const changeStatus = useMutation({
    mutationFn: (input: { id: string; status: "PROCESSED" | "PAID" }) =>
      payrollService.setStatus(input.id, input.status),
    onSuccess: (_row, input) => {
      toast.success(`Payslip marked ${input.status.toLowerCase()}`);
      void queryClient.invalidateQueries({ queryKey: ["payroll-records"] });
      void queryClient.invalidateQueries({ queryKey: ["payroll-summary"] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "We could not update the payslip."),
  });

  const rows = records.data?.rows ?? [];
  const total = records.data?.total ?? 0;
  const stats = summary.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description={`Salary processing for ${periodRangeLabel(period)}.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/admin/payroll/structures">
                <Settings2 className="mr-2 size-4" aria-hidden="true" />
                Salary structures
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/payroll/audit">
                <ScrollText className="mr-2 size-4" aria-hidden="true" />
                Payroll activity
              </Link>
            </Button>
            <PayrollExportMenu period={period} summary={summary.data} />
            <Button onClick={() => setRunOpen(true)}>Generate payroll</Button>
          </>
        }
      />

      <PeriodSelector
        period={period}
        onChange={(next) => {
          setPeriod(next);
          setPage(0);
        }}
      />

      {summary.isPending ? (
        <LoadingState label="Loading payroll summary…" />
      ) : summary.isError ? (
        <ErrorState
          title="Payroll summary unavailable"
          description={
            summary.error instanceof Error ? summary.error.message : "Please try again."
          }
          onRetry={() => void summary.refetch()}
        />
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Employees in payroll"
            value={String(stats.eligibleEmployees)}
            hint={`${stats.totalEmployees} active employees`}
          />
          <StatCard
            label="Payslips generated"
            value={String(stats.generated)}
            hint={`${stats.pending} still pending`}
          />
          <StatCard
            label="Total net pay"
            value={formatMoney(stats.totalNet)}
            hint={`Gross ${formatMoney(stats.totalGross)} · deductions ${formatMoney(stats.totalDeductions)}`}
          />
          <StatCard
            label="Exceptions"
            value={String(stats.exceptions)}
            hint="Employees missing a salary structure"
          />
        </div>
      ) : null}

      <Card>
        <CardHeader className="gap-4">
          <CardTitle>Payroll register — {periodLabel(period)}</CardTitle>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="payroll-search">Search</Label>
              <Input
                id="payroll-search"
                placeholder="Name, login ID or department"
                className="w-[240px]"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="payroll-status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(0);
                }}
              >
                <SelectTrigger id="payroll-status" className="w-[170px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  <SelectItem value="GENERATED">Generated</SelectItem>
                  <SelectItem value="PROCESSED">Processed</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {records.isPending ? (
            <LoadingState label="Loading payroll records…" />
          ) : records.isError ? (
            <ErrorState
              title="Payroll register unavailable"
              description={
                records.error instanceof Error ? records.error.message : "Please try again."
              }
              onRetry={() => void records.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No payslips for this period"
              description="Generate payroll to create payslips for employees with a salary structure."
            />
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net pay</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {row.employees
                              ? `${row.employees.first_name} ${row.employees.last_name}`
                              : "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.employees?.login_id ?? "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.employees?.department ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(Number(row.gross_earnings), row.currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(Number(row.total_deductions), row.currency)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(Number(row.net_salary), row.currency)}
                        </TableCell>
                        <TableCell>
                          <PayrollStatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setPayslip(row)}>
                              Payslip
                            </Button>
                            {row.status === "GENERATED" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={changeStatus.isPending}
                                onClick={() =>
                                  changeStatus.mutate({ id: row.id, status: "PROCESSED" })
                                }
                              >
                                Mark processed
                              </Button>
                            ) : null}
                            {row.status === "PROCESSED" ? (
                              <Button
                                size="sm"
                                disabled={changeStatus.isPending}
                                onClick={() => changeStatus.mutate({ id: row.id, status: "PAID" })}
                              >
                                Mark paid
                              </Button>
                            ) : null}
                            {isFinalised(row.status) && row.status === "PAID" ? (
                              <Badge variant="outline" className="bg-muted text-muted-foreground">
                                Locked
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Showing {rows.length} of {total} payslips
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((current) => Math.max(current - 1, 0))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(page + 1) * PAGE_SIZE >= total}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={runOpen} onOpenChange={setRunOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate payroll — {periodLabel(period)}</DialogTitle>
            <DialogDescription>
              Review the calculated amounts before confirming. All figures are calculated on the
              server from each employee's salary structure and attendance.
            </DialogDescription>
          </DialogHeader>

          {preview.isPending ? (
            <LoadingState label="Calculating payroll…" />
          ) : preview.isError ? (
            <ErrorState
              title="Preview unavailable"
              description={
                preview.error instanceof Error ? preview.error.message : "Please try again."
              }
              onRetry={() => void preview.refetch()}
            />
          ) : (
            <div className="space-y-4">
              {exceptions.length > 0 ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertTriangle className="size-4" aria-hidden="true" />
                    {exceptions.length} employee(s) will be skipped
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {exceptions.map((row) => (
                      <li key={row.employee_id}>
                        {row.employee_name} — {row.exception_reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {eligible.length === 0 ? (
                <EmptyState
                  title="Nobody is ready for payroll"
                  description="Assign salary structures before running payroll for this period."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <span className="sr-only">Include</span>
                        </TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Deductions</TableHead>
                        <TableHead className="text-right">Net pay</TableHead>
                        <TableHead>Existing</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eligible.map((row: PayrollPreviewRow) => (
                        <TableRow key={row.employee_id}>
                          <TableCell>
                            <Checkbox
                              aria-label={`Include ${row.employee_name}`}
                              checked={selected[row.employee_id] ?? false}
                              disabled={isFinalised(row.existing_status ?? "")}
                              onCheckedChange={(checked) =>
                                setSelected((current) => ({
                                  ...current,
                                  [row.employee_id]: checked === true,
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">{row.employee_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.login_id}
                              {row.department ? ` · ${row.department}` : ""}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(Number(row.gross_earnings))}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(Number(row.total_deductions))}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatMoney(Number(row.net_salary))}
                          </TableCell>
                          <TableCell>
                            {row.existing_status ? (
                              <PayrollStatusBadge status={row.existing_status} />
                            ) : (
                              <span className="text-xs text-muted-foreground">New</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="items-center justify-between gap-3 sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedIds.length} selected · net {formatMoney(selectedNet)}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRunOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => generate.mutate()}
                disabled={selectedIds.length === 0 || generate.isPending}
              >
                {generate.isPending ? "Generating…" : "Confirm and generate"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PayslipDialog record={payslip} onClose={() => setPayslip(null)} />
    </div>
  );
}
