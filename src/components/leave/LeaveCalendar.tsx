import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeaveRequestRow } from "@/services/leave/leaveService";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type DayCell = {
  iso: string;
  day: number;
  isToday: boolean;
  spans: Array<{ id: string; label: string; status: "APPROVED" | "PENDING" }>;
};

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Monday-first offset for the first day of the month. */
function leadingBlanks(year: number, month: number) {
  const weekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return (weekday + 6) % 7;
}

/**
 * Month view of the employee's own leave. Every day inside an approved or
 * pending request is marked, so overlapping and multi-day spans are obvious.
 * Only the employee's real requests are rendered — nothing is inferred.
 */
export function LeaveCalendar({
  requests,
  isLoading = false,
}: {
  requests: LeaveRequestRow[] | undefined;
  isLoading?: boolean;
}) {
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const todayIso = isoDate(now.getFullYear(), now.getMonth(), now.getDate());

  const cells = useMemo<DayCell[]>(() => {
    const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
    const relevant = (requests ?? []).filter(
      (row) => row.status === "APPROVED" || row.status === "PENDING",
    );

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const iso = isoDate(cursor.year, cursor.month, day);
      return {
        iso,
        day,
        isToday: iso === todayIso,
        spans: relevant
          .filter((row) => row.start_date <= iso && row.end_date >= iso)
          .map((row) => ({
            id: row.id,
            label: row.leave_types?.name ?? "Leave",
            status: row.status as "APPROVED" | "PENDING",
          })),
      };
    });
  }, [requests, cursor, todayIso]);

  const monthLabel = new Date(Date.UTC(cursor.year, cursor.month, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const shift = (delta: number) => {
    setCursor((current) => {
      const next = new Date(Date.UTC(current.year, current.month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  };

  const approvedDays = cells.filter((cell) =>
    cell.spans.some((span) => span.status === "APPROVED"),
  ).length;
  const pendingDays = cells.filter(
    (cell) =>
      cell.spans.length > 0 && cell.spans.every((span) => span.status === "PENDING"),
  ).length;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="font-display text-base">Leave calendar</CardTitle>
          <CardDescription>
            {approvedDays} approved and {pendingDays} pending day(s) in {monthLabel}.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">{monthLabel}</span>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3 rounded-sm bg-primary" /> Approved
          </span>
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 rounded-sm border border-primary/50 bg-primary/15"
            />{" "}
            Pending
          </span>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading calendar…</p>
        ) : (
          <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Leave in ${monthLabel}`}>
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="px-1 pb-1 text-center text-xs font-medium text-muted-foreground"
              >
                {weekday}
              </div>
            ))}

            {Array.from({ length: leadingBlanks(cursor.year, cursor.month) }, (_, index) => (
              <div key={`blank-${index}`} aria-hidden="true" />
            ))}

            {cells.map((cell) => {
              const approved = cell.spans.some((span) => span.status === "APPROVED");
              const pending = !approved && cell.spans.length > 0;
              const names = Array.from(new Set(cell.spans.map((span) => span.label)));

              return (
                <div
                  key={cell.iso}
                  role="gridcell"
                  aria-label={
                    cell.spans.length === 0
                      ? `${cell.iso}: no leave`
                      : `${cell.iso}: ${approved ? "approved" : "pending"} ${names.join(", ")}`
                  }
                  className={[
                    "min-h-16 rounded-md border p-1 text-left text-xs",
                    approved
                      ? "border-primary bg-primary/90 text-primary-foreground"
                      : pending
                        ? "border-primary/50 bg-primary/15 text-foreground"
                        : "border-border bg-card text-muted-foreground",
                    cell.isToday ? "ring-2 ring-ring" : "",
                  ].join(" ")}
                >
                  <span className="font-medium">{cell.day}</span>
                  {names.length > 0 ? (
                    <span className="mt-1 block truncate" title={names.join(", ")}>
                      {names[0]}
                      {names.length > 1 ? ` +${names.length - 1}` : ""}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
