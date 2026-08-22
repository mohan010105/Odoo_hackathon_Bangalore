import { supabase } from "@/integrations/supabase/client";
import {
  cancelLeaveRequest,
  getEmployeeLeaveHistory,
  getLeaveStats,
  getMyLeaveBalance,
  getPendingLeaveCount,
  listLeaveAllocations,
  listLeaveRequests,
  listLeaveTypes,
  listMyLeaveRequests,
  reviewLeaveRequest,
  saveLeaveAllocation,
  saveLeaveType,
  submitLeaveRequest,
  type AdminLeaveFilters,
} from "@/lib/leave.functions";
import { LEAVE_ATTACHMENT_BUCKET } from "@/lib/leave/rules";
import { signStoragePaths } from "@/lib/storage.functions";
import type {
  LeaveAllocationInput,
  LeaveDecisionInput,
  LeaveRequestInput,
  LeaveTypeInput,
} from "@/lib/validation/leave";

export type { AdminLeaveFilters };


export type LeaveTypeRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_paid: boolean;
  requires_attachment: boolean;
  is_active?: boolean;
};

export type LeaveBalanceRow = {
  allocation_id: string | null;
  leave_type_id: string;
  code: string;
  name: string;
  description: string | null;
  is_paid: boolean;
  requires_attachment: boolean;
  allocated_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
  valid_from: string | null;
  valid_to: string | null;
};

export type LeaveRequestRow = {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  remarks: string | null;
  attachment_url: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
  leave_types: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    is_paid: boolean;
    requires_attachment: boolean;
  } | null;
};

export type EmployeeSummary = {
  id: string;
  login_id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  email: string;
};

export type AdminLeaveRequestRow = LeaveRequestRow & { employees: EmployeeSummary | null };

export type LeaveAllocationRow = {
  id: string;
  employee_id: string;
  leave_type_id: string;
  allocated_days: number;
  used_days: number;
  remaining_days: number | null;
  valid_from: string;
  valid_to: string;
  leave_types: LeaveTypeRow | null;
  employees: EmployeeSummary | null;
};

/**
 * Leave / time-off boundary. Every call goes through an authenticated server
 * function; employees never pass their own employee id, and every decision is
 * admin-gated in the server function *and* in the database.
 */
export const leaveService = {
  async listTypes(includeInactive = false): Promise<LeaveTypeRow[]> {
    return (await listLeaveTypes({ data: { includeInactive } })) as LeaveTypeRow[];
  },

  async myBalance(): Promise<LeaveBalanceRow[]> {
    return (await getMyLeaveBalance({})) as LeaveBalanceRow[];
  },

  async listMine(): Promise<LeaveRequestRow[]> {
    return (await listMyLeaveRequests({})) as LeaveRequestRow[];
  },

  async submit(input: LeaveRequestInput) {
    return submitLeaveRequest({ data: input });
  },

  async cancel(id: string) {
    return cancelLeaveRequest({ data: { id } });
  },

  /**
   * Uploads a certificate to the private leave bucket. The path is prefixed
   * with the signed-in user id, which storage policies require, so employees
   * can never write into another person's folder.
   */
  async uploadAttachment(file: File, userId: string): Promise<string> {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${userId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from(LEAVE_ATTACHMENT_BUCKET)
      .upload(path, file, { upsert: false, ...(file.type ? { contentType: file.type } : {}) });

    if (error) throw new Error("We could not upload that document. Please try again.");
    return path;
  },

  /** Short-lived signed URLs for private attachments. */
  async signAttachments(paths: string[]): Promise<Record<string, string>> {
    const unique = Array.from(new Set(paths.filter(Boolean)));
    if (unique.length === 0) return {};
    return signStoragePaths({ data: { bucket: LEAVE_ATTACHMENT_BUCKET, paths: unique } });
  },

  async listForReview(
    filters: AdminLeaveFilters,
  ): Promise<{ rows: AdminLeaveRequestRow[]; total: number }> {
    return (await listLeaveRequests({ data: filters })) as {
      rows: AdminLeaveRequestRow[];
      total: number;
    };
  },

  async pendingCount(): Promise<number> {
    return getPendingLeaveCount({});
  },

  async stats() {
    return getLeaveStats({});
  },

  async review(input: LeaveDecisionInput) {
    return reviewLeaveRequest({ data: input });
  },

  async listAllocations(filters: {
    employeeId?: string;
    leaveTypeId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ rows: LeaveAllocationRow[]; total: number }> {
    return (await listLeaveAllocations({ data: filters })) as {
      rows: LeaveAllocationRow[];
      total: number;
    };
  },

  async saveAllocation(input: LeaveAllocationInput) {
    return saveLeaveAllocation({ data: input });
  },

  async saveType(input: LeaveTypeInput) {
    return saveLeaveType({ data: input });
  },

  async employeeHistory(employeeId: string): Promise<{
    employee: (EmployeeSummary & { job_position: string | null }) | null;
    balances: LeaveBalanceRow[];
    requests: LeaveRequestRow[];
  }> {
    return (await getEmployeeLeaveHistory({ data: { employeeId } })) as never;
  },
};
