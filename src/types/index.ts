/**
 * Dayflow HR domain types.
 *
 * These are intentionally minimal and extensible so they can be mapped onto
 * Odoo HR models (hr.employee, hr.attendance, hr.leave, hr.payslip) in a later
 * phase without reshaping the frontend.
 */

export type Role = "EMPLOYEE" | "ADMIN";

export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE";

export interface User {
  id: string;
  /** The generated Login ID (empty for admin accounts without an employee record). */
  employeeId: string;
  email: string;
  fullName: string | null;
  role: Role;
  emailVerified: boolean;
  /** True until the employee has replaced their generated password. */
  mustChangePassword: boolean;
}

export interface Employee {
  id: string;
  employeeId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  profilePicture?: string;
  department?: string;
  designation?: string;
  joiningDate?: string;
  status: EmployeeStatus;
}

export interface PersonalDetails {
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  emergencyContact?: string;
}

export interface JobDetails {
  department?: string;
  designation?: string;
  joiningDate?: string;
  reportsTo?: string;
  employmentType?: string;
}

export interface SalaryStructure {
  id: string;
  basic: number;
  hra: number;
  allowances: number;
  deductions: number;
  currency: string;
}

export interface SalaryDetails {
  structure?: SalaryStructure;
  effectiveDate?: string;
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
}

export interface EmployeeProfile {
  employee: Employee;
  personalDetails: PersonalDetails;
  jobDetails: JobDetails;
  salaryDetails?: SalaryDetails;
  documents: EmployeeDocument[];
}

/** Mirrors the database attendance_status enum exactly — there is no "LATE" state. */
export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "LEAVE";

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  hoursWorked?: number;
  status: AttendanceStatus;
}

export type LeaveType = "ANNUAL" | "SICK" | "UNPAID" | "CASUAL" | "MATERNITY";

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  remarks?: string;
  status: LeaveStatus;
  reviewedBy?: string;
  reviewComment?: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  salaryStructure: SalaryStructure;
  effectiveDate: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body?: string;
  read: boolean;
  createdAt: string;
}

/** Authenticated session shape. Never contains credentials. */
export interface Session {
  user: User;
  expiresAt?: string;
}
