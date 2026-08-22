import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ATTENDANCE_STATUS_LABELS,
  formatAttendanceDate,
  formatHours,
  formatTime,
  type AttendanceRecordRow,
} from "@/lib/attendance/rules";

function StatusBadge({ status }: { status: AttendanceRecordRow["status"] }) {
  return (
    <Badge
      variant={
        status === "PRESENT" ? "default" : status === "ABSENT" ? "destructive" : "secondary"
      }
    >
      {ATTENDANCE_STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * Employee attendance history: a table on larger screens, stacked cards on
 * mobile so the layout never overflows horizontally.
 */
export function AttendanceHistoryTable({ rows }: { rows: readonly AttendanceRecordRow[] }) {
  return (
    <>
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display font-semibold">{formatAttendanceDate(row.attendance_date)}</p>
              <StatusBadge status={row.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Check in</dt>
                <dd>{formatTime(row.check_in)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Check out</dt>
                <dd>{formatTime(row.check_out)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Work hours</dt>
                <dd>{formatHours(row.work_hours)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Extra hours</dt>
                <dd>{formatHours(row.extra_hours)}</dd>
              </div>
            </dl>
            {row.notes ? <p className="mt-3 text-xs text-muted-foreground">{row.notes}</p> : null}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Check in</TableHead>
              <TableHead>Check out</TableHead>
              <TableHead>Work hours</TableHead>
              <TableHead>Extra hours</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {formatAttendanceDate(row.attendance_date)}
                </TableCell>
                <TableCell>{formatTime(row.check_in)}</TableCell>
                <TableCell>{formatTime(row.check_out)}</TableCell>
                <TableCell>{formatHours(row.work_hours)}</TableCell>
                <TableCell>{formatHours(row.extra_hours)}</TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
