import { useMemo, useState } from "react";
import { toast } from "sonner";

import { SalaryBreakdownTable } from "@/components/payroll/SalaryBreakdownTable";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { calculationBasisLabel, computeSalary, formatMoney } from "@/lib/payroll/rules";
import { salaryStructureSchema } from "@/lib/validation/payroll";
import type {
  SalaryComponentRow,
  SalaryStructureRow,
} from "@/services/payroll/payrollService";
import { payrollService } from "@/services/payroll/payrollService";

type Draft = { value: string; enabled: boolean };

/**
 * Salary configuration for one employee. The live preview uses the shared
 * payroll rules; the saved figures are recalculated in the database.
 */
export function SalaryStructureDialog({
  employee,
  components,
  onClose,
  onSaved,
}: {
  employee: SalaryStructureRow;
  components: SalaryComponentRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const active = useMemo(() => components.filter((item) => item.is_active), [components]);

  const [basicSalary, setBasicSalary] = useState(
    employee.basic_salary ? String(employee.basic_salary) : "",
  );
  const [effectiveFrom, setEffectiveFrom] = useState(
    employee.effective_from ?? new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const assigned = new Map(employee.components.map((item) => [item.component_id, item]));
    return Object.fromEntries(
      active.map((component) => {
        const existing = assigned.get(component.id);
        return [
          component.id,
          {
            value: String(existing?.value ?? component.default_value),
            enabled: existing ? existing.is_active : false,
          },
        ];
      }),
    );
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const basic = Number(basicSalary) || 0;

  const preview = useMemo(
    () =>
      computeSalary(
        basic,
        active.map((component) => ({
          code: component.code,
          name: component.name,
          component_type: component.component_type,
          calculation_method: component.calculation_method,
          value: Number(drafts[component.id]?.value ?? 0) || 0,
          is_active: drafts[component.id]?.enabled ?? false,
        })),
      ),
    [active, basic, drafts],
  );

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((current) => ({
      ...current,
      [id]: { value: current[id]?.value ?? "0", enabled: current[id]?.enabled ?? false, ...patch },
    }));

  const save = async () => {
    setErrors({});
    const payload = {
      employeeId: employee.employee_id,
      basicSalary: Number(basicSalary),
      effectiveFrom,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      components: active
        .filter((component) => drafts[component.id]?.enabled)
        .map((component) => ({
          componentId: component.id,
          value: Number(drafts[component.id]?.value ?? 0) || 0,
          isActive: true,
        })),
    };

    const parsed = salaryStructureSchema.safeParse(payload);
    if (!parsed.success) {
      const flat: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        flat[String(issue.path[0] ?? "form")] = issue.message;
      }
      setErrors(flat);
      return;
    }

    if (preview.invalid) {
      setErrors({ form: "Deductions cannot exceed gross earnings." });
      return;
    }

    setIsSaving(true);
    try {
      await payrollService.saveStructure(parsed.data);
      toast.success("Salary structure saved", {
        description: `${employee.employee_name} · net ${formatMoney(preview.net_salary)}`,
      });
      onSaved();
      onClose();
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : "We could not save the salary structure.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Salary structure — {employee.employee_name}</DialogTitle>
          <DialogDescription>
            {employee.login_id}
            {employee.department ? ` · ${employee.department}` : ""}. Percentage components are
            calculated on the basic salary.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="basic-salary">Basic salary</Label>
              <Input
                id="basic-salary"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={basicSalary}
                onChange={(event) => setBasicSalary(event.target.value)}
                aria-invalid={Boolean(errors["basicSalary"])}
              />
              {errors["basicSalary"] ? (
                <p className="text-xs text-destructive">{errors["basicSalary"]}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="effective-from">Effective from</Label>
              <Input
                id="effective-from"
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
                aria-invalid={Boolean(errors["effectiveFrom"])}
              />
              {errors["effectiveFrom"] ? (
                <p className="text-xs text-destructive">{errors["effectiveFrom"]}</p>
              ) : null}
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="font-display text-sm font-semibold text-foreground">
              Components
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {active.map((component) => {
                const draft = drafts[component.id];
                return (
                  <div
                    key={component.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3"
                  >
                    <Checkbox
                      id={`component-${component.id}`}
                      checked={draft?.enabled ?? false}
                      onCheckedChange={(checked) =>
                        setDraft(component.id, { enabled: checked === true })
                      }
                    />
                    <div className="flex-1 space-y-2">
                      <Label
                        htmlFor={`component-${component.id}`}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <span>{component.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {component.component_type === "EARNING" ? "Earning" : "Deduction"} ·{" "}
                          {calculationBasisLabel(
                            component.calculation_method,
                            Number(draft?.value ?? component.default_value) || 0,
                          )}
                        </span>
                      </Label>
                      <Input
                        aria-label={`${component.name} value`}
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        disabled={!draft?.enabled}
                        value={draft?.value ?? ""}
                        onChange={(event) =>
                          setDraft(component.id, { value: event.target.value })
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-1">
            <Label htmlFor="structure-notes">Notes (optional)</Label>
            <Textarea
              id="structure-notes"
              value={notes}
              rows={2}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <section className="space-y-3 rounded-lg border border-border p-4">
            <h3 className="font-display text-sm font-semibold text-foreground">Preview</h3>
            <SalaryBreakdownTable
              basicSalary={preview.basic_salary}
              earnings={preview.earnings}
              deductions={preview.deductions}
              grossEarnings={preview.gross_earnings}
              totalDeductions={preview.total_deductions}
              netSalary={preview.net_salary}
              currency={employee.currency}
            />
          </section>

          {errors["form"] ? (
            <p role="alert" className="text-sm text-destructive">
              {errors["form"]}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save structure"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
