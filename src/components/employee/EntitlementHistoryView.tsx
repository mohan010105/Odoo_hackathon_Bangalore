import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Calendar, CheckCircle2, History, Layers, Wallet } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/payroll/rules";
import {
  entitlementService,
  type EntitlementChange,
} from "@/services/entitlement/entitlementService";

interface EntitlementHistoryViewProps {
  filterType?: "LEAVE_ALLOCATION" | "SALARY_STRUCTURE";
  title?: string;
  description?: string;
  limit?: number;
}

function formatDate(isoDate?: string | null): string {
  if (!isoDate) return "—";
  return new Date(isoDate).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function renderValueDiff(item: EntitlementChange) {
  const prev = item.previous_value as Record<string, unknown> | null;
  const next = item.new_value as Record<string, unknown> | null;

  if (item.change_type === "LEAVE_ALLOCATION") {
    const nextDays = next?.allocated_days != null ? `${next.allocated_days} days` : "—";
    if (prev?.allocated_days != null) {
      const prevDays = `${prev.allocated_days} days`;
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground line-through">{prevDays}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="font-semibold text-foreground">{nextDays}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <CheckCircle2 className="size-3.5 text-primary" />
        <span>{nextDays} allocated</span>
      </div>
    );
  }

  if (item.change_type === "SALARY_STRUCTURE") {
    const nextSalary =
      next?.basic_salary != null ? formatMoney(Number(next.basic_salary), "INR") : "—";
    if (prev?.basic_salary != null) {
      const prevSalary = formatMoney(Number(prev.basic_salary), "INR");
      return (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground line-through">{prevSalary}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="font-semibold text-foreground">{nextSalary}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <CheckCircle2 className="size-3.5 text-primary" />
        <span>{nextSalary} basic salary assigned</span>
      </div>
    );
  }

  return <span className="text-sm text-muted-foreground">—</span>;
}

export function EntitlementHistoryView({
  filterType,
  title = "Entitlement history",
  description = "History of adjustments to your leave allocations and salary structures.",
  limit,
}: EntitlementHistoryViewProps) {
  const [selectedType, setSelectedType] = useState<"ALL" | "LEAVE_ALLOCATION" | "SALARY_STRUCTURE">(
    filterType ?? "ALL",
  );

  const { data: history = [], isLoading, isError } = useQuery({
    queryKey: ["my-entitlement-history"],
    queryFn: () => entitlementService.getMyHistory(),
  });

  const filtered = history.filter((item) => {
    if (filterType) return item.change_type === filterType;
    if (selectedType === "ALL") return true;
    return item.change_type === selectedType;
  });

  const displayed = limit ? filtered.slice(0, limit) : filtered;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <History className="size-4 text-primary" />
              <CardTitle className="font-display text-base">{title}</CardTitle>
            </div>
            <CardDescription>{description}</CardDescription>
          </div>

          {!filterType ? (
            <div className="flex flex-wrap gap-1">
              <Button
                variant={selectedType === "ALL" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelectedType("ALL")}
              >
                All
              </Button>
              <Button
                variant={selectedType === "LEAVE_ALLOCATION" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelectedType("LEAVE_ALLOCATION")}
              >
                Leave
              </Button>
              <Button
                variant={selectedType === "SALARY_STRUCTURE" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelectedType("SALARY_STRUCTURE")}
              >
                Salary
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading entitlement history…</p>
        ) : isError ? (
          <p className="py-4 text-center text-sm text-destructive">
            We could not load your entitlement history.
          </p>
        ) : displayed.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/40 py-6 text-center text-sm text-muted-foreground">
            No entitlement adjustments recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {displayed.map((item) => (
              <li key={item.id} className="py-3.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={item.change_type === "LEAVE_ALLOCATION" ? "secondary" : "default"}
                        className="text-[11px]"
                      >
                        {item.change_type === "LEAVE_ALLOCATION" ? (
                          <span className="flex items-center gap-1">
                            <Layers className="size-3" /> Leave allocation
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Wallet className="size-3" /> Salary structure
                          </span>
                        )}
                      </Badge>
                      <span className="text-sm font-semibold text-foreground">{item.label}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        Effective: {formatDate(item.effective_from)}
                        {item.effective_to ? ` → ${formatDate(item.effective_to)}` : ""}
                      </span>
                      <span>Recorded: {formatDate(item.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase">
                      Adjustment
                    </span>
                    {renderValueDiff(item)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
