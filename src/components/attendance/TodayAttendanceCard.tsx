import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, LogIn, LogOut } from "lucide-react";
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
    <div>
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-display text-base font-semibold text-foreground">{value}</p>
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
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="font-display text-base">Today's attendance</CardTitle>
          <Badge variant="outline">{formatAttendanceDate(businessDate())}</Badge>
        </div>
        <CardDescription>
          {state === "NOT_CHECKED_IN"
            ? "You have not checked in yet."
            : state === "WORKING"
              ? "You are currently checked in."
              : "Your day is complete."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {today.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : today.isError ? (
          <div role="alert" className="space-y-3">
            <p className="text-sm text-destructive">We could not load today's attendance.</p>
            <Button variant="outline" size="sm" onClick={() => void today.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                variant={state === "COMPLETED" ? "secondary" : "default"}
                className="text-sm"
                aria-live="polite"
              >
                {state === "NOT_CHECKED_IN"
                  ? "Not checked in"
                  : state === "WORKING"
                    ? "Working"
                    : "Completed"}
              </Badge>
              {state === "WORKING" ? (
                <span
                  className="inline-flex items-center gap-2 font-mono text-sm text-muted-foreground"
                  role="timer"
                  aria-live="off"
                >
                  <Clock aria-hidden="true" className="size-4" />
                  {formatElapsed(elapsed)}
                </span>
              ) : null}
            </div>

            {record?.check_in ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="Check in" value={formatTime(record.check_in)} />
                <Field label="Check out" value={formatTime(record.check_out)} />
                <Field label="Work hours" value={formatHours(record.work_hours)} />
                <Field label="Extra hours" value={formatHours(record.extra_hours)} />
              </div>
            ) : null}

            {state === "NOT_CHECKED_IN" ? (
              <Button
                size="lg"
                className="w-full sm:w-auto"
                disabled={busy}
                onClick={() => checkInMutation.mutate()}
              >
                <LogIn aria-hidden="true" className="size-4" />
                {checkInMutation.isPending ? "Checking in…" : "Check in"}
              </Button>
            ) : null}

            {state === "WORKING" ? (
              <Button
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={busy}
                onClick={() => checkOutMutation.mutate()}
              >
                <LogOut aria-hidden="true" className="size-4" />
                {checkOutMutation.isPending ? "Checking out…" : "Check out"}
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
