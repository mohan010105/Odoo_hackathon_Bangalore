import {
  getAttendanceOverview,
  getLatestPayrollOverview,
  getMyLatestPayslip,
  getTimeOffOverview,
} from "@/lib/dashboard.functions";

export type AttendanceOverview = Awaited<ReturnType<typeof getAttendanceOverview>>;
export type TimeOffOverview = Awaited<ReturnType<typeof getTimeOffOverview>>;
export type LatestPayrollOverview = Awaited<ReturnType<typeof getLatestPayrollOverview>>;
export type MyLatestPayslip = Awaited<ReturnType<typeof getMyLatestPayslip>>;

/** Dashboard read boundary — aggregate counts only, never raw people data. */
export const dashboardService = {
  attendanceOverview: () => getAttendanceOverview(),
  timeOffOverview: () => getTimeOffOverview(),
  latestPayroll: () => getLatestPayrollOverview(),
  myLatestPayslip: () => getMyLatestPayslip(),
};
