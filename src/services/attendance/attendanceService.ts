import {
  checkIn,
  checkOut,
  correctAttendance,
  getEmployeeAttendance,
  getMyTodayAttendance,
  getTodayAttendanceSummary,
  listAttendance,
  listMyAttendance,
  listMyAttendancePage,
  type AdminAttendanceFilters,
  type AttendanceCorrectionInput,
} from "@/lib/attendance.functions";
import type { AttendanceRecordRow } from "@/lib/attendance/rules";

export type AdminAttendanceRow = AttendanceRecordRow & {
  employees: {
    id: string;
    login_id: string;
    first_name: string;
    last_name: string;
    department: string | null;
  } | null;
};

export type DateRange = { from: string; to: string };

/**
 * Attendance data boundary. Every call goes through an authenticated server
 * function; the browser never sends an employee id for its own operations.
 * The Odoo adapter will implement this same interface in a later phase.
 */
export const attendanceService = {
  async getToday(): Promise<AttendanceRecordRow | null> {
    return (await getMyTodayAttendance({})) as AttendanceRecordRow | null;
  },

  async listMine(range: DateRange): Promise<AttendanceRecordRow[]> {
    return (await listMyAttendance({ data: range })) as AttendanceRecordRow[];
  },

  async listMinePage(
    range: DateRange & { page: number; pageSize: number },
  ): Promise<{ rows: AttendanceRecordRow[]; total: number }> {
    const result = await listMyAttendancePage({ data: range });
    return { rows: result.rows as unknown as AttendanceRecordRow[], total: result.total };
  },

  async checkIn(): Promise<AttendanceRecordRow> {
    return (await checkIn({})) as AttendanceRecordRow;
  },

  async checkOut(): Promise<AttendanceRecordRow> {
    return (await checkOut({})) as AttendanceRecordRow;
  },

  async listAll(
    filters: AdminAttendanceFilters,
  ): Promise<{ rows: AdminAttendanceRow[]; total: number }> {
    const result = await listAttendance({ data: filters });
    return { rows: result.rows as unknown as AdminAttendanceRow[], total: result.total };
  },

  async todaySummary() {
    return getTodayAttendanceSummary({});
  },

  async listForEmployee(employeeId: string, range: DateRange): Promise<AttendanceRecordRow[]> {
    return (await getEmployeeAttendance({
      data: { employeeId, ...range },
    })) as AttendanceRecordRow[];
  },

  async correct(input: AttendanceCorrectionInput): Promise<AttendanceRecordRow> {
    return (await correctAttendance({ data: input })) as AttendanceRecordRow;
  },
};
