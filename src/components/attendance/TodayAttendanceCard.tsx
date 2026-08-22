import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, LogIn, LogOut, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatAttendanceDate,
  formatElapsed,
  formatHours,
  formatTime,
  businessDate,
  todayState,
  type AttendanceRecordRow,
} from "@/lib/attendance/rules";
import { attendanceService } from "@/services/attendance/attendanceService";

/** Live elapsed time since check-in — UI only, never persisted. */
function useElapsedSeconds(checkIn: string | null | undefined) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!checkIn) return;
    const start = new Date(checkIn).getTime();
    const tick = () => setSeconds(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [checkIn]);

  return seconds;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-2.5">
      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className="font-display text-sm font-bold text-foreground mt-0.5">{value}</p>
    </div>
  );
}

export function TodayAttendanceCard() {
  const queryClient = useQueryClient();

  const today = useQuery({
    queryKey: ["attendance", "today"],
    queryFn: () => attendanceService.getToday(),
  });

  const record: AttendanceRecordRow | null = today.data ?? null;
  const state = todayState(record);
  const elapsed = useElapsedSeconds(state === "WORKING" ? record?.check_in : null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["attendance"] });
  };

  const checkInMutation = useMutation({
    mutationFn: () => attendanceService.checkIn(),
    onSuccess: () => {
      toast.success("Check-in recorded successfully.");
      invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message);
      invalidate();
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: () => attendanceService.checkOut(),
    onSuccess: () => {
      toast.success("Check-out recorded successfully.");
      invalidate();
    },
    onError: (error: Error) => {
      toast.error(error.message);
      invalidate();
    },
  });

  const busy = checkInMutation.isPending || checkOutMutation.isPending;

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="space-y-1 p-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <CardTitle className="font-display text-base font-semibold">Today's Attendance</CardTitle>
            <CardDescription>
              {state === "NOT_CHECKED_IN"
                ? "You have not checked in yet today."
                : state === "WORKING"
                  ? "You are currently checked in and active."
                  : "Your work shift for today is complete."}
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {formatAttendanceDate(businessDate())}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-5 pt-0">
        {today.isLoading ? (
          <Skeleton className="h-20 w-full rounded-md" />
        ) : today.isError ? (
          <div role="alert" className="space-y-2">
            <p className="text-xs text-destructive">We could not load today's attendance.</p>
            <Button variant="outline" size="sm" onClick={() => void today.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 p-3">
              <div className="flex items-center gap-3">
                <Badge
                  variant={state === "WORKING" ? "success" : state === "COMPLETED" ? "neutral" : "warning"}
                  className="py-1 px-2.5 text-xs font-semibold"
                  aria-live="polite"
                >
                  {state === "NOT_CHECKED_IN"
                    ? "Not Checked In"
                    : state === "WORKING"
                      ? "Currently Working"
                      : "Shift Completed"}
                </Badge>
                {state === "WORKING" ? (
                  <span
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-primary"
                    role="timer"
                    aria-live="off"
                  >
                    <Clock aria-hidden="true" className="size-3.5 animate-pulse" />
                    {formatElapsed(elapsed)}
                  </span>
                ) : null}
              </div>

              <div>
                {state === "NOT_CHECKED_IN" ? (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={busy}
                    onClick={() => checkInMutation.mutate()}
                  >
                    <LogIn aria-hidden="true" className="size-3.5" />
                    {checkInMutation.isPending ? "Checking in…" : "Check In"}
                  </Button>
                ) : null}

                {state === "WORKING" ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    disabled={busy}
                    onClick={() => checkOutMutation.mutate()}
                  >
                    <LogOut aria-hidden="true" className="size-3.5" />
                    {checkOutMutation.isPending ? "Checking out…" : "Check Out"}
                  </Button>
                ) : null}

                {state === "COMPLETED" ? (
                  <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" /> Shift Logged
                  </div>
                ) : null}
              </div>
            </div>

            {record?.check_in ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Field label="Check in" value={formatTime(record.check_in)} />
                <Field label="Check out" value={formatTime(record.check_out)} />
                <Field label="Work hours" value={formatHours(record.work_hours)} />
                <Field label="Extra hours" value={formatHours(record.extra_hours)} />
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
