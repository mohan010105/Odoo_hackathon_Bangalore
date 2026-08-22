import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { SalaryStructureDialog } from "@/components/payroll/SalaryStructureDialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  CALCULATION_METHODS,
  calculationBasisLabel,
  COMPONENT_TYPES,
  computeSalary,
  formatMoney,
} from "@/lib/payroll/rules";
import { salaryComponentSchema } from "@/lib/validation/payroll";
import {
  payrollService,
  type SalaryComponentRow,
  type SalaryStructureRow,
} from "@/services/payroll/payrollService";

const PAGE_SIZE = 25;

type ComponentDraft = {
  id?: string;
  code: string;
  name: string;
  componentType: "EARNING" | "DEDUCTION";
  calculationMethod: "FIXED" | "PERCENTAGE";
  value: string;
  description: string;
  isActive: boolean;
};

const EMPTY_DRAFT: ComponentDraft = {
  code: "",
  name: "",
  componentType: "EARNING",
  calculationMethod: "FIXED",
  value: "0",
  description: "",
  isActive: true,
};

/** Admin salary configuration: per-employee structures and the component catalogue. */
export function AdminSalaryStructuresPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<SalaryStructureRow | null>(null);
  const [draft, setDraft] = useState<ComponentDraft | null>(null);
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const filters = useMemo(
    () => ({
      ...(search.trim() ? { search: search.trim() } : {}),
      onlyMissing,
      page,
      pageSize: PAGE_SIZE,
    }),
    [search, onlyMissing, page],
  );

  const components = useQuery({
    queryKey: ["salary-components"],
    queryFn: () => payrollService.listComponents(true),
  });

  const structures = useQuery({
    queryKey: ["salary-structures", filters],
    queryFn: () => payrollService.listStructures(filters),
  });

  const rows = structures.data?.rows ?? [];
  const total = structures.data?.total ?? 0;

  const saveComponent = async () => {
    if (!draft) return;
    setDraftErrors({});
    const parsed = salaryComponentSchema.safeParse({
      ...(draft.id ? { id: draft.id } : {}),
      code: draft.code,
      name: draft.name,
      componentType: draft.componentType,
      calculationMethod: draft.calculationMethod,
      value: Number(draft.value) || 0,
      ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
      isActive: draft.isActive,
    });

    if (!parsed.success) {
      const flat: Record<string, string> = {};
      for (const issue of parsed.error.issues) flat[String(issue.path[0] ?? "form")] = issue.message;
      setDraftErrors(flat);
      return;
    }

    setIsSaving(true);
    try {
      await payrollService.saveComponent(parsed.data);
      toast.success(draft.id ? "Component updated" : "Component created");
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: ["salary-components"] });
      void queryClient.invalidateQueries({ queryKey: ["salary-structures"] });
    } catch (error) {
      setDraftErrors({
        form: error instanceof Error ? error.message : "We could not save the component.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary structures"
        description="Configure basic salary, earnings and deductions for each employee."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/admin/payroll">
                <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
                Back to payroll
              </Link>
            </Button>
            <Button onClick={() => setDraft({ ...EMPTY_DRAFT })}>New component</Button>
          </>
        }
      />

      <Card>
        <CardHeader className="gap-4">
          <CardTitle>Employees</CardTitle>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label htmlFor="structure-search">Search</Label>
              <Input
                id="structure-search"
                className="w-[260px]"
                placeholder="Name, login ID or department"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-muted-foreground">
              <Checkbox
                checked={onlyMissing}
                onCheckedChange={(checked) => {
                  setOnlyMissing(checked === true);
                  setPage(0);
                }}
              />
              Only employees without a structure
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {structures.isPending || components.isPending ? (
            <LoadingState label="Loading salary structures…" />
          ) : structures.isError ? (
            <ErrorState
              title="Salary structures unavailable"
              description={
                structures.error instanceof Error ? structures.error.message : "Please try again."
              }
              onRetry={() => void structures.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No employees found"
              description="Adjust the search or add employees to the directory first."
            />
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-right">Basic</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Effective from</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const breakdown = computeSalary(
                        Number(row.basic_salary),
                        row.components.map((item) => ({
                          code: item.code,
                          name: item.name,
                          component_type: item.component_type,
                          calculation_method: item.calculation_method,
                          value: Number(item.value),
                          is_active: item.is_active,
                        })),
                      );
                      return (
                        <TableRow key={row.employee_id}>
                          <TableCell>
                            <div className="font-medium text-foreground">{row.employee_name}</div>
                            <div className="text-xs text-muted-foreground">{row.login_id}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.department ?? "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.structure_id
                              ? formatMoney(Number(row.basic_salary), row.currency)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.structure_id
                              ? formatMoney(breakdown.gross_earnings, row.currency)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {row.structure_id
                              ? formatMoney(breakdown.net_salary, row.currency)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.structure_id ? (
                              (row.effective_from ?? "—")
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-destructive/10 text-destructive"
                              >
                                Not configured
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                              {row.structure_id ? "Edit" : "Assign"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Showing {rows.length} of {total} employees
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

      <Card>
        <CardHeader>
          <CardTitle>Component catalogue</CardTitle>
        </CardHeader>
        <CardContent>
          {components.isError ? (
            <ErrorState
              title="Components unavailable"
              description={
                components.error instanceof Error ? components.error.message : "Please try again."
              }
              onRetry={() => void components.refetch()}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(components.data ?? []).map((component: SalaryComponentRow) => (
                    <TableRow key={component.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{component.name}</div>
                        <div className="text-xs text-muted-foreground">{component.code}</div>
                      </TableCell>
                      <TableCell>
                        {component.component_type === "EARNING" ? "Earning" : "Deduction"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {component.calculation_method === "PERCENTAGE"
                          ? calculationBasisLabel("PERCENTAGE", Number(component.default_value))
                          : formatMoney(Number(component.default_value))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            component.is_active
                              ? "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {component.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setDraft({
                              id: component.id,
                              code: component.code,
                              name: component.name,
                              componentType: component.component_type,
                              calculationMethod: component.calculation_method,
                              value: String(component.default_value),
                              description: component.description ?? "",
                              isActive: component.is_active,
                            })
                          }
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editing ? (
        <SalaryStructureDialog
          employee={editing}
          components={components.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ["salary-structures"] });
            void queryClient.invalidateQueries({ queryKey: ["payroll-summary"] });
            void queryClient.invalidateQueries({ queryKey: ["payroll-preview"] });
          }}
        />
      ) : null}

      {draft ? (
        <Dialog open onOpenChange={(open) => (!open ? setDraft(null) : undefined)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{draft.id ? "Edit component" : "New salary component"}</DialogTitle>
              <DialogDescription>
                Percentage components are always calculated on the basic salary.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="component-code">Code</Label>
                  <Input
                    id="component-code"
                    value={draft.code}
                    onChange={(event) => setDraft({ ...draft, code: event.target.value })}
                    aria-invalid={Boolean(draftErrors["code"])}
                  />
                  {draftErrors["code"] ? (
                    <p className="text-xs text-destructive">{draftErrors["code"]}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="component-name">Name</Label>
                  <Input
                    id="component-name"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    aria-invalid={Boolean(draftErrors["name"])}
                  />
                  {draftErrors["name"] ? (
                    <p className="text-xs text-destructive">{draftErrors["name"]}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="component-type">Type</Label>
                  <Select
                    value={draft.componentType}
                    onValueChange={(value) =>
                      setDraft({ ...draft, componentType: value as "EARNING" })
                    }
                  >
                    <SelectTrigger id="component-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPONENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type === "EARNING" ? "Earning" : "Deduction"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="component-method">Calculation</Label>
                  <Select
                    value={draft.calculationMethod}
                    onValueChange={(value) =>
                      setDraft({ ...draft, calculationMethod: value as "FIXED" })
                    }
                  >
                    <SelectTrigger id="component-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CALCULATION_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method === "FIXED" ? "Fixed amount" : "Percentage of basic"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="component-value">
                    {draft.calculationMethod === "PERCENTAGE" ? "Percentage" : "Default amount"}
                  </Label>
                  <Input
                    id="component-value"
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.value}
                    onChange={(event) => setDraft({ ...draft, value: event.target.value })}
                    aria-invalid={Boolean(draftErrors["value"])}
                  />
                  {draftErrors["value"] ? (
                    <p className="text-xs text-destructive">{draftErrors["value"]}</p>
                  ) : null}
                </div>
                <label className="flex items-center gap-2 pt-6 text-sm">
                  <Checkbox
                    checked={draft.isActive}
                    onCheckedChange={(checked) =>
                      setDraft({ ...draft, isActive: checked === true })
                    }
                  />
                  Active
                </label>
              </div>

              <div className="space-y-1">
                <Label htmlFor="component-description">Description (optional)</Label>
                <Textarea
                  id="component-description"
                  rows={2}
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </div>

              {draftErrors["form"] ? (
                <p role="alert" className="text-sm text-destructive">
                  {draftErrors["form"]}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDraft(null)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={saveComponent} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save component"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
