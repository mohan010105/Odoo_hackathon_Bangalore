import {
  createEmployee,
  getEmployeeById,
  getMyEmployeeRecord,
  listEmployees,
} from "@/lib/employees.functions";
import { signStoragePaths } from "@/lib/storage.functions";
import type { CreateEmployeeInput } from "@/lib/validation/employee";
import type { Employee, EmployeeStatus } from "@/types";

type EmployeeRow = {
  id: string;
  user_id: string | null;
  company_id: string | null;
  login_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  joining_date: string;
  department: string | null;
  job_position: string | null;
  manager: string | null;
  location: string | null;
  profile_picture: string | null;
  status: string;
  created_at?: string;
};

function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    employeeId: row.login_id,
    userId: row.user_id ?? "",
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    status: row.status as EmployeeStatus,
    ...(row.phone ? { phone: row.phone } : {}),
    ...(row.department ? { department: row.department } : {}),
    ...(row.job_position ? { designation: row.job_position } : {}),
    ...(row.joining_date ? { joiningDate: row.joining_date } : {}),
    ...(row.profile_picture ? { profilePicture: row.profile_picture } : {}),
  };
}

export type EmployeeFilters = {
  search?: string;
  department?: string;
  location?: string;
  status?: EmployeeStatus;
};

export type EmployeeWithMeta = Employee & {
  manager?: string;
  location?: string;
  /** Short-lived signed URL for the stored profile picture. */
  avatarUrl?: string;
};

async function withAvatars(rows: EmployeeRow[]): Promise<EmployeeWithMeta[]> {
  const paths = rows.map((row) => row.profile_picture).filter((p): p is string => !!p);
  let signed: Record<string, string> = {};

  if (paths.length > 0) {
    try {
      signed = await signStoragePaths({ data: { bucket: "profile-pictures", paths } });
    } catch {
      signed = {};
    }
  }

  return rows.map((row) => ({
    ...toEmployee(row),
    ...(row.manager ? { manager: row.manager } : {}),
    ...(row.location ? { location: row.location } : {}),
    ...(row.profile_picture && signed[row.profile_picture]
      ? { avatarUrl: signed[row.profile_picture]! }
      : {}),
  }));
}

/**
 * Employee data access boundary. Today it talks to the Dayflow backend; the
 * Odoo integration layer will implement the same interface in a later phase.
 */
export const employeeService = {
  async listEmployees(filters: EmployeeFilters = {}): Promise<EmployeeWithMeta[]> {
    const rows = (await listEmployees({ data: filters })) as EmployeeRow[];
    return withAvatars(rows);
  },

  async getEmployee(id: string): Promise<EmployeeWithMeta> {
    const row = (await getEmployeeById({ data: { id } })) as EmployeeRow;
    const [employee] = await withAvatars([row]);
    return employee!;
  },

  async getMyRecord(): Promise<EmployeeWithMeta | null> {
    const row = (await getMyEmployeeRecord({})) as EmployeeRow | null;
    if (!row) return null;
    const [employee] = await withAvatars([row]);
    return employee ?? null;
  },

  async createEmployee(input: CreateEmployeeInput) {
    const result = await createEmployee({ data: input });
    return {
      employee: toEmployee(result.employee as EmployeeRow),
      loginId: result.loginId,
      temporaryPassword: result.temporaryPassword,
      verificationRequired: result.verificationRequired,
    };
  },
};
