import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  ATTENDANCE_STATUS_LABELS,
  BUSINESS_TIMEZONE,
  type AttendanceRecordRow,
  type AttendanceStatus,
} from "@/lib/attendance/rules";
import { attendanceService } from "@/services/attendance/attendanceService";

const localInput = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Timestamp → value for <input type="datetime-local"> in the business timezone. */
function toLocalInput(value: string | null): string {
  if (!value) return "";
  const parts = localInput.formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Business-timezone local input → ISO instant. */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  // Resolve the business timezone offset for the entered wall-clock time.
  const naive = new Date(`${value}:00Z`);
  const shown = new Date(
    localInput
      .format(naive)
      .replace(",", "")
      .replace(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/, "$1-$2-$3T$4:$5:00Z"),
  );
  const offset = shown.getTime() - naive.getTime();
  return new Date(naive.getTime() - offset).toISOString();
}

export function AttendanceCorrectionDialog({
  record,
  onClose,
}: {
  record: AttendanceRecordRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [status, setStatus] = useState<AttendanceStatus>("PRESENT");
  const [notes, setNotes] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Sync the form when a new record is opened.
  useEffect(() => {
    if (!record || record.id === loadedId) return;
    setLoadedId(record.id);
    setCheckIn(toLocalInput(record.check_in));
    setCheckOut(toLocalInput(record.check_out));
    setStatus(record.status);
    setNotes("");
  }, [record, loadedId]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!record) throw new Error("No attendance record selected.");
      const nextIn = fromLocalInput(checkIn);
      const nextOut = fromLocalInput(checkOut);
      if (nextIn && nextOut && new Date(nextOut) < new Date(nextIn)) {
        throw new Error("Check-out time must be after the check-in time.");
      }
      return attendanceService.correct({
        id: record.id,
        checkIn: nextIn,
        checkOut: nextOut,
        status,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
    },
    onSuccess: () => {
      toast.success("Attendance updated.");
      void queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setLoadedId(null);
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog
      open={Boolean(record)}
      onOpenChange={(open) => {
        if (!open) {
          setLoadedId(null);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct attendance</DialogTitle>
          <DialogDescription>
            Work and extra hours are recalculated automatically from the timestamps.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="correct-check-in">Check in</Label>
              <Input
                id="correct-check-in"
                type="datetime-local"
                value={checkIn}
                onChange={(event) => setCheckIn(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="correct-check-out">Check out</Label>
              <Input
                id="correct-check-out"
                type="datetime-local"
                value={checkOut}
                onChange={(event) => setCheckOut(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="correct-status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as AttendanceStatus)}>
              <SelectTrigger id="correct-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="correct-notes">Note (optional)</Label>
            <Textarea
              id="correct-notes"
              placeholder="Corrected due to missed checkout."
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to keep the existing note.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save correction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
